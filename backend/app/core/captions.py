"""
Generate burned-in captions from Deepgram word timestamps.

We emit ASS (Advanced SubStation Alpha) format because it supports per-word
karaoke timing — words light up as they're spoken, which is the standard
TikTok/Reels caption style. SRT can't do that.

The output file is fed to FFmpeg's `subtitles=` filter at render time.

Style choices (tuned by watching what top short-form creators do):
    - Bold sans-serif, large size for 9:16 (otherwise unreadable on phone)
    - White text with thick black outline (works on any background)
    - Bottom-third placement (TikTok's UI overlays the top half)
    - Two words per caption block max — single-word is too jittery,
      three+ becomes a wall of text
    - Highlight color = neon green (#53fc18) to match Clipper.ai branding
"""

import structlog

log = structlog.get_logger()

# ASS files use centiseconds (1/100 of a second) for timing
ASS_HEADER_9_16 = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,84,&H00FFFFFF,&H0018FC53,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,6,0,2,80,80,420,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

ASS_HEADER_1_1 = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,68,&H00FFFFFF,&H0018FC53,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,5,0,2,80,80,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

ASS_HEADER_16_9 = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,56,&H00FFFFFF,&H0018FC53,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,0,2,80,80,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

ASPECT_HEADERS = {
    "9:16": ASS_HEADER_9_16,
    "1:1": ASS_HEADER_1_1,
    "16:9": ASS_HEADER_16_9,
}

# Group N words per caption block — sweet spot for short-form readability
WORDS_PER_BLOCK = 2

# Watermark style block to inject into the [V4+ Styles] section for free tier.
# Top-left, small, semi-transparent white. ~10% screen size, never blocks content.
WATERMARK_STYLE = (
    "Style: Watermark,Arial,32,&H80FFFFFF,&H80FFFFFF,&H80000000,&H00000000,"
    "1,0,0,0,100,100,0,0,1,2,0,7,40,40,40,1"
)


def _watermark_dialogue(duration_seconds: float) -> str:
    """Build a single dialogue line spanning the whole clip for the watermark."""
    end = _fmt_time(max(0.1, duration_seconds))
    return (
        f"Dialogue: 0,{_fmt_time(0)},{end},Watermark,,0,0,0,,"
        f"Made with Clipper.ai"
    )


def _fmt_time(seconds: float) -> str:
    """Format seconds → ASS time format (H:MM:SS.cc)."""
    if seconds < 0:
        seconds = 0
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _escape_ass_text(text: str) -> str:
    """Escape characters that have meaning in ASS dialogue lines."""
    return text.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")


def build_ass_subtitle(
    transcript: dict,
    clip_start: float,
    clip_end: float,
    aspect_ratio: str,
    watermark: bool = False,
) -> str:
    """
    Generate an ASS subtitle file for one clip window.

    Word timestamps in `transcript` are absolute (from the start of the
    source video). We shift them to be relative to clip_start so they
    align with the cut output.

    Words outside [clip_start, clip_end] are dropped.

    If `watermark=True` (Starter tier), a "Made with Clipper.ai" overlay
    is added in the top-left for the duration of the clip.
    """
    header = ASPECT_HEADERS.get(aspect_ratio)
    if not header:
        raise ValueError(f"Unsupported aspect ratio: {aspect_ratio}")

    # Inject watermark style into [V4+ Styles] block if requested
    if watermark:
        # Insert just before [Events]
        header = header.replace("[Events]", WATERMARK_STYLE + "\n\n[Events]")

    lines = [header]

    # Filter words inside the clip window, shift to clip-relative time
    words_in_clip = []
    for w in transcript.get("words", []):
        start = w.get("start", 0.0)
        end = w.get("end", 0.0)
        if end < clip_start or start > clip_end:
            continue
        text = w.get("punctuated") or w.get("word") or ""
        if not text.strip():
            continue
        words_in_clip.append(
            {
                "start": max(0.0, start - clip_start),
                "end": min(clip_end - clip_start, end - clip_start),
                "text": text,
            }
        )

    if not words_in_clip:
        log.warning("captions_no_words_in_window", start=clip_start, end=clip_end)
        if watermark:
            lines.append(_watermark_dialogue(clip_end - clip_start))
            return "\n".join(lines)
        return header  # empty subtitle is still valid ASS

    # Group into blocks of N consecutive words
    for i in range(0, len(words_in_clip), WORDS_PER_BLOCK):
        block = words_in_clip[i : i + WORDS_PER_BLOCK]
        block_start = block[0]["start"]
        block_end = block[-1]["end"]

        # Build the dialogue text with karaoke {\k} tags so the active word
        # is highlighted. \kN sets duration in centiseconds.
        parts = []
        for w in block:
            duration_cs = max(1, int((w["end"] - w["start"]) * 100))
            parts.append(f"{{\\kf{duration_cs}}}{_escape_ass_text(w['text'])}")
        dialogue_text = " ".join(parts)

        lines.append(
            f"Dialogue: 0,{_fmt_time(block_start)},{_fmt_time(block_end)},"
            f"Default,,0,0,0,,{dialogue_text}"
        )

    # Watermark spans the whole clip — appended after caption dialogues so
    # it renders on top.
    if watermark:
        lines.append(_watermark_dialogue(clip_end - clip_start))

    return "\n".join(lines)
