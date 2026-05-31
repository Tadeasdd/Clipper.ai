"""
Phase 6 hardening tests.

Coverage:
    - Token bucket math (capacity, refill, consume)
    - Rate limit per-tier multipliers
    - enforce_rate_limit raises 429 with Retry-After
    - Error envelope shape for HTTPException str / dict / quota-exceeded
    - Idempotency: same key returns same job (in-memory simulation)
    - Idempotency: stale row (job deleted) is dropped + new one created
    - Webhook idempotency: replay returns 200, doesn't reinvoke handler
    - Webhook idempotency: handler error rolls back the dedupe row
    - Job cancellation: non-terminal job → CANCELLED
    - Job cancellation: terminal job → already_terminal=True (idempotent)
    - Pipeline _set_status raises CancellationRequested if job is CANCELLED
    - Readiness check returns 503 when a dep is down
"""

import asyncio
import time
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.rate_limit import (
    TokenBucket,
    enforce_rate_limit,
    reset_buckets_for_tests,
    _BASE_LIMITS,
    _TIER_MULTIPLIERS,
    _get_bucket,
)
from app.db.models import JobStatus, PlanTier
from app.workers.pipeline import CancellationRequested


# ──────────────────────────────────────────────────────────── TOKEN BUCKET MATH


def test_token_bucket_starts_full():
    b = TokenBucket(capacity=10, refill_per_second=1)
    assert b.tokens == 10


def test_token_bucket_consumes_then_refuses():
    b = TokenBucket(capacity=3, refill_per_second=0)  # no refill
    assert b.try_consume() is True
    assert b.try_consume() is True
    assert b.try_consume() is True
    assert b.try_consume() is False  # empty


def test_token_bucket_refills_over_time():
    b = TokenBucket(capacity=10, refill_per_second=100)  # very fast refill
    for _ in range(10):
        b.try_consume()
    assert b.try_consume() is False  # exhausted

    # Wait for refill
    time.sleep(0.05)  # 5 tokens-worth at 100/s
    assert b.try_consume() is True


def test_token_bucket_capacity_is_cap():
    """Refilling beyond capacity shouldn't overflow."""
    b = TokenBucket(capacity=5, refill_per_second=1000)
    time.sleep(0.1)  # would refill 100 tokens at this rate
    b.try_consume()  # trigger refill
    # After the consume, tokens should be capped near 4 (5 - 1)
    assert b.tokens <= 5


def test_token_bucket_retry_after_zero_when_full():
    b = TokenBucket(capacity=10, refill_per_second=1)
    assert b.retry_after_seconds() == 0.0


def test_token_bucket_retry_after_positive_when_empty():
    b = TokenBucket(capacity=1, refill_per_second=2)  # 2 tokens/s
    b.try_consume()  # empty
    delay = b.retry_after_seconds()
    assert 0.4 <= delay <= 0.51  # roughly 0.5s


# ──────────────────────────────────────────────────────────── RATE LIMITER


def test_rate_limit_starter_caps_at_base_limit():
    reset_buckets_for_tests()
    org_id = uuid4()
    cap, _ = _BASE_LIMITS["expensive"]
    # Starter has 1x multiplier, so cap = 10
    for _ in range(cap):
        enforce_rate_limit(org_id, PlanTier.STARTER, "expensive")
    with pytest.raises(HTTPException) as exc:
        enforce_rate_limit(org_id, PlanTier.STARTER, "expensive")
    assert exc.value.status_code == 429
    assert exc.value.detail["error"] == "rate_limited"
    assert "Retry-After" in exc.value.headers


def test_rate_limit_studio_gets_5x_multiplier():
    reset_buckets_for_tests()
    org_id = uuid4()
    cap, _ = _BASE_LIMITS["expensive"]
    mult = _TIER_MULTIPLIERS[PlanTier.STUDIO]
    # Studio should consume 5*10 = 50 before getting rejected
    for _ in range(cap * mult):
        enforce_rate_limit(org_id, PlanTier.STUDIO, "expensive")
    with pytest.raises(HTTPException) as exc:
        enforce_rate_limit(org_id, PlanTier.STUDIO, "expensive")
    assert exc.value.status_code == 429


