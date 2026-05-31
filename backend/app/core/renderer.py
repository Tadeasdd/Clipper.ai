"""
Phase 4: clip rendering.

For each scored clip we produce three deliverables and upload them to R2:
    - 9:16 (1080x1920)  — TikTok / Reels / Shorts default
    - 1:1  (1080x1080)  — IG feed / X feed
    - 16:9 (1920x1080)  — LinkedIn / X / YouTube

# Pipeline per clip
    1. FFmpeg cut from the source video (no re-encode of the cut step
       itself — we use a single pass that combines cut + crop + caption
       burn-in, since cut-then-reencode would double the work)
    2. Apply the per-aspect crop + scale + caption overlay in one filter
       chain
    3. Upload the resulting MP4 to R2 at `rendered/{job_id}/{clip_id}/{aspect}.mp4`
    4. Record the R2 keys on the Clip row's `rendered_r2_keys` JSON field

# Why no MediaPipe face tracking yet
For v1, the 9:16 reframe is a fixed center-crop. Most podcast video has
speakers roughly centered, so this gets us 80% of the value at 5% of the
complexity. Adding MediaPipe means:
    - +300MB Docker image
    - +500-2000ms per clip for face detection
    - A whole new failure mode (no faces detected, multi-speaker switching)

We'll add it in a Phase 4.5 once we see real customer footage and know
whether the center-crop fails. The render function is structured so
swapping the crop logic is a 5-line change.

# Concurrency
Within a single clip we render the 3 aspect ratios in parallel — they
read from the same source MP4 but write different outputs, so they don't
contend. Between clips we go sequential to avoid spiking to 30+ FFmpeg
processes on one worker (would OOM on a 1GB container).
"""

import asyncio
import os
import tempfile
from uuid import UUID

import structlog
from sqlalchemy import select

from app.core.captions import build_ass_subtitle
from app.core.config import get_settings
from app.core.quotas import WATERMARKED_TIERS
from app.core.r2 import r2_client, upload_bytes
from app.db.base import AsyncSessionLocal
from app.db.models import Clip, Job, Org

log = structlog.get_logger()
_settings = get_settings()

# Output target dimensions per aspect ratio
ASPECT_DIMENSIONS = {
    "9:16": (1080, 1920),
    "1:1": (1080, 1080),
    "16:9": (1920, 1080),
}


def _build_filter_graph(aspect_ratio: str, ass_path: str) -> str:
    """
    Build the FFmpeg -vf filter graph for a given aspect ratio.

    Each branch:
        1. Scales the source to fit the long side of the target while
           preserving aspect
        2. Crops to the exact target dimensions (center-anchored)
        3. Burns the ASS subtitle

    The ASS path has to be escaped for FFmpeg's filter syntax — colons
    and special chars in absolute paths can confuse the parser.
    """
    if aspect_ratio not in ASPECT_DIMENSIONS:
        raise ValueError(f"Unsupported aspect ratio: {aspect_ratio}")
    target_w, target_h = ASPECT_DIMENSIONS[aspect_ratio]
    # FFmpeg subtitle filter wants escaped colons (Windows-style paths and
    # general filter argument separators). Single quotes around the path help.
    escaped = ass_path.replace("\\", "/").replace(":", "\\:")

    if aspect_ratio == "9:16":
        # Source is typically 16:9 → we need to crop horizontally to make 9:16.
        # Strategy: scale so the height fills 1920, then center-crop horizontally to 1080.
        crop_scale = f"scale=-2:{target_h},crop={target_w}:{target_h}"
    elif aspect_ratio == "1:1":
        # Scale by height, center-crop horizontally.
        crop_scale = f"scale=-2:{target_h},crop={target_w}:{target_h}"
    elif aspect_ratio == "16:9":
        # Scale to fit, pad if source is taller-than-16:9 (rare for podcasts).
        crop_scale = (
            f"scale='min({target_w},iw)':'min({target_h},ih)':"
            f"force_original_aspect_ratio=decrease,"
            f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2"
        )
    else:
        raise ValueError(f"Unsupported aspect ratio: {aspect_ratio}")

    return f"{crop_scale},subtitles='{escaped}'"


async def _render_one_aspect(
    source_path: str,
    clip_start: float,
    clip_duration: float,
    aspect_ratio: str,
    transcript: dict,
    output_path: str,
    watermark: bool = False,
) -> None:
    """
    Run a single FFmpeg invocation that cuts, reframes, and burns captions.

    -ss before -i is a fast seek (keyframe-aligned). We accept the few-frames
    inaccuracy because re-encoding the whole pre-clip portion to get a
    sample-accurate cut would take 50x longer.
    """
    # Write the ASS subtitle file for this clip+aspect
    ass_content = build_ass_subtitle(
        transcript, clip_start, clip_start + clip_duration, aspect_ratio, watermark=watermark
    )
    with tempfile.NamedTemporaryFile(
        suffix=".ass", delete=False, mode="w", encoding="utf-8"
    ) as ass_file:
        ass_file.write(ass_content)
        ass_path = ass_file.name

    try:
        filter_graph = _build_filter_graph(aspect_ratio, ass_path)

        cmd = [
            _settings.ffmpeg_bin,
            "-ss", f"{clip_start:.3f}",       # fast seek to start (before -i)
            "-i", source_path,
            "-t", f"{clip_duration:.3f}",     # duration to keep
            "-vf", filter_graph,
            "-c:v", "libx264",
            "-preset", "veryfast",            # speed > size; users want low latency
            "-crf", "23",                     # visually lossless-ish for short-form
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",        # enable progressive playback
            "-y",
            output_path,
        ]
        log.info(
            "ffmpeg_render_start",
            aspect=aspect_ratio,
            start=clip_start,
            duration=clip_duration,
        )
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            err = stderr.decode(errors="replace")[-2000:]
            log.error("ffmpeg_render_failed", aspect=aspect_ratio, stderr=err)
            raise RuntimeError(f"FFmpeg render failed ({aspect_ratio}): {err}")
    finally:
        try:
            os.unlink(ass_path)
        except OSError:
            pass


