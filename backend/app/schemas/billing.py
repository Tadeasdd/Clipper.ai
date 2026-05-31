"""Pydantic schemas for Phase 5 — billing + usage endpoints."""

from pydantic import BaseModel, Field

from app.db.models import PlanTier


class CheckoutRequest(BaseModel):
    """Request to start a Stripe Checkout session for a plan upgrade."""

    plan: PlanTier = Field(..., description="Plan tier to subscribe to")


class CheckoutResponse(BaseModel):
    url: str = Field(..., description="Stripe Checkout URL — redirect the browser here")


class PortalResponse(BaseModel):
    url: str = Field(..., description="Stripe customer portal URL")


class UsageResponse(BaseModel):
    """Current month's usage + plan limits."""

    plan: str
    billing_period: str = Field(..., description="YYYY-MM")
    minutes_used: int
    minutes_limit: int | None = Field(
        None, description="None means unlimited (enterprise)"
    )
    minutes_remaining: int | None = None
    watermarked: bool
    over_quota: bool
