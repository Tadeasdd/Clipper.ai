"""
Clerk authentication.

We verify Clerk-issued JWTs locally using their JWKS endpoint (cached) so
auth doesn't add a network roundtrip per request. The Authorization header
is expected to be `Bearer <clerk_session_token>`.

# Flow per request

    1. Extract Bearer token from header
    2. Fetch + cache JWKS (~30min TTL — Clerk rotates keys rarely)
    3. Decode + verify JWT signature + claims (iss, exp)
    4. Look up the User row by clerk_user_id, or create it on first sign-in
    5. Return (User, Org) for the route handler

# Dev mode

When settings.dev_mode_skip_auth is True, we bypass all of this and return
the dev org seeded by the initial migration. This is for local dev without
a Clerk account. Never enable in production — there's an assertion check
at startup that screams if DEV mode + non-localhost env vars line up.
"""

import time
from typing import Optional
from uuid import UUID

import httpx
import jwt
import structlog
from cachetools import TTLCache
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.base import get_db
from app.db.models import Org, PlanTier, User

log = structlog.get_logger()

# Cache JWKS keys for 30 minutes. Clerk rarely rotates; this saves
# a network call per request without risking stale keys after rotation.
_JWKS_CACHE: TTLCache = TTLCache(maxsize=1, ttl=1800)

# DEV mode org UUID — must match what's seeded in 0001_initial.py migration.
DEV_ORG_ID = UUID("00000000-0000-0000-0000-000000000001")
DEV_USER_ID = UUID("00000000-0000-0000-0000-000000000002")

# DEMO mode org/user — seeded in 0004_demo_and_feedback.py. Distinct from DEV
# so a public demo deployment has its own clearly-labelled workspace, and so
# the showcase jobs from seed_demo.py have a stable home that every visitor
# shares.
DEMO_ORG_ID = UUID("00000000-0000-0000-0000-0000000000d0")
DEMO_USER_ID = UUID("00000000-0000-0000-0000-0000000000d1")


def _get_jwks_client() -> PyJWKClient:
    """Get a cached PyJWKClient — handles the JWKS HTTP fetch + key parsing."""
    cached = _JWKS_CACHE.get("client")
    if cached is not None:
        return cached
    settings = get_settings()
    if not settings.clerk_jwks_url:
        raise RuntimeError("CLERK_JWKS_URL not configured")
    client = PyJWKClient(settings.clerk_jwks_url, cache_keys=True)
    _JWKS_CACHE["client"] = client
    return client


def _verify_token(token: str) -> dict:
    """
    Verify a Clerk JWT and return its claims.

    Raises 401 if signature is bad, expired, or issuer mismatches.
    """
    settings = get_settings()
    try:
        jwks_client = _get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer or None,
            options={"verify_aud": False},  # Clerk doesn't always set aud
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidTokenError as e:
        log.warning("jwt_invalid", error=str(e))
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}")


async def _get_or_create_user(
    claims: dict, db: AsyncSession
) -> tuple[User, Org]:
    """
    Resolve a verified Clerk JWT to (User, Org) — creating both if this is
    the user's first sign-in.

    Clerk's standard claim set:
        sub        — Clerk user ID (stable)
        email      — primary email
        name       — full name (may be missing)
    """
    clerk_user_id = claims.get("sub")
    if not clerk_user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing sub claim")

    # Try to find existing user
    result = await db.execute(
        select(User).where(User.clerk_user_id == clerk_user_id)
    )
    user = result.scalar_one_or_none()
    if user is not None:
        org = await db.get(Org, user.org_id)
        if org is None:
            # Shouldn't happen — orphaned user. Treat as auth error and let
            # the user re-onboard.
            log.error("orphaned_user", user_id=str(user.id))
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User org missing")
        return user, org

    # First sign-in — create org + user atomically.
    # The Org name defaults to the user's email until they rename it from the UI.
    email = claims.get("email") or f"{clerk_user_id}@unknown"
    name = claims.get("name") or claims.get("first_name") or email.split("@")[0]

    org = Org(name=f"{name}'s workspace", plan_tier=PlanTier.STARTER)
    db.add(org)
    await db.flush()

    user = User(
        org_id=org.id,
        clerk_user_id=clerk_user_id,
        email=email,
        name=name,
    )
    db.add(user)
    await db.commit()
    log.info("user_onboarded", user_id=str(user.id), org_id=str(org.id), email=email)
    return user, org


async def _dev_user_and_org(db: AsyncSession) -> tuple[User, Org]:
    """Return the seeded dev org + a dev user, for local dev when Clerk is bypassed."""
    org = await db.get(Org, DEV_ORG_ID)
    if org is None:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Dev mode enabled but dev org not seeded — run alembic upgrade head",
        )
    # Look up or stub a dev user. The dev migration only seeds the org, not a user.
    result = await db.execute(select(User).where(User.id == DEV_USER_ID))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            id=DEV_USER_ID,
            org_id=DEV_ORG_ID,
            clerk_user_id="dev_user",
            email="dev@local",
            name="Dev User",
        )
        db.add(user)
        await db.commit()
    return user, org


async def _demo_user_and_org(db: AsyncSession) -> tuple[User, Org]:
    """
    Return the shared demo org + user for public no-login demos.

    Both are seeded by 0004_demo_and_feedback.py, so unlike the dev path we
    don't lazily create the user — a public deployment should fail loudly if
    the migration hasn't run rather than silently minting rows.
    """
    org = await db.get(Org, DEMO_ORG_ID)
    user = await db.get(User, DEMO_USER_ID)
    if org is None or user is None:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Demo mode enabled but demo org/user not seeded — run alembic upgrade head",
        )
    return user, org


async def get_current_user_and_org(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> tuple[User, Org]:
    """
    FastAPI dependency. Inject into any route that needs auth.

        @router.post("/something")
        async def handler(auth = Depends(get_current_user_and_org)):
            user, org = auth
            ...

    Returns 401 if the bearer token is missing/invalid.
    """
    settings = get_settings()

    # Demo takes precedence: a public demo deployment may also have dev flags
    # lying around in env, but we always want the labelled demo workspace.
    if settings.demo_mode:
        return await _demo_user_and_org(db)

    if settings.dev_mode_skip_auth:
        return await _dev_user_and_org(db)

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    claims = _verify_token(token)
    return await _get_or_create_user(claims, db)
