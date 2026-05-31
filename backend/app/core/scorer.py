"""
Phase 3: Virality scoring.

Each candidate beat from segmentation gets scored individually with Claude
using a structured rubric. Output matches the exact engagement shape the
frontend already consumes:

    {
        "virality_score": int 0-100,
        "engagement": { "hook": int, "retention": int, "shareability": int },
        "reasons": [str, ...],   # 3-5 punchy reasons it'll perform
        "platforms": [str, ...], # subset of TikTok/Reels/Shorts/LinkedIn/X
        "title": str,            # editor-polished title (replaces raw topic)
        "polished_hook": str,    # editor-polished hook (replaces raw quote)
    }

# Why score each beat in a separate call instead of one mega-call

- Better focus: a dedicated prompt produces more careful, consistent scores
  than asking Claude to rank 10 beats simultaneously
- Cheaper: input cost is ~1k tokens per beat (the beat text + rubric) vs
  ~15k tokens for the full transcript. 10 beats = 10k input vs 15k input,
  AND scoring quality goes up.
- Parallelizable: bounded fan-out with asyncio.Semaphore hits Anthropic's
  default rate limit ceiling (~50 RPM on tier 1) cleanly.

# Model choice — Claude Haiku 4.5

Scoring is a constrained, structured task. We don't need Sonnet's reasoning
depth — Haiku 4.5 is ~5x cheaper ($1/M input vs $3/M for Sonnet) and ~3x
faster, with no observable quality drop on this kind of rubric.

If quality regresses on some clip types in production, easy swap: change
SCORING_MODEL to claude-sonnet-4-5.
"""

import asyncio
import json
import re

import structlog
from anthropic import AsyncAnthropic

from app.core.config import get_settings

log = structlog.get_logger()

SCORING_MODEL = "claude-haiku-4-5"

# Anthropic tier-1 limit is ~50 RPM. We stay well under to leave headroom
# for segmentation calls happening in parallel jobs.
MAX_CONCURRENT_SCORING_CALLS = 5

# Valid platform tags the frontend renders. Claude is told to pick from this set.
VALID_PLATFORMS = {"TikTok", "Reels", "Shorts", "LinkedIn", "X"}


def _client() -> AsyncAnthropic:
    return AsyncAnthropic(api_key=get_settings().anthropic_api_key)


SCORING_PROMPT = """You are a senior short-form video editor at a top media company. You're evaluating a clip from a podcast to predict how it will perform on TikTok, Instagram Reels, and YouTube Shorts.

Score this clip honestly. Most clips are mediocre — don't inflate scores just because the topic is provided.

# The clip

**Topic**: {topic}
**Length**: {duration:.1f}s
**Opening hook quote**: "{hook_quote}"
**Summary**: {summary}

**Transcript**:
{transcript_text}

# Scoring rubric (each 0-100)

**hook**: How strongly does the first 3 seconds stop a scroll? Strong claims, surprising facts, contrarian takes, vulnerable admissions, specific numbers score high. Generic openings, throat-clearing, slow setups score low.

**retention**: How likely is a viewer to watch to the end? Self-contained beats with payoffs score high. Setup without payoff, mid-thought fragments, or beats that require external context score low.

**shareability**: How likely is a viewer to send this to someone else or save it? Quotable lines, useful frameworks, validating-the-viewer takes, emotional moments score high. Generic insights or insider-baseball references score low.

**virality_score**: A weighted composite. Roughly: hook × 0.4 + retention × 0.3 + shareability × 0.3. Override the math if one dimension is so weak it kills the clip (e.g. hook=30 should usually cap virality at ~60 no matter what).

# Other fields

**reasons**: 3-5 short punchy phrases (max 6 words each) explaining what'll make it perform — or hold it back. Mix positives and negatives if the clip is mediocre. Examples: "Strong contrarian opening", "Specific numbers hit", "Mid-thought ending hurts retention", "Niche framework limits reach"

**platforms**: Pick from {{TikTok, Reels, Shorts, LinkedIn, X}}. Choose 2-4 based on the content style — tactical/B2B leans LinkedIn+X, emotional/story leans TikTok+Reels, educational+listicle leans Shorts+LinkedIn.

**title**: 4-8 words, no clickbait punctuation. Replace the raw topic with something a viewer would actually click. Examples: "Why most founders get this wrong", "The 47-second hook that crushed", "Three frameworks I steal every day"

**polished_hook**: The exact line as it'll appear in the on-screen text overlay. Tighten the raw quote — remove filler ("um", "like", "you know"), but stay faithful to what was said. Max 15 words.

# Output

Return ONLY valid JSON, no markdown fences, no commentary:

{{
  "virality_score": 87,
  "engagement": {{ "hook": 92, "retention": 84, "shareability": 85 }},
  "reasons": ["Strong contrarian opening", "Specific numbers land", "Self-contained payoff"],
  "platforms": ["TikTok", "Reels", "Shorts"],
  "title": "Why most founders get this completely wrong",
  "polished_hook": "Most founders get this completely backwards"
}}
"""


