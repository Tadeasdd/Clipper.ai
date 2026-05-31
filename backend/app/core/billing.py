"""
Stripe billing integration.

# How billing works

Each Org has one Stripe Customer (created lazily on first checkout) and
optionally one Subscription (per active plan). The subscription's price
ID determines the plan tier.

# Checkout flow

    1. User clicks "Upgrade to Studio" in the frontend
    2. POST /v1/billing/checkout — we create a Checkout Session and return URL
    3. User completes payment on Stripe-hosted page
    4. Stripe sends `checkout.session.completed` webhook to us
    5. We flip org.plan_tier based on the price ID in the subscription

# Plan changes

When a user upgrades or downgrades via the Customer Portal:
    1. Stripe sends `customer.subscription.updated` webhook
    2. We look up the new price ID and update org.plan_tier accordingly

# Cancellations

    1. Stripe sends `customer.subscription.deleted` webhook
    2. We drop the org back to STARTER (they keep their data, just lose quota)

# Webhook security

Stripe signs every webhook with HMAC-SHA256. We verify the signature
before doing anything. If verification fails → 400. No idempotency keys
needed — Stripe webhook delivery is at-least-once, but our updates are
idempotent (same price → same plan).
"""

from uuid import UUID

import stripe
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models import Org, PlanTier

log = structlog.get_logger()

# Initialize the Stripe library — module-level so it picks up the API key once.
# Defer reading settings to first use so tests can override.
_initialized = False


def _ensure_stripe_initialized() -> None:
    global _initialized
    if _initialized:
        return
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise RuntimeError("STRIPE_SECRET_KEY not configured")
    stripe.api_key = settings.stripe_secret_key
    _initialized = True


# Map our price IDs back to plan tiers. Built lazily so settings are populated.
def _price_to_plan() -> dict[str, PlanTier]:
    settings = get_settings()
    mapping: dict[str, PlanTier] = {}
    if settings.stripe_price_starter:
        mapping[settings.stripe_price_starter] = PlanTier.STARTER
    if settings.stripe_price_studio:
        mapping[settings.stripe_price_studio] = PlanTier.STUDIO
    if settings.stripe_price_scale:
        mapping[settings.stripe_price_scale] = PlanTier.SCALE
    return mapping


def _plan_to_price(plan: PlanTier) -> str | None:
    settings = get_settings()
    return {
        PlanTier.STARTER: settings.stripe_price_starter,
        PlanTier.STUDIO: settings.stripe_price_studio,
        PlanTier.SCALE: settings.stripe_price_scale,
    }.get(plan)


# ──────────────────────────────────────────────────────────── CUSTOMER ENSURE


async def ensure_stripe_customer(org: Org, user_email: str, db: AsyncSession) -> str:
    """
    Get or create the Stripe Customer for an org. Returns the customer ID.

    We lazily create the customer on first billing action rather than at
    signup — keeps the signup path Stripe-free and avoids creating customers
    for users who never upgrade.
    """
    _ensure_stripe_initialized()
    if org.stripe_customer_id:
        return org.stripe_customer_id

    customer = stripe.Customer.create(
        email=user_email,
        metadata={"org_id": str(org.id)},
        name=org.name,
    )
    org.stripe_customer_id = customer.id
    await db.commit()
    log.info("stripe_customer_created", org_id=str(org.id), customer_id=customer.id)
    return customer.id


# ──────────────────────────────────────────────────────────── CHECKOUT


async def create_checkout_session(
    org: Org, user_email: str, plan: PlanTier, db: AsyncSession
) -> str:
    """
    Create a Stripe Checkout Session for the requested plan. Returns the URL.

    The frontend should redirect the user's browser to this URL.
    """
    _ensure_stripe_initialized()
    settings = get_settings()

    price_id = _plan_to_price(plan)
    if not price_id:
        raise ValueError(f"No Stripe price configured for plan {plan.value}")

    customer_id = await ensure_stripe_customer(org, user_email, db)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=settings.stripe_checkout_success_url,
        cancel_url=settings.stripe_checkout_cancel_url,
        # Pass org_id so the webhook can find us even if Stripe drops customer linkage
        metadata={"org_id": str(org.id), "plan": plan.value},
        subscription_data={
            "metadata": {"org_id": str(org.id), "plan": plan.value},
        },
    )
    log.info(
        "checkout_session_created",
        org_id=str(org.id),
        plan=plan.value,
        session_id=session.id,
    )
    return session.url


# ──────────────────────────────────────────────────────────── BILLING PORTAL