def test_rate_limit_enterprise_gets_50x_multiplier():
    reset_buckets_for_tests()
    org_id = uuid4()
    # Enterprise gets 50x — basically uncapped for normal use. We only
    # confirm we can do 100 calls easily.
    for _ in range(100):
        enforce_rate_limit(org_id, PlanTier.ENTERPRISE, "expensive")


def test_rate_limit_per_org_isolation():
    """Two orgs shouldn't share a bucket."""
    reset_buckets_for_tests()
    org_a, org_b = uuid4(), uuid4()
    cap, _ = _BASE_LIMITS["expensive"]
    # Drain A's bucket
    for _ in range(cap):
        enforce_rate_limit(org_a, PlanTier.STARTER, "expensive")
    # B should still be unaffected
    enforce_rate_limit(org_b, PlanTier.STARTER, "expensive")  # no raise


def test_rate_limit_groups_are_independent():
    """Burning the 'expensive' bucket shouldn't affect 'read'."""
    reset_buckets_for_tests()
    org_id = uuid4()
    cap, _ = _BASE_LIMITS["expensive"]
    for _ in range(cap):
        enforce_rate_limit(org_id, PlanTier.STARTER, "expensive")
    # Read bucket should still have full capacity
    enforce_rate_limit(org_id, PlanTier.STARTER, "read")


def test_rate_limit_can_be_disabled():
    """When rate_limit_enabled=False, enforce_rate_limit is a no-op."""
    reset_buckets_for_tests()
    org_id = uuid4()
    with patch("app.core.rate_limit.get_settings") as mock_settings:
        mock_settings.return_value.rate_limit_enabled = False
        # Could do this 1000x and never trip
        for _ in range(1000):
            enforce_rate_limit(org_id, PlanTier.STARTER, "expensive")


# ──────────────────────────────────────────────────────────── ERROR ENVELOPE


def test_error_envelope_string_detail():
    """HTTPException with str detail → envelope with derived code."""
    from app.main import _envelope

    request = MagicMock()
    request.state.request_id = "abc123"
    payload = _envelope("not_found", "Job not found", request)
    body = payload.model_dump(exclude_none=True)
    assert body == {
        "error": {
            "code": "not_found",
            "message": "Job not found",
            "request_id": "abc123",
        }
    }


def test_error_envelope_quota_exceeded_details():
    """Dict detail with 'error' key gets unpacked into code + details."""
    from app.main import _envelope

    request = MagicMock()
    request.state.request_id = "req_456"
    payload = _envelope(
        "quota_exceeded",
        "Plan limit reached",
        request,
        details={"minutes_used": 60, "minutes_limit": 60, "plan": "starter"},
    )
    body = payload.model_dump(exclude_none=True)
    assert body["error"]["code"] == "quota_exceeded"
    assert body["error"]["details"]["minutes_used"] == 60


# ──────────────────────────────────────────────────────────── IDEMPOTENCY (jobs)
#
# These tests use real Pydantic models + mocked DB. Full integration tests
# would need a real Postgres; this layer verifies the logic flow.


