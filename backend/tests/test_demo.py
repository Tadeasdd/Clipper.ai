"""
Phase MVP — demo mode auth bypass + feedback capture.

Follows the established pattern: call handlers directly with AsyncMock-backed
DB mocks rather than spinning a real Postgres. Auth/settings are patched at
the module boundary where each handler looks them up.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.rate_limit import reset_buckets_for_tests
from app.db.models import Feedback, Org, PlanTier, User
from app.schemas.feedback import FeedbackCreateRequest


# ──────────────────────────────────────────────────────────── config property


def test_skip_clerk_auth_property():
    from app.core.config import Settings

    assert Settings(database_url="x", demo_mode=True).skip_clerk_auth is True
    assert Settings(database_url="x", dev_mode_skip_auth=True).skip_clerk_auth is True
    assert Settings(database_url="x").skip_clerk_auth is False


# ──────────────────────────────────────────────────────────── demo-mode auth


@pytest.mark.asyncio
async def test_demo_mode_resolves_seeded_demo_org():
    from app.core.auth import DEMO_ORG_ID, DEMO_USER_ID, get_current_user_and_org

    demo_org = Org(id=DEMO_ORG_ID, name="Clipper Demo", plan_tier=PlanTier.ENTERPRISE)
    demo_user = User(
        id=DEMO_USER_ID, org_id=DEMO_ORG_ID, email="demo@clipper.ai", clerk_user_id="demo_user"
    )
    db = MagicMock()
    db.get = AsyncMock(
        side_effect=lambda model, pk: demo_org if pk == DEMO_ORG_ID else demo_user
    )
    db.execute = AsyncMock()  # should NOT be used on the demo path

    with patch(
        "app.core.auth.get_settings",
        return_value=MagicMock(demo_mode=True, dev_mode_skip_auth=False),
    ):
        user, org = await get_current_user_and_org(authorization=None, db=db)

    assert org.id == DEMO_ORG_ID
    assert user.id == DEMO_USER_ID
    assert org.plan_tier == PlanTier.ENTERPRISE  # 50x rate-limit headroom
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_demo_mode_takes_precedence_over_dev_mode():
    """Both flags on → demo workspace wins (the labelled, seeded one)."""
    from app.core.auth import DEMO_ORG_ID, DEMO_USER_ID, get_current_user_and_org

    demo_org = Org(id=DEMO_ORG_ID, name="Clipper Demo", plan_tier=PlanTier.ENTERPRISE)
    demo_user = User(id=DEMO_USER_ID, org_id=DEMO_ORG_ID, email="demo@clipper.ai", clerk_user_id="d")
    db = MagicMock()
    db.get = AsyncMock(side_effect=lambda m, pk: demo_org if pk == DEMO_ORG_ID else demo_user)
    db.execute = AsyncMock()

    with patch(
        "app.core.auth.get_settings",
        return_value=MagicMock(demo_mode=True, dev_mode_skip_auth=True),
    ):
        _, org = await get_current_user_and_org(authorization=None, db=db)

    assert org.id == DEMO_ORG_ID
    db.execute.assert_not_called()  # dev path (which uses execute) never ran


@pytest.mark.asyncio
async def test_demo_mode_unseeded_fails_loudly():
    from app.core.auth import get_current_user_and_org

    db = MagicMock()
    db.get = AsyncMock(return_value=None)  # migration not run
    with patch(
        "app.core.auth.get_settings",
        return_value=MagicMock(demo_mode=True, dev_mode_skip_auth=False),
    ):
        with pytest.raises(HTTPException) as exc:
            await get_current_user_and_org(authorization=None, db=db)
    assert exc.value.status_code == 500


# ──────────────────────────────────────────────────────────── feedback schema


def test_feedback_rejects_empty_submission():
    with pytest.raises(ValidationError):
        FeedbackCreateRequest()
    with pytest.raises(ValidationError):
        FeedbackCreateRequest(message="   ")  # whitespace doesn't count


def test_feedback_accepts_rating_or_message_or_both():
    FeedbackCreateRequest(rating=4)
    FeedbackCreateRequest(message="the clips are weirdly good")
    FeedbackCreateRequest(rating=5, message="nice", email="f@founder.com")


def test_feedback_rating_bounds():
    with pytest.raises(ValidationError):
        FeedbackCreateRequest(rating=0)
    with pytest.raises(ValidationError):
        FeedbackCreateRequest(rating=6)


# ──────────────────────────────────────────────────────────── feedback create


@pytest.mark.asyncio
async def test_create_feedback_persists_and_returns():
    from app.api.feedback import create_feedback

    org = Org(id=uuid4(), name="demo", plan_tier=PlanTier.ENTERPRISE)
    user = User(id=uuid4(), org_id=org.id, email="d@d", clerk_user_id="d")
    db = MagicMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    req = FeedbackCreateRequest(rating=5, message="clips are great", email="f@founder.com")
    reset_buckets_for_tests()
    result = await create_feedback(req=req, auth=(user, org), db=db)

    db.add.assert_called_once()
    db.commit.assert_awaited_once()
    assert result.rating == 5
    assert result.message == "clips are great"
    assert result.org_id == org.id


# ──────────────────────────────────────────────────────────── feedback list (admin)


@pytest.mark.asyncio
async def test_list_feedback_404_when_admin_token_unset():
    from app.api.feedback import list_feedback

    with patch("app.api.feedback.get_settings", return_value=MagicMock(admin_token="")):
        with pytest.raises(HTTPException) as exc:
            await list_feedback(x_admin_token=None, db=MagicMock())
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_list_feedback_403_on_wrong_token():
    from app.api.feedback import list_feedback

    with patch("app.api.feedback.get_settings", return_value=MagicMock(admin_token="secret")):
        with pytest.raises(HTTPException) as exc:
            await list_feedback(x_admin_token="nope", db=MagicMock())
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_list_feedback_returns_rows_with_valid_token():
    from app.api.feedback import list_feedback

    fb = Feedback(
        id=uuid4(),
        org_id=uuid4(),
        rating=5,
        message="great",
        email=None,
        created_at=datetime.now(timezone.utc),
    )
    db = MagicMock()
    db.execute = AsyncMock(
        side_effect=[
            MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[fb])))),
            MagicMock(scalar_one=MagicMock(return_value=1)),
        ]
    )
    with patch("app.api.feedback.get_settings", return_value=MagicMock(admin_token="secret")):
        result = await list_feedback(x_admin_token="secret", db=db)

    assert result.total == 1
    assert len(result.items) == 1
    assert result.items[0].rating == 5
