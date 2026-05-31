"""
Anthropic Claude client + segmentation pass.

Phase 2: segmentation only — identifies self-contained narrative beats
between 20–90 seconds long. Returns candidate clip boundaries for Phase 3
scoring to evaluate.

Why Claude Sonnet 4.5 over GPT-4o:
    - Better instruction-following on structured JSON outputs (no JSON mode hallucinations)
    - Larger context window — we can fit ~3 hours of transcript in one call
    - Cheaper at our usage pattern ($3/M input vs $5/M for GPT-4o)

Why a single call vs chunked sliding window:
    - For podcasts up to ~3 hours, the whole transcript fits in context
    - Single call sees global structure (callbacks, themes that repeat)
    - Two-hour podcast at ~15k words ≈ ~20k tokens — well under 200k limit
    - For longer content, we fall back to overlapping 30-min windows (TODO Phase 6)
"""

import json
import re

import structlog
from anthropic import AsyncAnthropic

from app.core.config import get_settings

log = structlog.get_logger()

# Target clip length range — matches the 20-90s short-form sweet spot
MIN_CLIP_SECONDS = 20
MAX_CLIP_SECONDS = 90

# Hard cap on how many candidate beats to return. We over-select here and
# let Phase 3 scoring rank + cull. The frontend results view comfortably
# renders 5-12 clips.
TARGET_BEAT_COUNT = 10

# Model. Pinned to a specific dated version so we don't get surprised by upgrades.
SEGMENTATION_MODEL = "claude-sonnet-4-5"


def _client() -> AsyncAnthropic:
    return AsyncAnthropic(api_key=get_settings().anthropic_api_key)


SEGMENTATION_PROMPT = """You are an expert short-form video editor analyzing a podcast transcript to find moments worth clipping for TikTok, Instagram Reels, and YouTube Shorts.

Your job: identify {target} self-contained moments that would make great standalone short clips.

# What makes a good clip
- **Self-contained**: makes sense without context from earlier in the conversation
- **Has a hook**: opens with something that stops a scroll — a strong claim, surprising fact, counter-intuitive take, vulnerable admission, or specific story setup
- **One beat**: a single complete thought, story, or argument — not a fragment, not multiple topics
- **Quotable**: contains at least one line a viewer would want to share or screenshot
- **Length**: between {min_s} and {max_s} seconds — strictly enforce this

# What to avoid
- Pleasantries, intros, sponsor reads, transitions
- Setup without payoff ("so anyway, that's when..." with no resolution in the clip)
- Heavy mid-conversation references that require context

# Output format
Return ONLY valid JSON in this exact shape, no markdown fences, no commentary:

{{
  "beats": [
    {{
      "start_seconds": 124.5,
      "end_seconds": 167.2,
      "topic": "Short label, max 8 words",
      "summary": "One-sentence description of what happens",
      "hook_quote": "The exact opening line that makes someone stop scrolling",
      "self_contained": true,
      "speakers": [0, 1]
    }}
  ]
}}

# Transcript

The transcript below has utterances tagged with [speaker:N at TIME] markers. Use these timestamps for your start_seconds and end_seconds — match utterance boundaries when possible so cuts feel natural.

{transcript}
"""


def _format_transcript_for_prompt(transcript: dict) -> str:
    """
    Render utterances as a compact, timestamp-tagged plaintext that Claude
    can map back to seconds when picking boundaries.

    Format:
        [speaker:0 at 12.4] So the thing nobody tells you about...
        [speaker:1 at 18.1] Right, exactly. And what I found was...
    """
    lines = []
    for u in transcript.get("utterances", []):
        lines.append(f"[speaker:{u['speaker']} at {u['start']:.1f}] {u['text']}")
    return "\n".join(lines)


def _extract_json(text: str) -> dict:
    """
    Best-effort JSON extraction. Claude usually returns clean JSON, but we
    defensively strip ```json fences and any leading/trailing prose just in case.
    """
    # Strip code fences
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)

    # If there's still leading prose, find the first { and last }
    if not text.startswith("{"):
        first = text.find("{")
        last = text.rfind("}")
        if first != -1 and last != -1:
            text = text[first : last + 1]

    return json.loads(text)


async def segment_transcript(transcript: dict) -> list[dict]:
    """
    Ask Claude to identify candidate clip beats from the transcript.

    Returns a list of beats with start/end seconds, hook quote, and a
    summary. Phase 3 takes these and runs the virality rubric.
    """
    if not transcript.get("utterances"):
        log.warning("segment_empty_transcript")
        return []

    prompt_text = SEGMENTATION_PROMPT.format(
        target=TARGET_BEAT_COUNT,
        min_s=MIN_CLIP_SECONDS,
        max_s=MAX_CLIP_SECONDS,
        transcript=_format_transcript_for_prompt(transcript),
    )

    log.info(
        "segment_request",
        utterance_count=len(transcript["utterances"]),
        duration=transcript.get("duration_seconds"),
    )

    resp = await _client().messages.create(
        model=SEGMENTATION_MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt_text}],
    )

    raw_text = resp.content[0].text
    try:
        parsed = _extract_json(raw_text)
    except json.JSONDecodeError as e:
        log.error("segment_bad_json", error=str(e), preview=raw_text[:500])
        raise RuntimeError(f"Claude returned malformed JSON: {e}") from e

    beats = parsed.get("beats", [])
    valid_beats = _filter_valid_beats(beats, transcript.get("duration_seconds", 0))

    log.info("segment_complete", returned=len(beats), valid=len(valid_beats))
    return valid_beats


def _filter_valid_beats(beats: list[dict], max_duration: float) -> list[dict]:
    """
    Drop beats that violate constraints — Claude usually behaves but it's
    cheap insurance against bad cuts ending up in the database.
    """
    valid = []
    for b in beats:
        try:
            start = float(b["start_seconds"])
            end = float(b["end_seconds"])
            duration = end - start
        except (KeyError, TypeError, ValueError):
            log.warning("segment_skip_malformed", beat=b)
            continue

        if start < 0 or (max_duration and end > max_duration + 1):
            log.warning("segment_skip_out_of_range", start=start, end=end, max=max_duration)
            continue
        if duration < MIN_CLIP_SECONDS or duration > MAX_CLIP_SECONDS:
            log.warning("segment_skip_bad_length", duration=duration)
            continue
        if not b.get("hook_quote"):
            log.warning("segment_skip_no_hook", beat=b.get("topic"))
            continue

        valid.append(
            {
                "start_seconds": start,
                "end_seconds": end,
                "duration_seconds": duration,
                "topic": b.get("topic", "Untitled clip"),
                "summary": b.get("summary", ""),
                "hook_quote": b["hook_quote"],
                "self_contained": b.get("self_contained", True),
                "speakers": b.get("speakers", []),
            }
        )

    return valid