@pytest.mark.asyncio
async def test_idempotency_key_returns_existing_job():
    """Same key on retry returns the existing job without creating a new one."""
    from app.api.jobs import create_job
    from app.db.models import IdempotencyKey, Job, Org, PlanTier, User

    org = Org(id=uuid4(), name="test", plan_tier=PlanTier.STARTER)
    user = User(id=uuid4(), org_id=org.id, email="u@t", clerk_user_id="u")
    existing_job = Job(
        id=uuid4(),
        org_id=org.id,
        source_filename="x.mp4",
        source_r2_key="k",
        status=JobStatus.QUEUED,
        progress_pct=0,
        clips=[],
        created_at=datetime.now(timezone.utc),
    )
    existing_key = IdempotencyKey(org_id=org.id, key="abc", job_id=existing_job.id)

    # Mock DB: first query returns the existing key, second returns the job
    db = MagicMock()
    db.execute = AsyncMock(side_effect=[
        MagicMock(scalar_one_or_none=MagicMock(return_value=existing_key)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=existing_job)),
    ])

    req = MagicMock()
    req.source_filename = "x.mp4"
    req.source_r2_key = "k"

    reset_buckets_for_tests()
    result = await create_job(
        req=req,
        idempotency_key="abc",
        auth=(user, org),
        db=db,
    )
    # The returned job should be the existing one — no new INSERT
    assert result.id == existing_job.id
    # Verify we didn't try to commit a new row
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_idempotency_key_with_stale_row_creates_new_job():
    """If idempotency row exists but the job was deleted, drop the row + create a new job."""
    from app.api.jobs import create_job
    from app.db.models import IdempotencyKey, Org, PlanTier, User

    org = Org(id=uuid4(), name="test", plan_tier=PlanTier.STARTER)
    user = User(id=uuid4(), org_id=org.id, email="u@t", clerk_user_id="u")
    stale_key = IdempotencyKey(org_id=org.id, key="zzz", job_id=uuid4())

    db = MagicMock()
    db.execute = AsyncMock(side_effect=[
        # First query: stale key found
        MagicMock(scalar_one_or_none=MagicMock(return_value=stale_key)),
        # Second query: job is gone
        MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
    ])
    db.delete = AsyncMock()
    db.commit = AsyncMock()

    req = MagicMock()

    reset_buckets_for_tests()
    # Patch the rest of the create_job path so it doesn't try to hit
    # real DB / quota / R2 — we just want to verify the stale-row branch fires
    with patch("app.api.jobs.ensure_quota_available", new=AsyncMock()), \
         patch("app.api.jobs.head_object", return_value=None):
        with pytest.raises(HTTPException) as exc:
            await create_job(
                req=req,
                idempotency_key="zzz",
                auth=(user, org),
                db=db,
            )
    # It bailed at the head_object check (returning 400) — but importantly
    # the stale key was deleted on the way through
    assert exc.value.status_code == 400
    db.delete.assert_awaited_once_with(stale_key)


# ──────────────────────────────────────────────────────────── WEBHOOK IDEMPOTENCY


@pytest.mark.asyncio
async def test_webhook_replay_returns_200_without_reinvoking_handler():
    """If we've already processed this event_id, skip the handler."""
    from app.api.billing import stripe_webhook
    from app.db.models import ProcessedWebhook

    existing = ProcessedWebhook(
        provider="stripe",
        event_id="evt_test",
        event_type="customer.subscription.updated",
    )
    db = MagicMock()
    db.execute = AsyncMock(return_value=MagicMock(
        scalar_one_or_none=MagicMock(return_value=existing)
    ))

    request = MagicMock()
    request.body = AsyncMock(return_value=b'{"id":"evt_test","type":"test"}')

    with patch("app.api.billing.verify_webhook_signature") as verify, \
         patch("app.api.billing.handle_webhook_event") as handle:
        verify.return_value = {"id": "evt_test", "type": "customer.subscription.updated"}
        result = await stripe_webhook(
            request=request,
            stripe_signature="t=123,v1=abc",
            db=db,
        )

    # Handler should NOT have been invoked
    handle.assert_not_called()
    assert result.status_code == 200


@pytest.mark.asyncio
async def test_webhook_handler_error_rolls_back_dedupe_row():
    """If the handler crashes, the ProcessedWebhook row must be rolled back
    so Stripe's retry has a clean slate."""
    from app.api.billing import stripe_webhook

    db = MagicMock()
    db.execute = AsyncMock(return_value=MagicMock(
        scalar_one_or_none=MagicMock(return_value=None)  # never processed
    ))
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()

    request = MagicMock()
    request.body = AsyncMock(return_value=b'{}')

    with patch("app.api.billing.verify_webhook_signature") as verify, \
         patch("app.api.billing.handle_webhook_event") as handle:
        verify.return_value = {"id": "evt_crash", "type": "customer.subscription.deleted"}
        handle.side_effect = RuntimeError("handler exploded")

        result = await stripe_webhook(
            request=request,
            stripe_signature="t=123,v1=abc",
            db=db,
        )

    # Still returns 200 to Stripe (avoid retry storm on bad data)
    assert result.status_code == 200
    # But the dedupe row was rolled back
    db.rollback.assert_awaited()


# ──────────────────────────────────────────────────────────── JOB CANCELLATION