async def create_portal_session(org: Org, user_email: str, db: AsyncSession) -> str:
    """Open the Stripe-hosted customer portal so the user can manage their subscription."""
    _ensure_stripe_initialized()
    settings = get_settings()

    customer_id = await ensure_stripe_customer(org, user_email, db)
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=settings.stripe_checkout_success_url,
    )
    return session.url


# ──────────────────────────────────────────────────────────── WEBHOOK


def verify_webhook_signature(payload: bytes, signature: str) -> stripe.Event:
    """
    Validate the Stripe webhook signature and parse the event.

    Raises ValueError on bad signature — caller should return 400.
    """
    _ensure_stripe_initialized()
    settings = get_settings()
    if not settings.stripe_webhook_secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET not configured")
    try:
        return stripe.Webhook.construct_event(
            payload, signature, settings.stripe_webhook_secret
        )
    except stripe.error.SignatureVerificationError as e:
        raise ValueError(f"Invalid signature: {e}") from e


async def handle_webhook_event(event: stripe.Event, db: AsyncSession) -> None:
    """
    Dispatch a verified Stripe event to the right handler.

    We only handle the events we care about. Stripe sends ~50 different
    event types; the rest get ignored (HTTP 200 with no action).
    """
    etype = event["type"]
    data = event["data"]["object"]

    if etype == "checkout.session.completed":
        await _handle_checkout_completed(data, db)
    elif etype == "customer.subscription.updated":
        await _handle_subscription_changed(data, db)
    elif etype == "customer.subscription.deleted":
        await _handle_subscription_canceled(data, db)
    else:
        log.debug("stripe_webhook_ignored", event_type=etype)


async def _handle_checkout_completed(session: dict, db: AsyncSession) -> None:
    """User just finished checkout → activate the subscription on their org."""
    org_id_str = (session.get("metadata") or {}).get("org_id")
    subscription_id = session.get("subscription")
    if not org_id_str or not subscription_id:
        log.warning("checkout_missing_metadata", session_id=session.get("id"))
        return

    try:
        org_id = UUID(org_id_str)
    except ValueError:
        log.error("checkout_bad_org_id", org_id=org_id_str)
        return

    org = await db.get(Org, org_id)
    if org is None:
        log.error("checkout_org_not_found", org_id=org_id_str)
        return

    # Look up the actual subscription to find the price ID
    sub = stripe.Subscription.retrieve(subscription_id)
    new_plan = _resolve_plan_from_subscription(sub)
    if new_plan is None:
        log.warning("checkout_no_plan_matched", subscription_id=subscription_id)
        return

    org.plan_tier = new_plan
    org.stripe_subscription_id = subscription_id
    await db.commit()
    log.info(
        "org_plan_activated",
        org_id=str(org_id),
        plan=new_plan.value,
        subscription_id=subscription_id,
    )


async def _handle_subscription_changed(subscription: dict, db: AsyncSession) -> None:
    """User upgraded/downgraded via the customer portal → update plan_tier."""
    subscription_id = subscription.get("id")
    if not subscription_id:
        return

    result = await db.execute(
        select(Org).where(Org.stripe_subscription_id == subscription_id)
    )
    org = result.scalar_one_or_none()
    if org is None:
        log.warning("subscription_updated_org_not_found", subscription_id=subscription_id)
        return

    new_plan = _resolve_plan_from_subscription(subscription)
    if new_plan is None or new_plan == org.plan_tier:
        return

    log.info(
        "org_plan_changed",
        org_id=str(org.id),
        from_plan=org.plan_tier.value,
        to_plan=new_plan.value,
    )
    org.plan_tier = new_plan
    await db.commit()


async def _handle_subscription_canceled(subscription: dict, db: AsyncSession) -> None:
    """User canceled → drop org back to STARTER (they keep their data + history)."""
    subscription_id = subscription.get("id")
    if not subscription_id:
        return

    result = await db.execute(
        select(Org).where(Org.stripe_subscription_id == subscription_id)
    )
    org = result.scalar_one_or_none()
    if org is None:
        return

    org.plan_tier = PlanTier.STARTER
    org.stripe_subscription_id = None
    await db.commit()
    log.info("org_subscription_canceled", org_id=str(org.id))


def _resolve_plan_from_subscription(subscription) -> PlanTier | None:
    """Inspect the subscription's line items to find which of our prices it maps to."""
    # subscription can be a dict (from webhook) or a stripe.Subscription
    items = (
        subscription["items"]["data"]
        if isinstance(subscription, dict)
        else subscription.items.data
    )
    price_map = _price_to_plan()
    for item in items:
        price_id = item["price"]["id"] if isinstance(item, dict) else item.price.id
        if price_id in price_map:
            return price_map[price_id]
    return None
