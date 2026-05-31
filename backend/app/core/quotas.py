"""
Plan tier quotas + usage tracking.

# Quota model

Each plan has a monthly minute allowance. We count minutes from the
`usage_minutes` ledger, filtered to the current billing period (YYYY-MM).
Usage is recorded *after* a job completes, not at create time — that way
failed jobs don't burn quota, which matches what customers expect.

# Quota check semantics

At job-create time we check: would processing this upload (if we knew
its length) push the org over their monthly limit? Problem: we don't
know duration until after upload+probe.

Solution: do a *soft* check at create time using `current_usage <
plan_limit`. If they're already over, reject. If they're under, allow
the job to proceed — even if the new file would push them well over.
The next job after that will be rejected. This matches Stripe's normal
metered billing model (slight overage tolerated, then hard stop).

For hard caps (block any overage), we'd need to probe duration at upload
time and reject before kicking the pipeline off. That's a Phase 6 polish.

# Watermark

Starter tier gets "Made with Clipper.ai" burned into clips. The renderer
checks the org's plan and skips the overlay for paid tiers.
"""

from datetime import datetime, timezone
from uuid import UUID

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Org, PlanTier, UsageMinute

log = structlog.get_logger()

# Monthly minute allowances per plan. Enterprise is unlimited.
PLAN_LIMITS_MINUTES: dict[PlanTier, int | None] = {
    PlanTier.STARTER: 60,
    PlanTier.STUDIO: 1000,
    PlanTier.SCALE: 10000,
    PlanTier.ENTERPRISE: None,  # unlimited
}

# Whether each tier shows a watermark in rendered clips.
WATERMARKED_TIERS = {PlanTier.STARTER}


def current_billing_period() -> str:
    """Return YYYY-MM for the current UTC month. Matches UsageMinute.billing_period."""
    now = datetime.now(timezone.utc)
    return f"{now.year:04d}-{now.month:02d}"


async def get_usage_minutes(
    org_id: UUID, period: str | None, db: AsyncSession
) -> int:
    """Sum the usage_minutes ledger for an org + month. 0 if no rows."""
    period = period or current_billing_period()
    result = await db.execute(
        select(func.coalesce(func.sum(UsageMinute.minutes), 0))
        .where(UsageMinute.org_id == org_id)
        .where(UsageMinute.billing_period == period)
    )
    return int(result.scalar() or 0)


async def get_quota_status(org: Org, db: AsyncSession) -> dict:
    """
    Build a summary of the org's current usage + plan limits.

    Used by the /v1/usage endpoint and by quota enforcement.
    """
    limit = PLAN_LIMITS_MINUTES.get(org.plan_tier)
    used = await get_usage_minutes(org.id, current_billing_period(), db)
    return {
        "plan": org.plan_tier.value,
        "billing_period": current_billing_period(),
        "minutes_used": used,
        "minutes_limit": limit,                # None = unlimited
        "minutes_remaining": (limit - used) if limit is not None else None,
        "watermarked": org.plan_tier in WATERMARKED_TIERS,
        "over_quota": limit is not None and used >= limit,
    }


async def ensure_quota_available(org: Org, db: AsyncSession) -> None:
    """
    Raise QuotaExceeded if the org is already at/over their plan's monthly limit.

    Called at job-create time. Note: this is a soft check (allows the
    current job through even if its duration would tip over). The next job
    after this one gets rejected.
    """
    status = await get_quota_status(org, db)
    if status["over_quota"]:
        raise QuotaExceeded(
            plan=status["plan"],
            used=status["minutes_used"],
            limit=status["minutes_limit"],
        )


async def record_usage(
    org_id: UUID, job_id: UUID, minutes: int, db: AsyncSession
) -> None:
    """
    Append a usage_minutes row after a job completes successfully.

    Idempotent-ish — caller should only call this once per job. We don't
    add a unique constraint on job_id because we may eventually charge
    for re-runs (different billing event).
    """
    if minutes <= 0:
        log.warning("record_usage_skipped_zero", job_id=str(job_id))
        return
    db.add(
        UsageMinute(
            org_id=org_id,
            job_id=job_id,
            minutes=minutes,
            billing_period=current_billing_period(),
        )
    )
    await db.commit()
    log.info(
        "usage_recorded", org_id=str(org_id), job_id=str(job_id), minutes=minutes
    )


class QuotaExceeded(Exception):
    """Raised when the org has used up their monthly minute allowance."""

    def __init__(self, plan: str, used: int, limit: int):
        self.plan = plan
        self.used = used
        self.limit = limit
        super().__init__(
            f"Quota exceeded for {plan}: used {used} of {limit} minutes this month"
        )
