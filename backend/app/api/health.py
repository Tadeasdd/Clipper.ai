"""
Liveness + readiness checks.

# Endpoints

    GET /health        — always 200 if the process is up
    GET /health/ready  — 200 if all dependencies (Postgres, R2) are reachable;
                         503 otherwise. The load balancer should poll this and
                         route traffic away from replicas that return 503.

# Why two endpoints

Some orchestrators (Kubernetes, Fly) want separate liveness and readiness
probes. Liveness restarts the container if it fails; readiness pulls the
replica out of rotation. Database hiccups should not restart the container.
"""

import asyncio

import structlog
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.r2 import r2_client
from app.db.base import get_db

log = structlog.get_logger()
router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    """Liveness: process is up. Cheap. No external calls."""
    return {"status": "ok"}


async def _check_db(db: AsyncSession) -> bool:
    try:
        await db.execute(text("SELECT 1"))
        return True
    except Exception as e:
        log.warning("readiness_db_failed", error=str(e))
        return False


async def _check_r2() -> bool:
    """Try a cheap head_bucket call. Times out at 2s so a stalled probe doesn't
    block readiness for everyone."""
    settings = get_settings()
    if not settings.r2_bucket:
        return False
    try:
        # head_bucket is a no-op listing — cheapest possible R2 call
        await asyncio.wait_for(
            asyncio.to_thread(r2_client().head_bucket, Bucket=settings.r2_bucket),
            timeout=2.0,
        )
        return True
    except Exception as e:
        log.warning("readiness_r2_failed", error=str(e))
        return False


@router.get("/health/ready")
async def ready(response: Response, db: AsyncSession = Depends(get_db)):
    """
    Readiness: process can talk to its dependencies.

    Runs the two checks in parallel — total latency = max(db, r2), not sum.
    Returns 503 if any dep fails so the LB pulls us out of rotation.
    """
    db_ok, r2_ok = await asyncio.gather(_check_db(db), _check_r2())

    all_ok = db_ok and r2_ok
    if not all_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "ok" if all_ok else "degraded",
        "checks": {
            "database": db_ok,
            "r2": r2_ok,
        },
    }
