"""
Unit tests for Phase 4 rendering — pure logic only.

FFmpeg/R2 calls are exercised in integration tests, not here. These tests
cover the parts where production bugs hide: caption timing math, ASS
escaping, and aspect-ratio filter graph construction.
"""

import pytest

from app.core.captions import _escape_ass_text, _fmt_time, build_ass_subtitle
from app.core.renderer import ASPECT_DIMENSIONS, _build_filter_graph


# ──────────────────────────────────────────────────────────── _fmt_time


def test_fmt_time_zero():
    assert _fmt_time(0) == "0:00:00.00"


def test_fmt_time_subsecond():
    assert _fmt_time(0.42) == "0:00:00.42"


def test_fmt_time_minutes():
    assert _fmt_time(125.5) == "0:02:05.50"


def test_fmt_time_hours():
    assert _fmt_time(3725.25) == "1:02:05.25"


def test_fmt_time_negative_clamps_to_zero():
    assert _fmt_time(-5.0) == "0:00:00.00"


# ──────────────────────────────────────────────────────────── _escape_ass_text


def test_escape_ass_text_passes_normal():
    assert _escape_ass_text("Hello world") == "Hello world"


def test_escape_ass_text_escapes_braces():
    assert _escape_ass_text("a {b} c") == "a \\{b\\} c"


def test_escape_ass_text_escapes_backslash():
    assert _escape_ass_text("a\\b") == "a\\\\b"


# ──────────────────────────────────────────────────────────── build_ass_subtitle


def _make_transcript(words):
    """Helper to build a transcript dict with given word timings."""
    return {
        "words": [
            {"word": w["text"].lower(), "punctuated": w["text"], "start": w["start"], "end": w["end"]}
            for w in words
        ]
    }


def test_build_ass_subtitle_includes_header():
    transcript = _make_transcript([{"text": "Hi", "start": 0.0, "end": 0.5}])
    result = build_ass_subtitle(transcript, 0, 10, "9:16")
    assert "[Script Info]" in result
    assert "PlayResX: 1080" in result
    assert "PlayResY: 1920" in result
    assert "[Events]" in result


def test_build_ass_subtitle_emits_dialogue_lines():
    transcript = _make_transcript(
        [
            {"text": "Hello", "start": 0.0, "end": 0.5},
            {"text": "world", "start": 0.6, "end": 1.0},
        ]
    )
    result = build_ass_subtitle(transcript, 0, 10, "9:16")
    assert "Dialogue:" in result
    assert "Hello" in result
    assert "world" in result


def test_build_ass_subtitle_shifts_times_relative_to_clip_start():
    """Words at absolute time 100s should appear at 0s when clip starts at 100s."""
    transcript = _make_transcript(
        [{"text": "Late", "start": 100.0, "end": 100.5}]
    )
    result = build_ass_subtitle(transcript, 100.0, 105.0, "9:16")
    # The dialogue should start at 0:00:00.00, not 0:01:40.00
    assert "Dialogue: 0,0:00:00.00" in result


def test_build_ass_subtitle_drops_words_outside_window():
    transcript = _make_transcript(
        [
            {"text": "Before", "start": 5.0, "end": 5.5},
            {"text": "Inside", "start": 12.0, "end": 12.5},
            {"text": "After", "start": 25.0, "end": 25.5},
        ]
    )
    result = build_ass_subtitle(transcript, 10, 20, "9:16")
    assert "Inside" in result
    assert "Before" not in result
    assert "After" not in result


def test_build_ass_subtitle_handles_no_words_in_window():
    """If no words fall in the clip window, we should still return valid ASS."""
    transcript = _make_transcript(
        [{"text": "Far away", "start": 100.0, "end": 101.0}]
    )
    result = build_ass_subtitle(transcript, 0, 10, "9:16")
    # Header is present, no Dialogue lines
    assert "[Script Info]" in result
    assert "Dialogue:" not in result


def test_build_ass_subtitle_includes_karaoke_timing_tags():
    transcript = _make_transcript(
        [
            {"text": "First", "start": 0.0, "end": 0.5},
            {"text": "Second", "start": 0.5, "end": 1.0},
        ]
    )
    result = build_ass_subtitle(transcript, 0, 5, "9:16")
    # Karaoke timing tags are \kf followed by centiseconds
    assert "\\kf" in result


def test_build_ass_subtitle_unsupported_aspect_raises():
    transcript = _make_transcript([{"text": "Hi", "start": 0.0, "end": 0.5}])
    with pytest.raises(ValueError):
        build_ass_subtitle(transcript, 0, 5, "21:9")


def test_build_ass_subtitle_different_aspect_different_resolution():
    transcript = _make_transcript([{"text": "Hi", "start": 0.0, "end": 0.5}])
    r_916 = build_ass_subtitle(transcript, 0, 5, "9:16")
    r_11 = build_ass_subtitle(transcript, 0, 5, "1:1")
    r_169 = build_ass_subtitle(transcript, 0, 5, "16:9")
    assert "PlayResX: 1080" in r_916 and "PlayResY: 1920" in r_916
    assert "PlayResX: 1080" in r_11 and "PlayResY: 1080" in r_11
    assert "PlayResX: 1920" in r_169 and "PlayResY: 1080" in r_169


# ──────────────────────────────────────────────────────────── _build_filter_graph


def test_build_filter_graph_9_16():
    graph = _build_filter_graph("9:16", "/tmp/captions.ass")
    assert "scale=-2:1920" in graph
    assert "crop=1080:1920" in graph
    assert "subtitles=" in graph


def test_build_filter_graph_1_1():
    graph = _build_filter_graph("1:1", "/tmp/captions.ass")
    assert "scale=-2:1080" in graph
    assert "crop=1080:1080" in graph


def test_build_filter_graph_16_9():
    graph = _build_filter_graph("16:9", "/tmp/captions.ass")
    # 16:9 uses pad-to-fit instead of crop (source is usually already 16:9)
    assert "pad=1920:1080" in graph
    assert "subtitles=" in graph


def test_build_filter_graph_escapes_colons_in_path():
    """FFmpeg's filter syntax uses : as separator — paths need escaping."""
    graph = _build_filter_graph("9:16", "/some:weird/path.ass")
    assert "/some\\:weird/path.ass" in graph


def test_build_filter_graph_unsupported_aspect_raises():
    with pytest.raises(ValueError):
        _build_filter_graph("4:3", "/tmp/x.ass")


def test_aspect_dimensions_match_expected_resolutions():
    assert ASPECT_DIMENSIONS["9:16"] == (1080, 1920)
    assert ASPECT_DIMENSIONS["1:1"] == (1080, 1080)
    assert ASPECT_DIMENSIONS["16:9"] == (1920, 1080)
