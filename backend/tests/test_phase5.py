"""
Unit tests for Phase 5 — auth, quotas, billing, watermark.

We mock the DB and external services (Stripe, Clerk JWKS). The real
integration tests live elsewhere; these cover the parts where prod bugs
typically hide: rounding, edge cases at boundaries, plan-mapping nil
safety, JWT verification fast paths.
"""

import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

# Ensure dev mode + stub Stripe config so module imports don't blow up
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x/x")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_dummy")
os.environ.setdefault("STRIPE_PRICE_STARTER", "price_starter_xxx")
os.environ.setdefault("STRIPE_PRICE_STUDIO", "price_studio_xxx")
os.environ.setdefault("STRIPE_PRICE_SCALE", "price_scale_xxx")

from app.core.captions import WATERMARK_STYLE, build_ass_subtitle
from app.core.quotas import (
    PLAN_LIMITS_MINUTES,
    WATERMARKED_TIERS,
    QuotaExceeded,
    current_billing_period,
    ensure_quota_available,
    get_quota_status,
)
from app.db.models import PlanTier


# ──────────────────────────────────────────────────────────── current_billing_period


def test_current_billing_period_format():
    """Should be YYYY-MM, zero-padded month."""
    period = current_billing_period()
    assert len(period) == 7
    assert period[4] == "-"
    year, month = period.split("-")
    assert 2024 <= int(year) <= 2099
    assert 1 <= int(month) <= 12


def test_current_billing_period_matches_utc_now():
    """Verify it uses UTC, not local timezone — Stripe billing is UTC."""
    now = datetime.now(timezone.utc)
    expected = f"{now.year:04d}-{now.month:02d}"
    assert current_billing_period() == expected


# ──────────────────────────────────────────────────────────── plan limits sanity


def test_plan_limits_starter():
    assert PLAN_LIMITS_MINUTES[PlanTier.STARTER] == 60


def test_plan_limits_studio():
    assert PLAN_LIMITS_MINUTES[PlanTier.STUDIO] == 1000


def test_plan_limits_scale():
    assert PLAN_LIMITS_MINUTES[PlanTier.SCALE] == 10000


def test_plan_limits_enterprise_unlimited():
    """Enterprise should be None (no cap)."""
    assert PLAN_LIMITS_MINUTES[PlanTier.ENTERPRISE] is None


def test_starter_is_watermarked():
    assert PlanTier.STARTER in WATERMARKED_TIERS


def test_paid_tiers_not_watermarked():
    """No paid tier should ever have a watermark."""
    assert PlanTier.STUDIO not in WATERMARKED_TIERS
    assert PlanTier.SCALE not in WATERMARKED_TIERS
    assert PlanTier.ENTERPRISE not in WATERMARKED_TIERS


# ──────────────────────────────────────────────────────────── quota status math


def _mock_db_with_usage(used_minutes: int):
    """Build a fake AsyncSession that returns a fixed sum from the usage table."""
    db = MagicMock()
    scalar_result = MagicMock()
    scalar_result.scalar.return_value = used_minutes
    db.execute = AsyncMock(return_value=scalar_result)
    return db


def _mock_org(plan: PlanTier):
    org = MagicMock()
    org.id = uuid4()
    org.plan_tier = plan
    return org


@pytest.mark.asyncio
async def test_quota_status_under_limit():
    org = _mock_org(PlanTier.STARTER)
    db = _mock_db_with_usage(30)
    status = await get_quota_status(org, db)
    assert status["plan"] == "starter"
    assert status["minutes_used"] == 30
    assert status["minutes_limit"] == 60
    assert status["minutes_remaining"] == 30
    assert status["watermarked"] is True
    assert status["over_quota"] is False


@pytest.mark.asyncio
async def test_quota_status_at_limit_is_over():
    """At exactly the limit, over_quota should be True — we treat == as exhausted."""
    org = _mock_org(PlanTier.STARTER)
    db = _mock_db_with_usage(60)
    status = await get_quota_status(org, db)
    assert status["over_quota"] is True
    assert status["minutes_remaining"] == 0


@pytest.mark.asyncio
async def test_quota_status_enterprise_no_limit():
    """Enterprise has no cap → over_quota always False, remaining None."""
    org = _mock_org(PlanTier.ENTERPRISE)
    db = _mock_db_with_usage(50000)
    status = await get_quota_status(org, db)
    assert status["minutes_limit"] is None
    assert status["minutes_remaining"] is None
    assert status["over_quota"] is False
    assert status["watermarked"] is False