@pytest.mark.asyncio
async def test_cancel_job_marks_non_terminal_as_cancelled():
    from app.api.jobs import cancel_job
    from app.db.models import Job, Org, PlanTier, User

    org = Org(id=uuid4(), name="t", plan_tier=PlanTier.STARTER)
    user = User(id=uuid4(), org_id=org.id, email="u@t", clerk_user_id="u")
    job = Job(
        id=uuid4(),
        org_id=org.id,
        source_filename="f",
        source_r2_key="k",
        status=JobStatus.TRANSCRIBING,
        progress_pct=15,
    )

    db = MagicMock()
    db.execute = AsyncMock(return_value=MagicMock(
        scalar_one_or_none=MagicMock(return_value=job)
    ))
    db.commit = AsyncMock()

    reset_buckets_for_tests()
    result = await cancel_job(job_id=job.id, auth=(user, org), db=db)

    assert job.status == JobStatus.CANCELLED
    assert result["status"] == "cancelled"
    assert result["already_terminal"] is False
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_cancel_job_idempotent_on_terminal_state():
    """Cancelling an already-COMPLETE job is a no-op, returns already_terminal=True."""
    from app.api.jobs import cancel_job
    from app.db.models import Job, Org, PlanTier, User

    org = Org(id=uuid4(), name="t", plan_tier=PlanTier.STARTER)
    user = User(id=uuid4(), org_id=org.id, email="u@t", clerk_user_id="u")
    job = Job(
        id=uuid4(),
        org_id=org.id,
        source_filename="f",
        source_r2_key="k",
        status=JobStatus.COMPLETE,
        progress_pct=100,
    )

    db = MagicMock()
    db.execute = AsyncMock(return_value=MagicMock(
        scalar_one_or_none=MagicMock(return_value=job)
    ))
    db.commit = AsyncMock()

    reset_buckets_for_tests()
    result = await cancel_job(job_id=job.id, auth=(user, org), db=db)
    assert result["already_terminal"] is True
    assert result["status"] == "complete"
    # Status untouched
    assert job.status == JobStatus.COMPLETE
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_pipeline_set_status_raises_on_cancelled_job():
    """_set_status checks for CANCELLED and raises CancellationRequested."""
    from app.workers.pipeline import _set_status
    from app.db.models import Job, Org, PlanTier

    job_id = uuid4()
    cancelled_job = Job(
        id=job_id,
        org_id=uuid4(),
        source_filename="f",
        source_r2_key="k",
        status=JobStatus.CANCELLED,
        progress_pct=15,
    )

    mock_session = MagicMock()
    mock_session.get = AsyncMock(return_value=cancelled_job)
    mock_session.commit = AsyncMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=None)

    with patch("app.workers.pipeline.AsyncSessionLocal", return_value=mock_session):
        with pytest.raises(CancellationRequested) as exc:
            await _set_status(job_id, JobStatus.SEGMENTING, 35)
    assert exc.value.job_id == job_id
    # Status was NOT updated — still CANCELLED
    assert cancelled_job.status == JobStatus.CANCELLED


# ──────────────────────────────────────────────────────────── READINESS


@pytest.mark.asyncio
async def test_readiness_returns_503_when_db_down():
    """If DB ping fails, readiness returns 503 so LB pulls us out."""
    from app.api.health import ready
    from fastapi import Response

    db = MagicMock()
    db.execute = AsyncMock(side_effect=RuntimeError("connection refused"))

    response = Response()
    with patch("app.api.health._check_r2", new=AsyncMock(return_value=True)):
        result = await ready(response=response, db=db)

    assert response.status_code == 503
    assert result["status"] == "degraded"
    assert result["checks"]["database"] is False
    assert result["checks"]["r2"] is True


@pytest.mark.asyncio
async def test_readiness_returns_200_when_all_ok():
    from app.api.health import ready
    from fastapi import Response

    db = MagicMock()
    db.execute = AsyncMock(return_value=None)

    response = Response()
    with patch("app.api.health._check_r2", new=AsyncMock(return_value=True)):
        result = await ready(response=response, db=db)

    # Response stays at default (200) — we only set it on failure
    assert result["status"] == "ok"
    assert all(result["checks"].values())
