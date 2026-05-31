"""
Job endpoints — scoped to the authenticated caller's org.

POST   /v1/jobs        Create a job from an uploaded R2 key, trigger the pipeline
                       (supports Idempotency-Key header for safe retries)
GET    /v1/jobs/{id}   Return current status + clips (frontend polls this)
GET    /v1/jobs        List recent jobs for the current org
DELETE /v1/jobs/{id}   Mark a job CANCELLED — pipeline aborts at next step boundary
"""

from typing import Optional
from uuid import UUID

import inngest
import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user_and_org
from app.core.inngest_client import inngest_client
from app.core.quotas import QuotaExceeded, ensure_quota_available
from app.core.r2 import head_object, presign_download_url
from app.core.rate_limit import enforce_rate_limit
from app.db.base import get_db
from app.db.models import IdempotencyKey, Job, JobStatus
from app.schemas.jobs import ClipResponse, JobCreateRequest, JobListResponse, JobResponse

log = structlog.get_logger()
router = APIRouter(prefix="/v1/jobs", tags=["jobs"])


def _serialize_job(job: Job) -> JobResponse:
    """Map ORM Job → response. Handles the engagement dict shape the UI expects."""
    clips = []
    for c in sorted(job.clips, key=lambda x: -(x.virality_score or 0)):
        engagement = None
        if c.engagement_hook is not None:
            engagement = {
                "hook": c.engagement_hook,
                "retention": c.engagement_retention,
                "shareability": c.engagement_shareability,
            }

        rendered_urls = None
        if c.rendered_r2_keys:
            rendered_urls = {
                aspect: presign_download_url(key) for aspect, key in c.rendered_r2_keys.items()
            }

        clips.append(
            ClipResponse(
                id=c.id,
                title=c.title,
                hook=c.hook,
                duration_seconds=c.duration_seconds,
                start_seconds=c.start_seconds,
                end_seconds=c.end_seconds,
                virality_score=c.virality_score,
                engagement=engagement,
                reasons=c.reasons,
                platforms=c.platforms,
                rendered_urls=rendered_urls,
            )
        )

    return JobResponse(
        id=job.id,
        status=job.status.value,
        progress_pct=job.progress_pct,
        source_filename=job.source_filename,
        error_message=job.error_message,
        clips=clips,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    req: JobCreateRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    auth: tuple = Depends(get_current_user_and_org),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a job and dispatch it to Inngest.

    Steps:
        0. Rate limit (per-org token bucket)
        1. If Idempotency-Key is set, look up an existing job — return it if found
        2. Enforce monthly quota — reject 402 if the org has burned through their plan
        3. Verify the upload actually landed in R2 (otherwise pipeline fails downstream)
        4. Insert the Job row scoped to the caller's org
        5. If idempotency key was provided, atomically record it
        6. Fire the Inngest event
    """
    user, org = auth

    enforce_rate_limit(org.id, org.plan_tier, "expensive")

    # Idempotency: same key from same org returns the same job.
    if idempotency_key:
        existing = await db.execute(
            select(IdempotencyKey).where(
                IdempotencyKey.org_id == org.id,
                IdempotencyKey.key == idempotency_key,
            )
        )
        existing_row = existing.scalar_one_or_none()
        if existing_row is not None:
            # Return the existing job. Frontend gets the same response shape
            # whether this was the first call or a retry.
            existing_job = await db.execute(
                select(Job)
                .where(Job.id == existing_row.job_id)
                .options(selectinload(Job.clips))
            )
            job = existing_job.scalar_one_or_none()
            if job is not None:
                log.info("idempotent_replay", job_id=str(job.id), key=idempotency_key)
                return _serialize_job(job)
            # Else: idempotency row exists but job was deleted — fall through
            # and create a new one. Drop the stale idempotency row.
            await db.delete(existing_row)
            await db.commit()

    try:
        await ensure_quota_available(org, db)
    except QuotaExceeded as e:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "quota_exceeded",
                "message": str(e),
                "plan": e.plan,
                "minutes_used": e.used,
                "minutes_limit": e.limit,
            },
        )

    head = head_object(req.source_r2_key)
    if head is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload not found in R2. Did you PUT the file to the presigned URL?",
        )

    job = Job(
        org_id=org.id,
        source_filename=req.source_filename,
        source_r2_key=req.source_r2_key,
        source_size_bytes=req.source_size_bytes or head.get("ContentLength"),
        status=JobStatus.QUEUED,
    )
    db.add(job)
    await db.flush()  # need the job.id to record idempotency below

    if idempotency_key:
        # Race: two concurrent requests with the same key could both reach
        # here. The UniqueConstraint on (org_id, key) will reject the loser
        # with an IntegrityError; we catch it and return the winner.
        db.add(IdempotencyKey(org_id=org.id, key=idempotency_key, job_id=job.id))
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            # Re-fetch the winner
            winner = await db.execute(
                select(IdempotencyKey).where(
                    IdempotencyKey.org_id == org.id,
                    IdempotencyKey.key == idempotency_key,
                )
            )
            winner_row = winner.scalar_one()
            winner_job = await db.execute(
                select(Job)
                .where(Job.id == winner_row.job_id)
                .options(selectinload(Job.clips))
            )
            log.info(
                "idempotent_race_resolved",
                winner_job_id=str(winner_row.job_id),
                key=idempotency_key,
            )
            return _serialize_job(winner_job.scalar_one())
    else:
        await db.commit()

    await db.refresh(job)

    # Fire the Inngest event — worker picks it up async
    await inngest_client.send(
        inngest.Event(
            name="clipper/job.created",
            data={"job_id": str(job.id)},
        )
    )

    return _serialize_job(job)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: UUID,
    auth: tuple = Depends(get_current_user_and_org),
    db: AsyncSession = Depends(get_db),
):
    _, org = auth
    enforce_rate_limit(org.id, org.plan_tier, "read")
    stmt = (
        select(Job)
        .where(Job.id == job_id, Job.org_id == org.id)
        .options(selectinload(Job.clips))
    )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return _serialize_job(job)


@router.get("", response_model=JobListResponse)
async def list_jobs(
    limit: int = 25,
    cursor: str | None = None,
    auth: tuple = Depends(get_current_user_and_org),
    db: AsyncSession = Depends(get_db),
):
    """
    List the caller's recent jobs, newest first.

    Cursor pagination:
        - Pass nothing on the first call to get the newest `limit` jobs
        - Use `next_cursor` from the response to fetch the next page
        - When `next_cursor` is null, you've reached the end

    The cursor is opaque (base64 of created_at + job_id). It's stable under
    inserts — a new job created mid-pagination doesn't shift the page
    boundaries. Compared to offset-based pagination, this stays O(log N)
    on big tables.
    """
    _, org = auth
    enforce_rate_limit(org.id, org.plan_tier, "read")

    limit = max(1, min(limit, 100))

    stmt = (
        select(Job)
        .where(Job.org_id == org.id)
        .order_by(desc(Job.created_at), desc(Job.id))
        .limit(limit + 1)  # fetch one extra to know if there's a next page
        .options(selectinload(Job.clips))
    )

    # Apply cursor if given. Compound key (created_at, id) handles same-second
    # ties — without the id tiebreak, two jobs created in the same millisecond
    # could be split across pages or shown twice.
    if cursor:
        try:
            cur_created, cur_id = _decode_cursor(cursor)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid cursor",
            )
        # Strict-less comparison on the composite — Postgres supports row
        # comparison and SQLAlchemy expresses it with tuple_().
        from sqlalchemy import tuple_
        stmt = stmt.where(
            tuple_(Job.created_at, Job.id) < tuple_(cur_created, cur_id)
        )

    result = await db.execute(stmt)
    jobs = list(result.scalars().all())

    next_cursor: str | None = None
    if len(jobs) > limit:
        # We fetched limit+1 — the extra one tells us there's another page.
        # Drop it from the response and encode a cursor pointing past the
        # last *returned* job.
        jobs = jobs[:limit]
        last = jobs[-1]
        next_cursor = _encode_cursor(last.created_at, last.id)

    return JobListResponse(
        items=[_serialize_job(j) for j in jobs],
        next_cursor=next_cursor,
    )


# ──────────────────────────────────────────────────────────── CURSOR HELPERS

def _encode_cursor(created_at, job_id: UUID) -> str:
    """Opaque cursor: base64(created_at_isoformat|job_id). URL-safe."""
    import base64
    raw = f"{created_at.isoformat()}|{job_id}".encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _decode_cursor(cursor: str) -> tuple:
    """Reverse of _encode_cursor. Raises ValueError on bad input."""
    import base64
    from datetime import datetime as _dt

    # Re-pad — we stripped trailing '=' on encode
    padded = cursor + "=" * (-len(cursor) % 4)
    try:
        raw = base64.urlsafe_b64decode(padded).decode()
    except Exception as e:
        raise ValueError(f"undecodeable cursor: {e}")
    parts = raw.split("|", 1)
    if len(parts) != 2:
        raise ValueError("malformed cursor")
    created_at_iso, job_id_str = parts
    try:
        return _dt.fromisoformat(created_at_iso), UUID(job_id_str)
    except Exception as e:
        raise ValueError(f"unparseable cursor fields: {e}")


# States where DELETE is a no-op (job already done or already cancelled).
_TERMINAL_STATES = {JobStatus.COMPLETE, JobStatus.FAILED, JobStatus.CANCELLED}


@router.delete("/{job_id}", status_code=status.HTTP_200_OK)
async def cancel_job(
    job_id: UUID,
    auth: tuple = Depends(get_current_user_and_org),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark a job as cancelled. The Inngest worker checks status at each step
    boundary and bails out if it sees CANCELLED. Already-running steps (e.g.
    Deepgram transcription) will finish, but no further steps fire.

    Returns 200 with the updated status. Calling on an already-terminal job
    is a no-op (returns 200 with current status — idempotent).
    """
    _, org = auth
    enforce_rate_limit(org.id, org.plan_tier, "expensive")

    stmt = select(Job).where(Job.id == job_id, Job.org_id == org.id)
    job = (await db.execute(stmt)).scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    if job.status in _TERMINAL_STATES:
        return {"id": str(job.id), "status": job.status.value, "already_terminal": True}

    job.status = JobStatus.CANCELLED
    await db.commit()
    log.info("job_cancelled", job_id=str(job.id), org_id=str(org.id))
    return {"id": str(job.id), "status": JobStatus.CANCELLED.value, "already_terminal": False}