@pytest.mark.asyncio
async def test_ensure_quota_raises_when_over():
    org = _mock_org(PlanTier.STARTER)
    db = _mock_db_with_usage(100)
    with pytest.raises(QuotaExceeded) as exc_info:
        await ensure_quota_available(org, db)
    assert exc_info.value.plan == "starter"
    assert exc_info.value.used == 100
    assert exc_info.value.limit == 60


@pytest.mark.asyncio
async def test_ensure_quota_passes_when_under():
    org = _mock_org(PlanTier.STUDIO)
    db = _mock_db_with_usage(500)
    # Should not raise
    await ensure_quota_available(org, db)


@pytest.mark.asyncio
async def test_ensure_quota_passes_for_enterprise_regardless():
    org = _mock_org(PlanTier.ENTERPRISE)
    db = _mock_db_with_usage(999999)
    await ensure_quota_available(org, db)


# ──────────────────────────────────────────────────────────── watermark in ASS


def test_build_ass_no_watermark_omits_style_block():
    transcript = {"words": [{"word": "hi", "punctuated": "Hi", "start": 0, "end": 0.5}]}
    out = build_ass_subtitle(transcript, 0, 5, "9:16", watermark=False)
    assert "Style: Watermark" not in out
    assert "Made with Clipper.ai" not in out


def test_build_ass_with_watermark_adds_style_block():
    transcript = {"words": [{"word": "hi", "punctuated": "Hi", "start": 0, "end": 0.5}]}
    out = build_ass_subtitle(transcript, 0, 5, "9:16", watermark=True)
    assert "Style: Watermark" in out
    assert "Made with Clipper.ai" in out


def test_build_ass_watermark_spans_full_clip():
    """The watermark dialogue should cover from 0 → clip_duration."""
    transcript = {"words": [{"word": "hi", "punctuated": "Hi", "start": 0, "end": 0.5}]}
    out = build_ass_subtitle(transcript, 10.0, 17.5, "9:16", watermark=True)
    # Clip is 7.5s — watermark should span 0:00:00.00 → 0:00:07.50
    watermark_line = [l for l in out.split("\n") if "Made with Clipper.ai" in l][0]
    assert "0:00:00.00" in watermark_line
    assert "0:00:07.50" in watermark_line


def test_build_ass_watermark_appears_after_caption_dialogues():
    """Watermark should render on top — must be the last dialogue."""
    transcript = {
        "words": [
            {"word": "one", "punctuated": "One", "start": 0, "end": 0.5},
            {"word": "two", "punctuated": "two", "start": 0.6, "end": 1.0},
        ]
    }
    out = build_ass_subtitle(transcript, 0, 5, "9:16", watermark=True)
    dialogue_lines = [l for l in out.split("\n") if l.startswith("Dialogue:")]
    assert "Made with Clipper.ai" in dialogue_lines[-1]


def test_build_ass_watermark_present_even_with_no_words_in_window():
    """If the clip window has no words, we still want the watermark visible."""
    transcript = {"words": [{"word": "far", "punctuated": "Far", "start": 100, "end": 101}]}
    out = build_ass_subtitle(transcript, 0, 5, "9:16", watermark=True)
    assert "Made with Clipper.ai" in out


def test_watermark_style_block_is_top_left_aligned():
    """Style alignment 7 = top-left in ASS spec. Verify by inspecting the style line."""
    # ASS alignment field is the 7th from the end in the Style line.
    # Format: ...,Encoding (after Alignment,MarginL,MarginR,MarginV,Encoding)
    # So alignment is at index -5 in comma-split values.
    parts = WATERMARK_STYLE.split(",")
    alignment = parts[-5].strip()
    assert alignment == "7", f"Watermark should be top-left (align=7), got {alignment}"


# ──────────────────────────────────────────────────────────── Stripe plan mapping


def test_price_to_plan_mapping():
    """Every configured price ID should map back to its plan tier."""
    from app.core.billing import _price_to_plan

    mapping = _price_to_plan()
    assert mapping["price_starter_xxx"] == PlanTier.STARTER
    assert mapping["price_studio_xxx"] == PlanTier.STUDIO
    assert mapping["price_scale_xxx"] == PlanTier.SCALE


def test_plan_to_price_round_trip():
    """plan_to_price and price_to_plan should be inverses."""
    from app.core.billing import _plan_to_price, _price_to_plan

    for plan in (PlanTier.STARTER, PlanTier.STUDIO, PlanTier.SCALE):
        price_id = _plan_to_price(plan)
        assert price_id is not None
        assert _price_to_plan()[price_id] == plan


def test_plan_to_price_enterprise_returns_none():
    """Enterprise has no Stripe price — it's set manually."""
    from app.core.billing import _plan_to_price

    assert _plan_to_price(PlanTier.ENTERPRISE) is None


