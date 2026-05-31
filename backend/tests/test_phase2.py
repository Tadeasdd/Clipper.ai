"""
Unit tests for Phase 2 — the pure logic that doesn't need network access.

Network-touching code (Deepgram, Anthropic, FFmpeg, R2) is exercised in
integration tests, not here.
"""

import pytest

from app.core.anthropic_client import _extract_json, _filter_valid_beats
from app.core.deepgram_client import _normalize


# ──────────────────────────────────────────────────────────── JSON extraction


def test_extract_json_clean():
    assert _extract_json('{"a": 1}') == {"a": 1}


def test_extract_json_with_markdown_fences():
    text = '```json\n{"beats": [{"start_seconds": 1.0}]}\n```'
    assert _extract_json(text) == {"beats": [{"start_seconds": 1.0}]}


def test_extract_json_with_prose_prefix():
    text = 'Here you go:\n{"beats": []}\nLet me know if you need more.'
    assert _extract_json(text) == {"beats": []}


def test_extract_json_with_plain_fences():
    text = "```\n{\"x\": true}\n```"
    assert _extract_json(text) == {"x": True}


# ──────────────────────────────────────────────────────────── Beat filtering


def test_filter_valid_beats_keeps_good():
    beats = [
        {
            "start_seconds": 10.0,
            "end_seconds": 50.0,
            "topic": "Good clip",
            "hook_quote": "This is the hook",
        }
    ]
    valid = _filter_valid_beats(beats, max_duration=300)
    assert len(valid) == 1
    assert valid[0]["duration_seconds"] == 40.0


def test_filter_valid_beats_drops_too_short():
    beats = [{"start_seconds": 10.0, "end_seconds": 15.0, "hook_quote": "x"}]  # 5s, under 20s min
    assert _filter_valid_beats(beats, max_duration=300) == []


def test_filter_valid_beats_drops_too_long():
    beats = [{"start_seconds": 10.0, "end_seconds": 130.0, "hook_quote": "x"}]  # 120s, over 90s max
    assert _filter_valid_beats(beats, max_duration=300) == []


def test_filter_valid_beats_drops_no_hook():
    beats = [{"start_seconds": 10.0, "end_seconds": 50.0, "topic": "x"}]  # no hook_quote
    assert _filter_valid_beats(beats, max_duration=300) == []


def test_filter_valid_beats_drops_out_of_range():
    beats = [
        {"start_seconds": 10.0, "end_seconds": 50.0, "hook_quote": "h"},
        {"start_seconds": 500.0, "end_seconds": 540.0, "hook_quote": "h"},  # past end
    ]
    valid = _filter_valid_beats(beats, max_duration=300)
    assert len(valid) == 1


def test_filter_valid_beats_drops_malformed():
    beats = [
        {"start_seconds": "not a number", "end_seconds": 50.0, "hook_quote": "h"},
        {"end_seconds": 50.0, "hook_quote": "h"},  # missing start
    ]
    assert _filter_valid_beats(beats, max_duration=300) == []


# ──────────────────────────────────────────────────────────── Deepgram normalization


def test_normalize_basic_deepgram_response():
    raw = {
        "metadata": {"duration": 120.5, "model_info": {"language": "en"}},
        "results": {
            "channels": [
                {
                    "alternatives": [
                        {
                            "transcript": "Hello world this is a test",
                            "words": [
                                {
                                    "word": "hello",
                                    "punctuated_word": "Hello",
                                    "start": 0.5,
                                    "end": 0.9,
                                    "confidence": 0.99,
                                    "speaker": 0,
                                },
                                {
                                    "word": "world",
                                    "punctuated_word": "world",
                                    "start": 1.0,
                                    "end": 1.4,
                                    "confidence": 0.98,
                                    "speaker": 0,
                                },
                            ],
                        }
                    ]
                }
            ],
            "utterances": [
                {
                    "start": 0.5,
                    "end": 1.4,
                    "speaker": 0,
                    "transcript": "Hello world",
                }
            ],
        },
    }

    result = _normalize(raw)
    assert result["duration_seconds"] == 120.5
    assert len(result["words"]) == 2
    assert result["words"][0]["punctuated"] == "Hello"
    assert len(result["utterances"]) == 1


def test_normalize_synthesizes_utterance_when_missing():
    raw = {
        "metadata": {"duration": 5.0},
        "results": {
            "channels": [
                {
                    "alternatives": [
                        {
                            "transcript": "Short clip",
                            "words": [
                                {"word": "short", "start": 0.0, "end": 0.5, "confidence": 0.99},
                                {"word": "clip", "start": 0.6, "end": 1.0, "confidence": 0.99},
                            ],
                        }
                    ]
                }
            ],
            # no top-level utterances
        },
    }

    result = _normalize(raw)
    assert len(result["utterances"]) == 1
    assert result["utterances"][0]["text"] == "Short clip"


def test_normalize_raises_on_unexpected_shape():
    with pytest.raises(RuntimeError):
        _normalize({"some": "garbage"})
