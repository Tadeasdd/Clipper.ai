"""
FFmpeg audio extraction.

Pulls the source video from R2 to a temp file, runs FFmpeg to extract a
mono 16kHz MP3 (the format Deepgram performs best on, and ~10x smaller
than the source), and returns the bytes.

Why temp file instead of streaming stdin: FFmpeg's seek behavior on
piped MP4 input is broken — moov atoms at the end of the file cause it
to fail. Disk hop is the pragmatic move.
"""

import asyncio
import os
import tempfile

import structlog

from app.core.config import get_settings
from app.core.r2 import _r2_client

log = structlog.get_logger()
_settings = get_settings()


async def extract_audio_from_r2(r2_key: str) -> bytes:
    """
    Download the video from R2, extract mono 16kHz MP3 audio, return as bytes.

    Returns the full audio in memory. For Phase 2 / typical podcast lengths
    (60–120 min → ~30–60 MB at 16kHz mono MP3) this is fine. If we ever
    need to handle multi-hour video, switch to chunked upload to Deepgram
    instead.
    """
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as src_tmp:
        src_path = src_tmp.name
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as dst_tmp:
        dst_path = dst_tmp.name

    try:
        # Download from R2 — boto3 is sync, so push it to a thread
        await asyncio.to_thread(
            _r2_client().download_file,
            _settings.r2_bucket,
            r2_key,
            src_path,
        )

        # FFmpeg: extract audio, mono, 16kHz, MP3 at 64kbps
        # -vn          drop video
        # -ac 1        mono
        # -ar 16000    16kHz sample rate (Deepgram's preferred)
        # -b:a 64k     low bitrate, plenty for ASR
        # -y           overwrite output
        cmd = [
            _settings.ffmpeg_bin,
            "-i", src_path,
            "-vn",
            "-ac", "1",
            "-ar", "16000",
            "-b:a", "64k",
            "-y",
            dst_path,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            err = stderr.decode(errors="replace")[-2000:]
            log.error("ffmpeg_failed", r2_key=r2_key, stderr=err)
            raise RuntimeError(f"FFmpeg extraction failed: {err}")

        with open(dst_path, "rb") as f:
            audio_bytes = f.read()

        log.info(
            "audio_extracted",
            r2_key=r2_key,
            src_bytes=os.path.getsize(src_path),
            audio_bytes=len(audio_bytes),
        )
        return audio_bytes

    finally:
        for p in (src_path, dst_path):
            try:
                os.unlink(p)
            except OSError:
                pass


async def probe_duration_seconds(r2_key: str) -> int | None:
    """
    Cheap metadata probe — gets duration without extracting audio.

    Used to populate `jobs.source_duration_seconds` early, and to bill
    upload-minutes in Phase 5 before processing finishes.
    """
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        await asyncio.to_thread(
            _r2_client().download_file,
            _settings.r2_bucket,
            r2_key,
            tmp_path,
        )
        proc = await asyncio.create_subprocess_exec(
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            tmp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        if proc.returncode != 0:
            return None
        return int(float(stdout.decode().strip()))
    except Exception:
        log.exception("ffprobe_failed", r2_key=r2_key)
        return None
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
