"""
The 5-step clip pipeline.

Phase 1 (DONE): plumbing — Inngest orchestration, status transitions, polling.
Phase 2 (DONE): transcription (Deepgram Nova-3) + segmentation (Claude Sonnet 4.5).
Phase 3 (DONE): virality scoring (Claude Haiku 4.5) with structured rubric.
Phase 4 (DONE): render workers (FFmpeg cut + crop + caption burn-in per aspect).
Phase 5 (NEXT): auth + Stripe billing.

Each step is registered as an Inngest step so failures retry just that step,
not the whole pipeline. Intermediate artifacts (transcript JSON in R2,
segments JSON on the job row, rendered MP4s in R2) are persisted so a crash
+ retry of a later step doesn't re-run upstream work.
"""

import json
from datetime import datetime, timezone
from uuid import UUID

import inngest
import structlog

from app.core.anthropic_client import segment_transcript
from app.core.deepgram_client import transcribe
from app.core.ffmpeg import extract_audio_from_r2, probe_duration_seconds
from app.core.inngest_client import inngest_client
from app.core.quotas import record_usage
from app.core.r2 import upload_bytes
from app.core.renderer import render_all_clips
from app.core.scorer import score_beats
from app.db.base import AsyncSessionLocal
from app.db.models import Clip, Job, JobStatus

log = structlog.get_logger()


# ──────────────────────────────────────────────────────────── HELPERS


async def _set_status(job_id: UUID, status: JobStatus, progress: int):
    """
    Atomically update job status + progress. The frontend polls this.

    Also detects user-requested cancellation: if the job has been marked
    CANCELLED while this step was running, we raise CancellationRequested
    so the orchestrator unwinds cleanly without marking the job FAILED.
    """
    async with AsyncSessionLocal() as db:
        job = await db.get(Job, job_id)
        if job is None:
            log.warning("job_not_found", job_id=str(job_id))
            return
        if job.status == JobStatus.CANCELLED:
            # User cancelled while previous step was running. Bail out
            # without overwriting the CANCELLED status.
            raise CancellationRequested(job_id)
        job.status = status
        job.progress_pct = progress
        if status == JobStatus.TRANSCRIBING and job.started_at is None:
            job.started_at = datetime.now(timezone.utc)
        if status == JobStatus.COMPLETE:
            job.completed_at = datetime.now(timezone.utc)
        await db.commit()


class CancellationRequested(Exception):
    """Raised by _set_status when a job has been marked CANCELLED mid-pipeline."""

    def __init__(self, job_id: UUID):
        self.job_id = job_id
        super().__init__(f"Job {job_id} cancelled by user")


async def _mark_failed(job_id: UUID, message: str):
    async with AsyncSessionLocal() as db:
        job = await db.get(Job, job_id)
        if job is None:
            return
        job.status = JobStatus.FAILED
        job.error_message = message
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()


# ──────────────────────────────────────────────────────────── PIPELINE STEPS


async def _transcribe(job_id: UUID) -> dict:
    """
    PHASE 2 (REAL): FFmpeg extracts audio from R2 → Deepgram Nova-3 →
    transcript JSON uploaded to R2 → key + duration persisted on the job.

    Returns the in-memory transcript dict so the next step doesn't need to
    re-download it from R2.
    """
    await _set_status(job_id, JobStatus.TRANSCRIBING, progress=15)

    # Load the job to get the source R2 key
    async with AsyncSessionLocal() as db:
        job = await db.get(Job, job_id)
        if job is None:
            raise RuntimeError(f"Job {job_id} not found")
        source_key = job.source_r2_key

    # Extract audio (FFmpeg)
    audio_bytes = await extract_audio_from_r2(source_key)

    # Transcribe (Deepgram Nova-3)
    transcript = await transcribe(audio_bytes)

    # Persist transcript JSON to R2
    transcript_key = f"transcripts/{job_id}.json"
    upload_bytes(
        transcript_key,
        json.dumps(transcript).encode("utf-8"),
        content_type="application/json",
    )

    # Save key + duration on the job row
    async with AsyncSessionLocal() as db:
        job = await db.get(Job, job_id)
        if job is not None:
            job.transcript_r2_key = transcript_key
            if not job.source_duration_seconds and transcript.get("duration_seconds"):
                job.source_duration_seconds = int(transcript["duration_seconds"])
            await db.commit()

    log.info(
        "transcribe_complete",
        job_id=str(job_id),
        word_count=len(transcript.get("words", [])),
        utterance_count=len(transcript.get("utterances", [])),
        duration=transcript.get("duration_seconds"),
    )
    return transcript


async def _segment(job_id: UUID, transcript: dict) -> list[dict]:
    """
    PHASE 2 (REAL): Claude Sonnet 4.5 identifies self-contained narrative beats.

    Returns the candidate beats list (Phase 3 takes this and scores each one).
    Beats are persisted to job.segments_json so a Phase-3 retry doesn't re-run
    the Claude call.
    """
    await _set_status(job_id, JobStatus.SEGMENTING, progress=35)

    beats = await segment_transcript(transcript)
    if not beats:
        raise RuntimeError("Segmentation returned no valid beats")

    # Persist segments on the job row
    async with AsyncSessionLocal() as db:
        job = await db.get(Job, job_id)
        if job is not None:
            job.segments_json = {"beats": beats}
            await db.commit()

    log.info("segment_complete", job_id=str(job_id), beat_count=len(beats))
    return beats


