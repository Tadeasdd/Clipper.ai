#!/usr/bin/env python
"""
seed_demo.py — turn a handful of real podcast episodes into the instant
showcase visitors see when they land on the demo.

WHY THIS EXISTS
    The core thing we're validating with founders is *clip quality*. Mock
    clips would get us mock feedback. So the demo's showcase is real output
    from the real pipeline — we just pre-compute it once (here) instead of
    making every visitor wait 3 minutes.

WHAT IT DOES
    For each video you give it:
        1. uploads the file to R2 under the demo org's namespace
        2. creates a Job row owned by the demo org
        3. runs the real pipeline steps in sequence (transcribe → segment →
           score → render), exactly what Inngest would run in prod, but inline
           so you get a progress log and a clean exit code
        4. marks the job COMPLETE
    The result: GET /v1/jobs (as the demo org) returns these as history, and
    the frontend showcase renders them immediately.

    It deliberately SKIPS usage recording — the demo org shouldn't burn quota.

REQUIREMENTS (this is the one step only you can run — it needs real keys)
    Set in your environment / .env:
        DATABASE_URL           pointing at the demo's Postgres
        R2_*                   real Cloudflare R2 credentials + bucket
        DEEPGRAM_API_KEY       real
        ANTHROPIC_API_KEY      real
        FFMPEG_BIN             optional, defaults to "ffmpeg"
    And run the migrations first so the demo org exists:
        alembic upgrade head

USAGE
    python seed_demo.py ./episodes/lex_sample.mp4 ./episodes/diary_of_a_ceo.mp4

    # idempotent-ish: re-running creates fresh jobs. To start clean, clear the
    # demo org's jobs first (see --reset).
    python seed_demo.py --reset ./episodes/a.mp4

NOTE
    This must run from the backend root with the app importable, and against a
    reachable Postgres + R2. It will NOT run in a sandbox without real keys —
    that's expected; this is a Phase-B step you run once before deploying.
"""

import argparse
import asyncio
import sys
import time
from pathlib import Path
from uuid import UUID

# Import the real pipeline steps + helpers. These are the same functions the
# Inngest orchestrator calls — we just sequence them ourselves.
from app.core.auth import DEMO_ORG_ID
from app.core.r2 import build_upload_key, upload_bytes
from app.db.base import AsyncSessionLocal
from app.db.models import Job, JobStatus
from app.workers.pipeline import _render, _score, _segment, _set_status, _transcribe


CONTENT_TYPE_BY_SUFFIX = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
}


async def _reset_demo_jobs() -> int:
    """Delete the demo org's existing jobs (clips cascade). Returns count."""
    from sqlalchemy import delete, select

    async with AsyncSessionLocal() as db:
        ids = (
            (await db.execute(select(Job.id).where(Job.org_id == DEMO_ORG_ID)))
            .scalars()
            .all()
        )
        if ids:
            await db.execute(delete(Job).where(Job.org_id == DEMO_ORG_ID))
            await db.commit()
        return len(ids)


async def _seed_one(path: Path) -> UUID:
    """Upload + create + process a single episode. Returns the job id."""
    if not path.exists():
        raise FileNotFoundError(path)
    content_type = CONTENT_TYPE_BY_SUFFIX.get(path.suffix.lower())
    if content_type is None:
        raise ValueError(
            f"Unsupported file type {path.suffix!r}. "
            f"Supported: {sorted(CONTENT_TYPE_BY_SUFFIX)}"
        )

    print(f"\n── {path.name} ─────────────────────────────────────────")

    # 1. Upload bytes to R2 under the demo org's namespace.
    key = build_upload_key(str(DEMO_ORG_ID), path.name)
    data = path.read_bytes()
    print(f"  ↑ uploading {len(data) / 1_048_576:.1f} MB to r2://{key}")
    upload_bytes(key, data, content_type=content_type)

    # 2. Create the Job row.
    async with AsyncSessionLocal() as db:
        job = Job(
            org_id=DEMO_ORG_ID,
            source_filename=path.name,
            source_r2_key=key,
            source_size_bytes=len(data),
            status=JobStatus.QUEUED,
            progress_pct=0,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        job_id = job.id
    print(f"  + job {job_id}")

    # 3. Run the real pipeline inline. Same steps Inngest runs in prod.
    t0 = time.monotonic()
    print("  · transcribing (Deepgram Nova-3)…")
    transcript = await _transcribe(job_id)
    print("  · segmenting (Claude Sonnet 4.5)…")
    segments = await _segment(job_id, transcript)
    print(f"  · scoring {len(segments)} beats (Claude Haiku 4.5)…")
    clip_ids = await _score(job_id, segments, transcript)
    print(f"  · rendering {len(clip_ids)} clips (FFmpeg)…")
    await _render(job_id, clip_ids)

    # 4. Mark COMPLETE. We skip _record_job_usage on purpose — demo org.
    await _set_status(job_id, JobStatus.COMPLETE, progress=100)
    elapsed = time.monotonic() - t0
    print(f"  ✓ complete — {len(clip_ids)} clips in {elapsed:.0f}s")
    return job_id


async def main(paths: list[Path], reset: bool) -> None:
    if reset:
        n = await _reset_demo_jobs()
        print(f"reset: cleared {n} existing demo job(s)")

    seeded: list[UUID] = []
    failed: list[tuple[Path, str]] = []
    for p in paths:
        try:
            seeded.append(await _seed_one(p))
        except Exception as e:  # noqa: BLE001 — we want to continue past one bad file
            failed.append((p, str(e)))
            print(f"  ✗ FAILED: {e}", file=sys.stderr)

    print("\n════════════════════════════════════════════════════════")
    print(f"seeded {len(seeded)}/{len(paths)} episode(s) into the demo org")
    for jid in seeded:
        print(f"  • {jid}")
    if failed:
        print(f"\n{len(failed)} failed:")
        for p, err in failed:
            print(f"  • {p.name}: {err}")
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the Clipper demo showcase.")
    parser.add_argument("videos", nargs="+", type=Path, help="paths to episode files")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="delete the demo org's existing jobs before seeding",
    )
    args = parser.parse_args()
    asyncio.run(main(args.videos, reset=args.reset))
