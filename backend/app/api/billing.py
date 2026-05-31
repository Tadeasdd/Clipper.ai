"""
Phase 5: Billing + usage endpoints.

    POST /v1/billing/checkout    → start a Stripe Checkout session
    POST /v1/billing/portal      → open customer portal
    POST /v1/billing/webhook     → Stripe webhook receiver
    GET  /v1/usage               → current month usage + limits
"""

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_and_org
from app.core.billing import (
    create_checkout_session,
    create_portal_session,
    handle_webhook_event,
    verify_webhook_signature,
)
from app.core.quotas import get_quota_status
from app.core.rate_limit import enforce_rate_limit
from app.db.base import get_db
from app.db.models import ProcessedWebhook
from app.schemas.billing import (
    CheckoutRequest,
    CheckoutResponse,
    PortalResponse,
    UsageResponse,
)

log = structlog.get_logger()
router = APIRouter(tags=["billing"])


@router.post(
    "/v1/billing/checkout",
    response_model=CheckoutResponse,
    status_code=status.HTTP_200_OK,
)
async def billing_checkout(
    req: CheckoutRequest,
    auth: tuple = Depends(get_current_user_and_org),
    db: AsyncSession = Depends(get_db),
):
    """Start a Stripe Checkout session for the requested plan."""
    user, org = auth
    enforce_rate_limit(org.id, org.plan_tier, "billing")
    try:
        url = await create_checkout_session(org, user.email, req.plan, db)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    return CheckoutResponse(url=url)


@router.post(
    "/v1/billing/portal",
    response_model=PortalResponse,
    status_code=status.HTTP_200_OK,
)
async def billing_portal(
    auth: tuple = Depends(get_current_user_and_org),
    db: AsyncSession = Depends(get_db),
):
    """Open the Stripe-hosted customer portal so the user can manage their subscription."""
    user, org = auth
    enforce_rate_limit(org.id, org.plan_tier, "billing")
    url = await create_portal_session(org, user.email, db)
    return PortalResponse(url=url)


@router.post("/v1/billing/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(None, alias="Stripe-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Receive Stripe webhook events. Verifies HMAC signature, dedupes by event ID,
    then dispatches to the handler.

    Stripe expects 2xx within a few seconds or it'll retry. We do the work
    inline since it's just a DB update — if it ever gets slow, push to Inngest.
    """
    if not stripe_signature:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing Stripe-Signature header")

    payload = await request.body()
    try:
        event = verify_webhook_signature(payload, stripe_signature)
    except ValueError as e:
        log.warning("stripe_webhook_bad_signature", error=str(e))
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid signature")

    # Idempotency: skip if we've already processed this event ID.
    # The UniqueConstraint on (provider, event_id) is the race-safe lock.
    event_id = event["id"]
    event_type = event["type"]

    existing = await db.execute(
        select(ProcessedWebhook).where(
            ProcessedWebhook.provider == "stripe",
            ProcessedWebhook.event_id == event_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        log.info("stripe_webhook_replay_ignored", event_id=event_id, event_type=event_type)
        return Response(status_code=status.HTTP_200_OK)

    # Attempt to record + handle. If the insert races against another worker
    # processing the same event, the UniqueConstraint catches it.
    try:
        db.add(
            ProcessedWebhook(
                provider="stripe", event_id=event_id, event_type=event_type
            )
        )
        await db.flush()
    except IntegrityError:
        await db.rollback()
        log.info("stripe_webhook_race_lost", event_id=event_id)
        return Response(status_code=status.HTTP_200_OK)

    try:
        await handle_webhook_event(event, db)
        await db.commit()
    except Exception:
        # Roll back BOTH the ProcessedWebhook insert AND any partial handler
        # changes so Stripe retries safely. Log but return 2xx — handler bugs
        # shouldn't cause endless retries from Stripe's side. (For genuine
        # transient errors we'd want 5xx, but at the volume Stripe sends
        # us, exception-class triage isn't worth the complexity yet.)
        await db.rollback()
        log.exception("stripe_webhook_handler_failed", event_type=event_type)

    return Response(status_code=status.HTTP_200_OK)


@router.get("/v1/usage", response_model=UsageResponse)
async def get_usage(
    auth: tuple = Depends(get_current_user_and_org),
    db: AsyncSession = Depends(get_db),
):
    """Current month's usage + plan limits for the authenticated org."""
    _, org = auth
    enforce_rate_limit(org.id, org.plan_tier, "read")
    status_dict = await get_quota_status(org, db)
    return UsageResponse(**status_dict)