async def render_clip(
    clip: Clip,
    source_path: str,
    transcript: dict,
    job_id: UUID,
    watermark: bool = False,
) -> dict[str, str]:
    """
    Render one clip in all three aspect ratios (in parallel) and upload to R2.

    Returns a dict like {"9:16": "rendered/.../9x16.mp4", "1:1": "...", "16:9": "..."}
    suitable for the Clip.rendered_r2_keys column.
    """
    output_dir = tempfile.mkdtemp(prefix=f"clip_{clip.id}_")
    rendered_keys: dict[str, str] = {}
    aspect_to_path: dict[str, str] = {}

    # Stage 1: run all three FFmpeg jobs in parallel
    async def _render_aspect(aspect: str):
        # Filenames use safe chars only (no colons)
        safe = aspect.replace(":", "x")
        out_path = os.path.join(output_dir, f"{safe}.mp4")
        await _render_one_aspect(
            source_path,
            clip.start_seconds,
            clip.duration_seconds,
            aspect,
            transcript,
            out_path,
            watermark=watermark,
        )
        aspect_to_path[aspect] = out_path

    await asyncio.gather(*[_render_aspect(a) for a in ASPECT_DIMENSIONS.keys()])

    # Stage 2: upload all three outputs to R2
    try:
        for aspect, path in aspect_to_path.items():
            safe = aspect.replace(":", "x")
            r2_key = f"rendered/{job_id}/{clip.id}/{safe}.mp4"
            with open(path, "rb") as f:
                upload_bytes(r2_key, f.read(), content_type="video/mp4")
            rendered_keys[aspect] = r2_key
            log.info("clip_uploaded", clip_id=str(clip.id), aspect=aspect, key=r2_key)
    finally:
        # Cleanup temp files
        for path in aspect_to_path.values():
            try:
                os.unlink(path)
            except OSError:
                pass
        try:
            os.rmdir(output_dir)
        except OSError:
            pass

    return rendered_keys


async def render_all_clips(job_id: UUID) -> int:
    """
    Render every Clip belonging to the job.

    Steps:
        1. Download the source video to a temp file once (reused for all clips)
        2. Download the transcript JSON from R2 once
        3. For each clip, render 3 aspect ratios in parallel, upload to R2,
           update the clip row's rendered_r2_keys
        4. Cleanup

    Returns the number of clips rendered.
    """
    # Load job + clips + transcript R2 key + plan tier (for watermark)
    async with AsyncSessionLocal() as db:
        job = await db.get(Job, job_id)
        if job is None:
            raise RuntimeError(f"Job {job_id} not found")
        source_key = job.source_r2_key
        transcript_key = job.transcript_r2_key

        org = await db.get(Org, job.org_id)
        watermark = org is not None and org.plan_tier in WATERMARKED_TIERS

        clips_result = await db.execute(select(Clip).where(Clip.job_id == job_id))
        clips = list(clips_result.scalars())

    if not clips:
        log.warning("render_no_clips", job_id=str(job_id))
        return 0

    log.info("render_plan", job_id=str(job_id), watermark=watermark)

    # Download source video to temp file (used for all clips)
    src_tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    src_path = src_tmp.name
    src_tmp.close()

    try:
        await asyncio.to_thread(
            r2_client().download_file, _settings.r2_bucket, source_key, src_path
        )
        log.info(
            "render_source_downloaded",
            job_id=str(job_id),
            bytes=os.path.getsize(src_path),
        )

        # Download + parse transcript (needed for captions)
        import json as _json

        transcript_obj = r2_client().get_object(
            Bucket=_settings.r2_bucket, Key=transcript_key
        )
        transcript = _json.loads(transcript_obj["Body"].read())

        # Render each clip sequentially (3 aspects in parallel inside)
        for i, clip in enumerate(clips):
            log.info(
                "render_clip_start",
                job_id=str(job_id),
                clip_id=str(clip.id),
                progress=f"{i + 1}/{len(clips)}",
            )
            rendered_keys = await render_clip(
                clip, src_path, transcript, job_id, watermark=watermark
            )

            # Persist rendered_r2_keys back to the row
            async with AsyncSessionLocal() as db:
                fresh = await db.get(Clip, clip.id)
                if fresh is not None:
                    fresh.rendered_r2_keys = rendered_keys
                    await db.commit()

        return len(clips)

    finally:
        try:
            os.unlink(src_path)
        except OSError:
            pass
