"""
Unit tests for Phase 3 scoring — pure logic only.

The actual Claude API call is mocked in integration tests. Here we focus
on the validation/clamping/fallback paths since those are where real
production bugs hide (LLMs return weird shapes more often than they fail).
"""

import pytest

from app.core.scorer import (
    _clamp_score,
    _clip_transcript_window,
    _extract_json,
    _validate_score,
)


# ──────────────────────────────────────────────────────────── _clamp_score


def test_clamp_score_keeps_valid():
    assert _clamp_score(75) == 75


def test_clamp_score_caps_at_100():
    assert _clamp_score(150) == 100


def test_clamp_score_floors_at_0():
    assert _clamp_score(-20) == 0


def test_clamp_score_coerces_float():
    assert _clamp_score(87.6) == 88


def test_clamp_score_coerces_string():
    assert _clamp_score("82") == 82


def test_clamp_score_returns_default_on_garbage():
    assert _clamp_score(None) == 50
    assert _clamp_score("not a number") == 50
    assert _clamp_score({}) == 50


# ──────────────────────────────────────────────────────────── _validate_score


_BEAT = {
    "topic": "Stub topic",
    "hook_quote": "Original hook",
    "start_seconds": 10.0,
    "end_seconds": 50.0,
    "duration_seconds": 40.0,
    "summary": "A summary",
}


def test_validate_score_happy_path():
    raw = {
        "virality_score": 87,
        "engagement": {"hook": 92, "retention": 84, "shareability": 85},
        "reasons": ["Strong opening", "Specific numbers", "Self-contained payoff"],
        "platforms": ["TikTok", "Reels"],
        "title": "Polished title",
        "polished_hook": "Polished hook",
    }
    result = _validate_score(raw, _BEAT)
    assert result["virality_score"] == 87
    assert result["engagement_hook"] == 92
    assert result["engagement_retention"] == 84
    assert result["engagement_shareability"] == 85
    assert result["reasons"] == ["Strong opening", "Specific numbers", "Self-contained payoff"]
    assert result["platforms"] == ["TikTok", "Reels"]
    assert result["title"] == "Polished title"
    assert result["polished_hook"] == "Polished hook"


def test_validate_score_derives_virality_when_missing():
    """If virality_score is missing, derive from hook*0.4 + retention*0.3 + shareability*0.3."""
    raw = {
        "engagement": {"hook": 100, "retention": 50, "shareability": 50},
        "reasons": ["test"],
        "platforms": ["TikTok"],
        "title": "x",
        "polished_hook": "y",
    }
    result = _validate_score(raw, _BEAT)
    # 100*0.4 + 50*0.3 + 50*0.3 = 40 + 15 + 15 = 70
    assert result["virality_score"] == 70


def test_validate_score_clamps_out_of_range_values():
    raw = {
        "virality_score": 150,
        "engagement": {"hook": -10, "retention": 999, "shareability": "high"},
        "reasons": ["x"],
        "platforms": ["TikTok"],
        "title": "x",
        "polished_hook": "y",
    }
    result = _validate_score(raw, _BEAT)
    assert result["virality_score"] == 100
    assert result["engagement_hook"] == 0
    assert result["engagement_retention"] == 100
    assert result["engagement_shareability"] == 50  # garbage → default


def test_validate_score_filters_invalid_platforms():
    raw = {
        "virality_score": 80,
        "engagement": {"hook": 80, "retention": 80, "shareability": 80},
        "reasons": ["x"],
        "platforms": ["TikTok", "Facebook", "Reels", "Snapchat", "Shorts"],  # FB/Snap invalid
        "title": "x",
        "polished_hook": "y",
    }
    result = _validate_score(raw, _BEAT)
    assert result["platforms"] == ["TikTok", "Reels", "Shorts"]


def test_validate_score_defaults_platforms_when_all_invalid():
    raw = {
        "virality_score": 80,
        "engagement": {"hook": 80, "retention": 80, "shareability": 80},
        "reasons": ["x"],
        "platforms": ["Facebook", "Snapchat"],
        "title": "x",
        "polished_hook": "y",
    }
    result = _validate_score(raw, _BEAT)
    assert result["platforms"] == ["TikTok", "Reels", "Shorts"]


def test_validate_score_caps_reasons_at_5():
    raw = {
        "virality_score": 80,
        "engagement": {"hook": 80, "retention": 80, "shareability": 80},
        "reasons": ["1", "2", "3", "4", "5", "6", "7"],
        "platforms": ["TikTok"],
        "title": "x",
        "polished_hook": "y",
    }
    result = _validate_score(raw, _BEAT)
    assert len(result["reasons"]) == 5


def test_validate_score_handles_missing_engagement():
    raw = {
        "virality_score": 80,
        "reasons": ["x"],
        "platforms": ["TikTok"],
        "title": "x",
        "polished_hook": "y",
    }
    result = _validate_score(raw, _BEAT)
    # All three engagement dims default to 50
    assert result["engagement_hook"] == 50
    assert result["engagement_retention"] == 50
    assert result["engagement_shareability"] == 50


def test_validate_score_falls_back_to_beat_data():
    """If Claude omits title/hook, fall back to the raw segmentation data."""
    raw = {
        "virality_score": 80,
        "engagement": {"hook": 80, "retention": 80, "shareability": 80},
        "reasons": ["x"],
        "platforms": ["TikTok"],
    }
    result = _validate_score(raw, _BEAT)
    assert result["title"] == "Stub topic"
    assert result["polished_hook"] == "Original hook"


def test_validate_score_handles_empty_reasons():
    raw = {
        "virality_score": 80,
        "engagement": {"hook": 80, "retention": 80, "shareability": 80},
        "reasons": [],
        "platforms": ["TikTok"],
        "title": "x",
        "polished_hook": "y",
    }
    result = _validate_score(raw, _BEAT)
    assert len(result["reasons"]) == 1
    assert "review" in result["reasons"][0].lower()


# ──────────────────────────────────────────────────────────── _clip_transcript_window


def test_clip_transcript_window_includes_overlapping():
    transcript = {
        "utterances": [
            {"start": 0.0, "end": 5.0, "text": "Before"},
            {"start": 9.0, "end": 15.0, "text": "Overlaps start"},
            {"start": 20.0, "end": 25.0, "text": "Inside"},
            {"start": 28.0, "end": 35.0, "text": "Overlaps end"},
            {"start": 100.0, "end": 105.0, "text": "After"},
        ]
    }
    result = _clip_transcript_window(transcript, start=10.0, end=30.0)
    assert "Overlaps start" in result
    assert "Inside" in result
    assert "Overlaps end" in result
    assert "Before" not in result
    assert "After" not in result


def test_clip_transcript_window_empty_returns_placeholder():
    transcript = {"utterances": []}
    result = _clip_transcript_window(transcript, start=0.0, end=10.0)
    assert "no transcript" in result.lower()


# ──────────────────────────────────────────────────────────── _extract_json (scorer copy)


def test_extract_json_handles_markdown_fences():
    text = '```json\n{"virality_score": 87}\n```'
    assert _extract_json(text) == {"virality_score": 87}


def test_extract_json_handles_prose_prefix():
    text = 'Sure! Here is the score:\n{"virality_score": 87}\nLet me know.'
    assert _extract_json(text) == {"virality_score": 87}
