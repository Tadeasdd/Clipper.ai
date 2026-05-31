"""
Per-org rate limiting.

# Why

A malicious or buggy client with a valid JWT can hammer expensive endpoints
(POST /v1/jobs, POST /v1/uploads/presign) and either:
    a) burn through Anthropic/Deepgram credits before the quota check
       catches up (LLM calls happen async in the Inngest worker, but the
       create_job endpoint kicks them off as fast as it's hit)
    b) flood R2 with presigned URL handouts

# Algorithm

Standard token bucket per (org_id, endpoint_group). Each org gets a
configurable refill rate; bursts up to bucket capacity are allowed.

# Storage

In-memory dict keyed by org_id. Works fine for a single API replica.

If/when we scale to multiple replicas, swap the backing store for Redis
(an INCR with a TTL is the standard recipe). The TokenBucket class stays
identical, _BUCKETS gets replaced with a Redis-backed dict-like.

# Endpoint groups

We group endpoints by cost rather than path so the budget makes sense:
    - "expensive": POST /v1/jobs, POST /v1/uploads/presign (10/min default)
    - "read": GET /v1/jobs, GET /v1/usage (60/min default)
    - "billing": POST /v1/billing/* (5/min default — prevents portal abuse)
"""

import time
from dataclasses import dataclass, field
from uuid import UUID

import structlog
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.db.models import PlanTier

log = structlog.get_logger()


# Per-tier multipliers — higher plans get more headroom.
# (capacity, refill_per_minute) per endpoint group.
_BASE_LIMITS = {
    "expensive": (10, 10),   # 10 burst, 10/min refill
    "read":      (60, 60),
    "billing":   (5, 5),
}

# Paid tiers get 5x the budget. Enterprise gets 50x (effectively unlimited at API edge).
_TIER_MULTIPLIERS = {
    PlanTier.STARTER: 1,
    PlanTier.STUDIO: 5,
    PlanTier.SCALE: 5,
    PlanTier.ENTERPRISE: 50,
}


@dataclass
class TokenBucket:
    """A single bucket. Mutable — updated in place under the GIL (no lock needed
    for single-process Python; if we ever go to threads we'd add one)."""

    capacity: float
    refill_per_second: float
    tokens: float = field(init=False)
    last_refill: float = field(init=False)

    def __post_init__(self):
        self.tokens = float(self.capacity)
        self.last_refill = time.monotonic()

    def try_consume(self, n: float = 1.0) -> bool:
        """Refill based on elapsed time, then try to take `n` tokens. Returns True if allowed."""
        now = time.monotonic()
        elapsed = now - self.last_refill
        if elapsed > 0:
            self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_per_second)
            self.last_refill = now
        if self.tokens >= n:
            self.tokens -= n
            return True
        return False

    def retry_after_seconds(self, n: float = 1.0) -> float:
        """Seconds until enough tokens exist for `n` to be consumed."""
        deficit = n - self.tokens
        if deficit <= 0:
            return 0.0
        return deficit / self.refill_per_second


# Bucket store. Key: (org_id, group). Lazily created on first hit per org.
# To swap for Redis, replace this dict + the get/create logic in _get_bucket.
_BUCKETS: dict[tuple[UUID, str], TokenBucket] = {}


def _get_bucket(org_id: UUID, group: str, plan: PlanTier) -> TokenBucket:
    key = (org_id, group)
    bucket = _BUCKETS.get(key)
    if bucket is not None:
        return bucket

    cap, per_min = _BASE_LIMITS[group]
    mult = _TIER_MULTIPLIERS.get(plan, 1)
    bucket = TokenBucket(
        capacity=cap * mult,
        refill_per_second=(per_min * mult) / 60.0,
    )
    _BUCKETS[key] = bucket
    return bucket


def enforce_rate_limit(org_id: UUID, plan: PlanTier, group: str) -> None:
    """
    Raise 429 if the org is over their rate limit for this endpoint group.

    Adds a `Retry-After` header value (in the exception detail) so clients
    can back off cleanly.
    """
    if not get_settings().rate_limit_enabled:
        return

    if group not in _BASE_LIMITS:
        log.warning("rate_limit_unknown_group", group=group)
        return

    bucket = _get_bucket(org_id, group, plan)
    if bucket.try_consume():
        return

    retry_after = bucket.retry_after_seconds()
    log.info(
        "rate_limited",
        org_id=str(org_id),
        group=group,
        plan=plan.value,
        retry_after_s=round(retry_after, 1),
    )
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "error": "rate_limited",
            "message": f"Too many requests. Retry in {retry_after:.0f}s.",
            "retry_after_seconds": round(retry_after, 1),
            "endpoint_group": group,
        },
        headers={"Retry-After": str(int(retry_after) + 1)},
    )


def reset_buckets_for_tests() -> None:
    """Clear all buckets — for tests only."""
    _BUCKETS.clear()
