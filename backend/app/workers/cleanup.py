"""
Scheduled cleanup jobs.

Three Inngest cron functions, each idempotent and safe to run on overlapping
schedules. They handle the unbounded-growth surfaces created by Phase 5/6:

    1. cleanup_idempotency_keys  (hourly)
       Drops idempotency_keys rows older than 24h. Phase 6 added one row
       per POST /v1/jobs that uses Idempotency-Key; without cleanup, that
       table grows linearly with traffic forever.

    2. cleanup_processed_webhooks  (daily)
       Drops processed_webhooks rows older than 30d. Stripe's retry window
       is 3 days; 30d gives us 10x headroom for forensics.

    3. cleanup_orphan_uploads  (every 6 hours)
       Walks R2 `uploads/` prefix, finds objects with no matching Job row,
       and deletes them if they're between 1h and 30d old. The 1h grace
       window protects in-flight uploads from a racy upload+job-create
       sequence; the 30d cap is a safety net for cases where a Job was
       deleted but its R2 object wasn't.

# Why Inngest cron and not a separate scheduler

We already use Inngest for the main pipeline, and Inngest has built-in
cron triggers with retries and observability. Adding a Celery beat or
APScheduler just to run these three jobs is duplicative infrastructure.

# Testability

The actual cleanup logic lives in plain async functions (`_run_*`). The
@inngest_client.create_function-decorated entrypoints are thin wrappers
that delegate. This keeps the cron behaviour testable without needing
an Inngest context object.

# Observability

Each function logs a `cleanup_*_done` line with counts. Failures bubble
up to Inngest's retry mechanism (max 2 attempts for cleanups).
"""

from datetime import datetime, timedelta, timezone

import inngest
import structlog
from sqlalchemy import delete, select

from app.core.inngest_client import inngest_client
from app.core.r2 import delete_objects, list_objects
from app.db.base import AsyncSessionLocal
from app.db.models import IdempotencyKey, Job, ProcessedWebhook

log = structlog.get_logger()


# ──────────────────────────────────────────────────────────── 1. Idempotency keys


async def _run_cleanup_idempotency_keys() -> dict:
    """Delete idempotency_keys rows older than 24h."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            delete(IdempotencyKey).where(IdempotencyKey.created_at < cutoff)
        )
        await db.commit()
        deleted = result.rowcount or 0

    log.info("cleanup_idempotency_keys_done", deleted=deleted, cutoff=cutoff.isoformat())
    return {"deleted": deleted}


@inngest_client.create_function(
    fn_id="cleanup-idempotency-keys",
    trigger=inngest.TriggerCron(cron="15 * * * *"),  # 15 past every hour
    retries=2,
)
async def cleanup_idempotency_keys(ctx: inngest.Context) -> dict:
    return await _run_cleanup_idempotency_keys()


# ──────────────────────────────────────────────────────────── 2. Processed webhooks


async def _run_cleanup_processed_webhooks() -> dict:
    """Delete processed_webhooks rows older than 30 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            delete(ProcessedWebhook).where(ProcessedWebhook.processed_at < cutoff)
        )
        await db.commit()
        deleted = result.rowcount or 0

    log.info("cleanup_processed_webhooks_done", deleted=deleted, cutoff=cutoff.isoformat())
    return {"deleted": deleted}


@inngest_client.create_function(
    fn_id="cleanup-processed-webhooks",
    trigger=inngest.TriggerCron(cron="30 3 * * *"),  # 03:30 daily (low-traffic window)
    retries=2,
)
async def cleanup_processed_webhooks(ctx: inngest.Context) -> dict:
    return await _run_cleanup_processed_webhooks()


# ──────────────────────────────────────────────────────────── 3. Orphan R2 uploads


# Don't touch uploads younger than this — protects in-flight clients from
# racing the cleanup. A user who clicks Upload, waits for R2, then clicks
# Create Job has up to UPLOAD_GRACE_HOURS to do so.
UPLOAD_GRACE_HOURS = 1

# Don't delete anything older than this either — defensive cap. If something
# *did* slip through this window, it's a bug we want to see, not silently
# clean up. Today's grace=1h + max=30d gives plenty of room.
UPLOAD_MAX_AGE_DAYS = 30


async def _run_cleanup_orphan_uploads() -> dict:
    """
    Delete R2 objects under `uploads/` that have no matching Job row.

    Algorithm:
        1. Page through R2 objects with prefix `uploads/`
        2. Filter to (UPLOAD_GRACE_HOURS) < age < (UPLOAD_MAX_AGE_DAYS)
        3. Query DB for jobs whose source_r2_key is in that set
        4. Delete the difference from R2 in batched DeleteObjects calls
    """
    now = datetime.now(timezone.utc)
    grace_cutoff = now - timedelta(hours=UPLOAD_GRACE_HOURS)
    max_cutoff = now - timedelta(days=UPLOAD_MAX_AGE_DAYS)

    candidate_keys: list[str] = []

    for obj in list_objects(prefix="uploads/"):
        last_modified = obj["LastModified"]
        if last_modified > grace_cutoff:
            continue  # too young, leave it
        if last_modified < max_cutoff:
            continue  # too old, suspicious, skip
        candidate_keys.append(obj["Key"])

    if not candidate_keys:
        log.info("cleanup_orphan_uploads_done", scanned=0, deleted=0)
        return {"scanned": 0, "deleted": 0}

    # Find which of those keys ARE referenced — those we keep.
    # Process in chunks of 500 to keep the IN-list small.
    referenced: set[str] = set()
    async with AsyncSessionLocal() as db:
        for i in range(0, len(candidate_keys), 500):
            chunk = candidate_keys[i:i + 500]
            result = await db.execute(
                select(Job.source_r2_key).where(Job.source_r2_key.in_(chunk))
            )
            referenced.update(result.scalars().all())

    orphans = [k for k in candidate_keys if k not in referenced]

    deleted = delete_objects(orphans) if orphans else 0

    log.info(
        "cleanup_orphan_uploads_done",
        scanned=len(candidate_keys),
        referenced=len(referenced),
        deleted=deleted,
    )
    return {"scanned": len(candidate_keys), "deleted": deleted}


@inngest_client.create_function(
    fn_id="cleanup-orphan-uploads",
    trigger=inngest.TriggerCron(cron="0 */6 * * *"),  # every 6 hours
    retries=1,
)
async def cleanup_orphan_uploads(ctx: inngest.Context) -> dict:
    return await _run_cleanup_orphan_uploads()