def _extract_json(text: str) -> dict:
    """Defensive JSON parser — same logic as segmentation, kept local to this module."""
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)
    if not text.startswith("{"):
        first = text.find("{")
        last = text.rfind("}")
        if first != -1 and last != -1:
            text = text[first : last + 1]
    return json.loads(text)


def _clip_transcript_window(transcript: dict, start: float, end: float) -> str:
    """
    Extract the punctuated text covering the clip window.

    We pass this slice into the scoring prompt so Claude scores the actual
    content, not just the summary line from segmentation.
    """
    lines = []
    for u in transcript.get("utterances", []):
        # Include utterances that overlap the window
        if u["end"] >= start and u["start"] <= end:
            lines.append(f"[{u['start']:.1f}s] {u['text']}")
    return "\n".join(lines) if lines else "(no transcript available for this window)"


def _clamp_score(val, default: int = 50) -> int:
    """Coerce LLM output into a sane 0-100 int. Anthropic sometimes returns floats or strings."""
    try:
        n = int(round(float(val)))
        return max(0, min(100, n))
    except (TypeError, ValueError):
        return default


def _validate_score(raw: dict, beat: dict) -> dict:
    """
    Normalize Claude's score response into the shape the DB expects.

    If Claude returns something weird (missing field, wrong type), we fill
    sensible defaults rather than failing the whole pipeline.
    """
    engagement = raw.get("engagement", {}) or {}
    hook = _clamp_score(engagement.get("hook"))
    retention = _clamp_score(engagement.get("retention"))
    shareability = _clamp_score(engagement.get("shareability"))

    # If Claude gave us no virality_score, derive from rubric (matches the prompt's formula)
    virality = raw.get("virality_score")
    if virality is None:
        virality = round(hook * 0.4 + retention * 0.3 + shareability * 0.3)
    virality = _clamp_score(virality)

    # Reasons — keep up to 5, trim to short strings
    reasons = raw.get("reasons", []) or []
    if not isinstance(reasons, list):
        reasons = []
    reasons = [str(r).strip()[:80] for r in reasons if r][:5]
    if not reasons:
        reasons = ["Scored without rationale — review"]

    # Platforms — only allow values from the canonical set
    platforms = raw.get("platforms", []) or []
    if not isinstance(platforms, list):
        platforms = []
    platforms = [p for p in platforms if p in VALID_PLATFORMS][:4]
    if not platforms:
        platforms = ["TikTok", "Reels", "Shorts"]

    title = str(raw.get("title") or beat.get("topic") or "Untitled clip")[:300]
    polished_hook = str(raw.get("polished_hook") or beat.get("hook_quote") or "")[:500]

    return {
        "virality_score": virality,
        "engagement_hook": hook,
        "engagement_retention": retention,
        "engagement_shareability": shareability,
        "reasons": reasons,
        "platforms": platforms,
        "title": title,
        "polished_hook": polished_hook,
    }


async def score_beat(beat: dict, transcript: dict) -> dict:
    """
    Score a single beat. Returns the validated, DB-ready dict.

    On API failure or malformed JSON we log + return a fallback score
    rather than raising — losing one clip is better than failing the whole job.
    """
    transcript_text = _clip_transcript_window(
        transcript, beat["start_seconds"], beat["end_seconds"]
    )

    prompt = SCORING_PROMPT.format(
        topic=beat.get("topic", "Untitled"),
        duration=beat["duration_seconds"],
        hook_quote=beat.get("hook_quote", ""),
        summary=beat.get("summary", ""),
        transcript_text=transcript_text,
    )

    try:
        resp = await _client().messages.create(
            model=SCORING_MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_text = resp.content[0].text
        parsed = _extract_json(raw_text)
        return _validate_score(parsed, beat)

    except json.JSONDecodeError as e:
        log.error("score_bad_json", topic=beat.get("topic"), error=str(e))
    except Exception as e:
        log.exception("score_api_failed", topic=beat.get("topic"), error=str(e))

    # Fallback — neutral score so the clip still shows up but lands at the bottom
    return _validate_score(
        {
            "virality_score": 50,
            "engagement": {"hook": 50, "retention": 50, "shareability": 50},
            "reasons": ["Scoring failed — manual review recommended"],
            "platforms": ["TikTok", "Reels", "Shorts"],
            "title": beat.get("topic"),
            "polished_hook": beat.get("hook_quote"),
        },
        beat,
    )


async def score_beats(beats: list[dict], transcript: dict) -> list[dict]:
    """
    Score all beats in parallel with bounded concurrency.

    Returns scores in the same order as input beats — matching them up by
    index in the caller is the simplest pattern.
    """
    sem = asyncio.Semaphore(MAX_CONCURRENT_SCORING_CALLS)

    async def _bounded_score(beat: dict) -> dict:
        async with sem:
            return await score_beat(beat, transcript)

    log.info("scoring_start", count=len(beats), concurrency=MAX_CONCURRENT_SCORING_CALLS)
    results = await asyncio.gather(*[_bounded_score(b) for b in beats])
    log.info("scoring_complete", count=len(results))
    return results