async def _score(job_id: UUID, segments: list[dict], transcript: dict) -> list[UUID]:
    """
    PHASE 3 (REAL): Per-beat virality scoring with Claude Haiku 4.5.

    Each beat is scored in parallel (bounded concurrency = 5). The score
    rubric returns hook/retention/shareability and an overall virality_score,
    plus 3-5 reasons and a polished title + hook to replace the raw segmentation
    output.

    Clip rows are inserted with real scores in one batch — no stub data ever
    hits the database in P3+.
    """
    await _set_status(job_id, JobStatus.SCORING, progress=60)

    scores = await score_beats(segments, transcript)

    clip_ids: list[UUID] = []
    async with AsyncSessionLocal() as db:
        for seg, score in zip(segments, scores, strict=True):
            clip = Clip(
                job_id=job_id,
                title=score["title"],
                hook=score["polished_hook"],
                transcript_excerpt=seg.get("summary", ""),
                start_seconds=seg["start_seconds"],
                end_seconds=seg["end_seconds"],
                duration_seconds=seg["duration_seconds"],
                virality_score=score["virality_score"],
                engagement_hook=score["engagement_hook"],
                engagement_retention=score["engagement_retention"],
                engagement_shareability=score["engagement_shareability"],
                reasons=score["reasons"],
                platforms=score["platforms"],
            )
            db.add(clip)
            await db.flush()
            clip_ids.append(clip.id)
        await db.commit()

    log.info(
        "score_complete",
        job_id=str(job_id),
        clip_count=len(clip_ids),
        avg_virality=round(sum(s["virality_score"] for s in scores) / len(scores), 1)
        if scores
        else 0,
    )
    return clip_ids


async def _render(job_id: UUID, clip_ids: list[UUID]) -> None:
    """
    PHASE 4 (REAL): FFmpeg cut + reframe + caption burn-in for each clip,
    in 9:16, 1:1, and 16:9. Uploads to R2 and saves keys on the Clip rows.

    Source video is downloaded once and reused across all clips. Within a
    clip, the 3 aspect ratios render in parallel; between clips we go
    sequential to avoid spiking to 30+ FFmpeg processes.
    """
    await _set_status(job_id, JobStatus.RENDERING, progress=85)

    rendered_count = await render_all_clips(job_id)
    if rendered_count == 0:
        raise RuntimeError("No clips were rendered")

    log.info("render_complete", job_id=str(job_id), clip_count=rendered_count)


async def _record_job_usage(job_id: UUID) -> None:
    """
    PHASE 5: Append a usage_minutes row for billing reconciliation.

    Called as the final pipeline step on success. Rounds up to nearest
    minute (60s = 1 minute, 61s = 2 minutes) — Stripe metered billing
    is by-the-minute, fractional minutes don't bill cleanly.
    """
    async with AsyncSessionLocal() as db:
        job = await db.get(Job, job_id)
        if job is None:
            log.warning("usage_record_job_missing", job_id=str(job_id))
            return
        duration_s = job.source_duration_seconds or 0
        if duration_s <= 0:
            log.warning("usage_record_zero_duration", job_id=str(job_id))
            return
        minutes = (duration_s + 59) // 60  # round up
        await record_usage(job.org_id, job_id, minutes, db)


# ──────────────────────────────────────────────────────────── INNGEST FUNCTION


@inngest_client.create_function(
    fn_id="process-job",
    trigger=inngest.TriggerEvent(event="clipper/job.created"),
    retries=2,
)
async def process_job(ctx: inngest.Context) -> dict:
    """
    Orchestrates the 5-step pipeline. Each step is wrapped in ctx.step.run so
    Inngest can resume from the last completed step on retry.
    """
    job_id = UUID(ctx.event.data["job_id"])
    log.info("pipeline_start", job_id=str(job_id))

    try:
        transcript = await ctx.step.run("transcribe", lambda: _transcribe(job_id))
        segments = await ctx.step.run("segment", lambda: _segment(job_id, transcript))
        clip_ids = await ctx.step.run("score", lambda: _score(job_id, segments, transcript))
        await ctx.step.run("render", lambda: _render(job_id, clip_ids))

        # Phase 5: record usage minutes against the org's monthly quota.
        # We do this only on success — failed jobs don't burn quota.
        await ctx.step.run("record_usage", lambda: _record_job_usage(job_id))

        await _set_status(job_id, JobStatus.COMPLETE, progress=100)
        log.info("pipeline_complete", job_id=str(job_id), clip_count=len(clip_ids))
        return {"job_id": str(job_id), "clips": len(clip_ids)}

    except CancellationRequested:
        # User cancelled — already marked CANCELLED in the DB. Log + return,
        # don't re-raise (so Inngest doesn't retry the cancelled job).
        log.info("pipeline_cancelled", job_id=str(job_id))
        return {"job_id": str(job_id), "cancelled": True}

    except Exception as e:
        log.exception("pipeline_failed", job_id=str(job_id))
        await _mark_failed(job_id, str(e))
        raise