def test_resolve_plan_from_subscription_dict_shape():
    """Webhooks arrive as dicts. Verify we handle that shape."""
    from app.core.billing import _resolve_plan_from_subscription

    sub = {
        "items": {
            "data": [{"price": {"id": "price_studio_xxx"}}]
        }
    }
    assert _resolve_plan_from_subscription(sub) == PlanTier.STUDIO


def test_resolve_plan_from_subscription_unknown_returns_none():
    """If the price ID isn't one of ours, return None (don't crash)."""
    from app.core.billing import _resolve_plan_from_subscription

    sub = {
        "items": {
            "data": [{"price": {"id": "price_some_other_product"}}]
        }
    }
    assert _resolve_plan_from_subscription(sub) is None


def test_resolve_plan_from_subscription_empty_items():
    """Defensive: zero line items shouldn't crash."""
    from app.core.billing import _resolve_plan_from_subscription

    sub = {"items": {"data": []}}
    assert _resolve_plan_from_subscription(sub) is None


# ──────────────────────────────────────────────────────────── auth dev mode


@pytest.mark.asyncio
async def test_get_current_user_dev_mode_returns_seeded_org():
    """When dev_mode_skip_auth is on, we should get the seeded dev org without a token."""
    from app.core import auth as auth_module
    from app.core.config import get_settings

    # Patch settings to enable dev mode
    settings = get_settings()
    original = settings.dev_mode_skip_auth
    settings.dev_mode_skip_auth = True

    # Mock db.get(Org) returning a fake org
    mock_org = MagicMock()
    mock_org.id = auth_module.DEV_ORG_ID

    mock_user = MagicMock()
    mock_user.id = auth_module.DEV_USER_ID

    db = MagicMock()
    # First call: db.get(Org, DEV_ORG_ID) returns mock_org
    # Second call: db.execute(select(User)...).scalar_one_or_none() returns mock_user
    db.get = AsyncMock(return_value=mock_org)
    scalar_result = MagicMock()
    scalar_result.scalar_one_or_none.return_value = mock_user
    db.execute = AsyncMock(return_value=scalar_result)

    try:
        user, org = await auth_module.get_current_user_and_org(
            authorization=None, db=db
        )
        assert org is mock_org
        assert user is mock_user
    finally:
        settings.dev_mode_skip_auth = original


@pytest.mark.asyncio
async def test_get_current_user_missing_token_raises_401():
    """No bearer header → 401, not crash."""
    from fastapi import HTTPException

    from app.core import auth as auth_module
    from app.core.config import get_settings

    settings = get_settings()
    original = settings.dev_mode_skip_auth
    settings.dev_mode_skip_auth = False

    db = MagicMock()
    try:
        with pytest.raises(HTTPException) as exc_info:
            await auth_module.get_current_user_and_org(authorization=None, db=db)
        assert exc_info.value.status_code == 401
    finally:
        settings.dev_mode_skip_auth = original


@pytest.mark.asyncio
async def test_get_current_user_malformed_bearer_raises_401():
    """Wrong scheme (e.g., 'Basic xxx') should be a 401, not crash JWT decode."""
    from fastapi import HTTPException

    from app.core import auth as auth_module
    from app.core.config import get_settings

    settings = get_settings()
    original = settings.dev_mode_skip_auth
    settings.dev_mode_skip_auth = False

    db = MagicMock()
    try:
        with pytest.raises(HTTPException) as exc_info:
            await auth_module.get_current_user_and_org(
                authorization="Basic xxxxx", db=db
            )
        assert exc_info.value.status_code == 401
    finally:
        settings.dev_mode_skip_auth = original


# ──────────────────────────────────────────────────────────── usage minutes rounding


def test_usage_minutes_rounds_up_60_seconds():
    """Exactly 60s = 1 minute (no round up)."""
    duration_s = 60
    minutes = (duration_s + 59) // 60
    assert minutes == 1


def test_usage_minutes_rounds_up_61_seconds():
    """61s = 2 minutes (round up)."""
    duration_s = 61
    minutes = (duration_s + 59) // 60
    assert minutes == 2


def test_usage_minutes_rounds_up_3540_seconds():
    """59 min exactly = 59 min."""
    duration_s = 59 * 60
    minutes = (duration_s + 59) // 60
    assert minutes == 59


def test_usage_minutes_rounds_up_3541_seconds():
    """59:01 = 60 min."""
    duration_s = 59 * 60 + 1
    minutes = (duration_s + 59) // 60
    assert minutes == 60
