"""
Smoke tests — exercise the routing + middleware + error handling without
hitting the real DB or Clerk.

We override:
    - get_current_user_and_org → returns a fake (user, org) tuple
    - any DB-touching dep is mocked at the call site (e.g. head_object)

Rate limiting is reset between tests via the autouse fixture.
"""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_and_org
from app.core.rate_limit import reset_buckets_for_tests
from app.db.models import Org, PlanTier, User
from app.main import app


# ──────────────────────────────────────────────────────────── FIXTURES


@pytest.fixture
def fake_org():
    return Org(
        id=uuid4(),
        name="Smoke Test Org",
        plan_tier=PlanTier.STUDIO,  # higher tier so rate limits don't bite
    )


@pytest.fixture
def fake_user(fake_org):
    return User(
        id=uuid4(),
        org_id=fake_org.id,
        clerk_user_id="smoke_user",
        email="smoke@test",
        name="Smoke User",
    )


@pytest.fixture
def client(fake_user, fake_org):
    """TestClient with auth dep overridden."""
    async def _fake_auth():
        return (fake_user, fake_org)

    app.dependency_overrides[get_current_user_and_org] = _fake_auth
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """Wipe in-memory token buckets between tests so they don't interfere."""
    reset_buckets_for_tests()
    yield
    reset_buckets_for_tests()


# ──────────────────────────────────────────────────────────── TESTS


def test_health(client):
    """Liveness is unauthenticated and always returns 200."""
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_health_returns_request_id_header(client):
    """X-Request-ID should be on every response (set by middleware)."""
    r = client.get("/health")
    assert "x-request-id" in {k.lower() for k in r.headers.keys()}


def test_presign_rejects_bad_content_type(client):
    r = client.post(
        "/v1/uploads/presign",
        json={
            "filename": "test.exe",
            "content_type": "application/x-msdownload",
            "size_bytes": 1024,
        },
    )
    assert r.status_code == 415


def test_presign_rejects_oversize(client):
    r = client.post(
        "/v1/uploads/presign",
        json={
            "filename": "big.mp4",
            "content_type": "video/mp4",
            "size_bytes": 5 * 1024 * 1024 * 1024,  # 5GB > 4GB cap
        },
    )
    assert r.status_code == 422


@patch("app.api.uploads.presign_upload_url", return_value="https://r2.example/signed")
def test_presign_happy_path(mock_sign, client):
    r = client.post(
        "/v1/uploads/presign",
        json={
            "filename": "podcast.mp4",
            "content_type": "video/mp4",
            "size_bytes": 100_000_000,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["upload_url"] == "https://r2.example/signed"
    assert body["r2_key"].startswith("uploads/")
    assert "podcast.mp4" in body["r2_key"]


@patch("app.api.jobs.head_object", return_value=None)
def test_create_job_rejects_missing_upload(mock_head, client):
    """
    POST /v1/jobs hits ensure_quota_available before head_object — but with
    no DB in this smoke test, quota check would fail first. So we also
    patch the quota helper to be a no-op.
    """
    with patch("app.api.jobs.ensure_quota_available", return_value=None):
        r = client.post(
            "/v1/jobs",
            json={
                "source_filename": "podcast.mp4",
                "source_r2_key": "uploads/fake/key",
            },
        )
    assert r.status_code == 400
    # Phase 6: errors come in the standard envelope
    body = r.json()
    assert "error" in body
    assert body["error"]["code"] == "http_error"


@patch("app.api.jobs.enforce_rate_limit")  # bypass rate limits in this test
def test_list_jobs_returns_empty_paginated_shape(_, client):
    """GET /v1/jobs returns the paginated wrapper, not a bare list."""
    # We override the DB call site to return zero jobs
    from app.db.base import get_db

    async def _empty_db():
        # FastAPI generator-style dep — yields and returns
        class _FakeResult:
            def scalars(self):
                class _S:
                    def all(self_inner):
                        return []
                return _S()
        class _FakeSession:
            async def execute(self, *a, **kw):
                return _FakeResult()
        yield _FakeSession()

    app.dependency_overrides[get_db] = _empty_db
    try:
        r = client.get("/v1/jobs")
        assert r.status_code == 200
        body = r.json()
        assert "items" in body
        assert "next_cursor" in body
        assert body["items"] == []
        assert body["next_cursor"] is None
    finally:
        # Don't clobber the auth override fixture's cleanup
        app.dependency_overrides.pop(get_db, None)


def test_list_jobs_rejects_invalid_cursor(client):
    """Bad cursor → 400 with the standard error envelope."""
    from app.db.base import get_db

    async def _fake_db():
        # Any DB; this should never be queried because cursor parse fails first
        yield MagicMock()

    app.dependency_overrides[get_db] = _fake_db
    try:
        r = client.get("/v1/jobs?cursor=garbage!!!")
        assert r.status_code == 400
        body = r.json()
        assert body["error"]["message"] == "Invalid cursor"
    finally:
        app.dependency_overrides.pop(get_db, None)


@patch("app.api.jobs.enforce_rate_limit")  # bypass rate limits in this test
def test_list_jobs_returns_empty_paginated_shape(_, client):
    """GET /v1/jobs returns the paginated wrapper, not a bare list."""
    from app.db.base import get_db

    async def _empty_db():
        class _FakeResult:
            def scalars(self):
                class _S:
                    def all(self_inner):
                        return []
                return _S()
        class _FakeSession:
            async def execute(self, *a, **kw):
                return _FakeResult()
        yield _FakeSession()

    app.dependency_overrides[get_db] = _empty_db
    try:
        r = client.get("/v1/jobs")
        assert r.status_code == 200
        body = r.json()
        assert "items" in body
        assert "next_cursor" in body
        assert body["items"] == []
        assert body["next_cursor"] is None
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_list_jobs_rejects_invalid_cursor(client):
    """Bad cursor → 400 with the standard error envelope."""
    from app.db.base import get_db

    async def _fake_db():
        yield MagicMock()

    app.dependency_overrides[get_db] = _fake_db
    try:
        r = client.get("/v1/jobs?cursor=garbage!!!")
        assert r.status_code == 400
        body = r.json()
        assert body["error"]["message"] == "Invalid cursor"
    finally:
        app.dependency_overrides.pop(get_db, None)
