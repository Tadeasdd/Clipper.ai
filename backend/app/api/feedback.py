"""
Feedback endpoints — the reason this MVP exists.

    POST /v1/feedback   open (auth dep → demo org in demo mode). Captures a
                        visitor's rating/message/clip reference.
    GET  /v1/feedback   admin-only (X-Admin-Token header). Lists recent
                        feedback so you can read what people said without
                        SSHing into the database.

The POST is intentionally forgiving: a busy founder leaving "the clips are
weirdly good" with no email is exactly the signal we want, so email is
optional and we only reject genuinely empty submissions (handled in the
schema validator).
"""

from typing import Optional

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_and_org
from app.core.config import get_settings
from app.core.rate_limit import enforce_rate_limit
from app.db.base import get_db
from app.db.models import Feedback
from app.schemas.feedback import (
    FeedbackCreateRequest,
    FeedbackListResponse,
    FeedbackResponse,
)

log = structlog.get_logger()

router = APIRouter(prefix="/v1/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    req: FeedbackCreateRequest,
    auth: tuple = Depends(get_current_user_and_org),
    db: AsyncSession = Depends(get_db),
):
    _, org = auth
    # "read" group: 60/min base. In demo mode the org is ENTERPRISE (50x), so
    # ~3000/min shared — abuse protection without tripping real visitors.
    enforce_rate_limit(org.id, org.plan_tier, "read")

    fb = Feedback(
        org_id=org.id,
        email=req.email,
        name=req.name,
        rating=req.rating,
        message=req.message,
        job_id=req.job_id,
        clip_id=req.clip_id,
        context=req.context,
    )
    db.add(fb)
    await db.commit()
    await db.refresh(fb)

    # Log it so it also shows up in your structured logs / Sentry breadcrumbs,
    # not only the DB — handy for a live "watch the feedback roll in" tail.
    log.info(
        "feedback_received",
        feedback_id=str(fb.id),
        rating=fb.rating,
        has_message=bool(fb.message),
        has_email=bool(fb.email),
    )
    return fb


@router.get("", response_model=FeedbackListResponse)
async def list_feedback(
    limit: int = 100,
    x_admin_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin-only readout. Requires X-Admin-Token to match settings.admin_token.
    Deliberately NOT behind the normal auth dep — in demo mode that would let
    any visitor read everyone's feedback (and emails).
    """
    settings = get_settings()
    if not settings.admin_token:
        # Feature disabled — don't even acknowledge the route exists.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if x_admin_token != settings.admin_token:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid admin token")

    limit = max(1, min(limit, 500))
    rows = (
        (
            await db.execute(
                select(Feedback).order_by(Feedback.created_at.desc()).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    total = (await db.execute(select(func.count(Feedback.id)))).scalar_one()
    return FeedbackListResponse(
        items=[FeedbackResponse.model_validate(r) for r in rows],
        total=total,
    )
