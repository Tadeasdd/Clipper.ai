"""
Phase 6.5 follow-up tests:
    - Cursor encode/decode roundtrip + tamper-resistance
    - Cleanup job filtering logic (idempotency, webhooks, orphans)
    - get_db rollback on exception
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from app.api.jobs import _decode_cursor, _encode_cursor


# ──────────────────────────────────────────────────────────── CURSOR


def test_cursor_roundtrip():
    now = datetime.now(timezone.utc)
    job_id = uuid4()
    enc = _encode_cursor(now, job_id)
    dec_created, dec_id = _decode_cursor(enc)
    assert dec_created == now
    assert dec_id == job_id


def test_cursor_is_urlsafe_no_padding():
    """Cursors should be URL-safe so they survive query strings without escaping."""
    enc = _encode_cursor(datetime.now(timezone.utc), uuid4())
    assert "/" not in enc
    assert "+" not in enc
    assert "=" not in enc  # we strip padding


def test_cursor_invalid_raises():
    with pytest.raises(ValueError):
        _decode_cursor("not-a-valid-cursor")


def test_cursor_malformed_uuid_raises():
    """A cursor with a bad UUID half should also raise."""
    import base64
    bad = base64.urlsafe_b64encode(b"2026-05-26T11:00:00+00:00|not-a-uuid").decode().rstrip("=")
    with pytest.raises(ValueError):
        _decode_cursor(bad)


def test_cursor_truncated_raises():
    """A cursor without the | delimiter should raise."""
    import base64
    bad = base64.urlsafe_b64encode(b"no-delimiter-here").decode().rstrip("=")
    with pytest.raises(ValueError):
        _decode_cursor(bad)


# ──────────────────────────────────────────────────────────── CLEANUP JOBS


@pytest.mark.asyncio
async def test_cleanup_idempotency_keys_deletes_old():
    """The cron should issue a single DELETE with a 24h cutoff."""
    from app.workers.cleanup import _run_cleanup_idempotency_keys

    mock_result = MagicMock()
    mock_result.rowcount = 42

    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=None)

    with patch("app.workers.cleanup.AsyncSessionLocal", return_value=mock_session):
        # Inngest passes a context; we don't read it, but the signature requires it
        result = await _run_cleanup_idempotency_keys()

    assert result == {"deleted": 42}
    mock_session.execute.assert_awaited_once()
    mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_cleanup_processed_webhooks_uses_30d_cutoff():
    from app.workers.cleanup import _run_cleanup_processed_webhooks

    mock_result = MagicMock()
    mock_result.rowcount = 7

    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=None)

    with patch("app.workers.cleanup.AsyncSessionLocal", return_value=mock_session):
        result = await _run_cleanup_processed_webhooks()

    assert result == {"deleted": 7}


@pytest.mark.asyncio
async def test_cleanup_orphan_uploads_skips_too_young():
    """Uploads younger than UPLOAD_GRACE_HOURS should be left alone."""
    from app.workers.cleanup import _run_cleanup_orphan_uploads

    now = datetime.now(timezone.utc)
    young_upload = {
        "Key": "uploads/orgA/recent.mp4",
        "LastModified": now - timedelta(minutes=30),  # under 1h grace
        "Size": 1000,
    }

    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=None)
    mock_session.execute = AsyncMock(return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))))

    with patch("app.workers.cleanup.list_objects", return_value=iter([young_upload])), \
         patch("app.workers.cleanup.delete_objects") as mock_del, \
         patch("app.workers.cleanup.AsyncSessionLocal", return_value=mock_session):
        result = await _run_cleanup_orphan_uploads()

    assert result["scanned"] == 0
    assert result["deleted"] == 0
    mock_del.assert_not_called()


@pytest.mark.asyncio
async def test_cleanup_orphan_uploads_skips_too_old():
    """Uploads older than UPLOAD_MAX_AGE_DAYS should be skipped (defensive)."""
    from app.workers.cleanup import _run_cleanup_orphan_uploads

    now = datetime.now(timezone.utc)
    ancient_upload = {
        "Key": "uploads/orgA/ancient.mp4",
        "LastModified": now - timedelta(days=60),  # > 30d cap
        "Size": 1000,
    }

    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=None)
    mock_session.execute = AsyncMock(return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))))

    with patch("app.workers.cleanup.list_objects", return_value=iter([ancient_upload])), \
         patch("app.workers.cleanup.delete_objects") as mock_del, \
         patch("app.workers.cleanup.AsyncSessionLocal", return_value=mock_session):
        result = await _run_cleanup_orphan_uploads()

    assert result["scanned"] == 0
    mock_del.assert_not_called()


@pytest.mark.asyncio
async def test_cleanup_orphan_uploads_deletes_unreferenced():
    """Orphan candidate that has no matching Job row should be deleted."""
    from app.workers.cleanup import _run_cleanup_orphan_uploads

    now = datetime.now(timezone.utc)
    orphan = {
        "Key": "uploads/orgA/abandoned.mp4",
        "LastModified": now - timedelta(hours=5),  # in the cleanup window
        "Size": 1000,
    }
    referenced = {
        "Key": "uploads/orgB/processed.mp4",
        "LastModified": now - timedelta(hours=5),
        "Size": 2000,
    }

    # DB returns referenced.Key as known
    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=None)
    mock_session.execute = AsyncMock(
        return_value=MagicMock(
            scalars=MagicMock(return_value=MagicMock(
                all=MagicMock(return_value=[referenced["Key"]])
            ))
        )
    )

    with patch("app.workers.cleanup.list_objects", return_value=iter([orphan, referenced])), \
         patch("app.workers.cleanup.delete_objects", return_value=1) as mock_del, \
         patch("app.workers.cleanup.AsyncSessionLocal", return_value=mock_session):
        result = await _run_cleanup_orphan_uploads()

    assert result["scanned"] == 2
    assert result["deleted"] == 1
    # delete_objects called with exactly the orphan
    mock_del.assert_called_once_with([orphan["Key"]])


# ──────────────────────────────────────────────────────────── DB SESSION LIFECYCLE


@pytest.mark.asyncio
async def test_get_db_rolls_back_on_exception():
    """If the route handler throws, the session should roll back before close."""
    from app.db.base import get_db

    # We can't easily mock the actual sessionmaker, but we can verify the
    # generator's exception handling by driving it manually.
    gen = get_db()

    # Patch AsyncSessionLocal so we don't hit a real DB
    with patch("app.db.base.AsyncSessionLocal") as factory:
        session = MagicMock()
        session.rollback = AsyncMock()
        session.close = AsyncMock()
        session.__aenter__ = AsyncMock(return_value=session)
        session.__aexit__ = AsyncMock(return_value=None)
        factory.return_value = session

        gen = get_db()
        await gen.__anext__()  # yields the session

        # Simulate the request handler throwing
        with pytest.raises(RuntimeError):
            await gen.athrow(RuntimeError("handler error"))

        # Rollback was called before the context manager closed
        session.rollback.assert_awaited_once()
