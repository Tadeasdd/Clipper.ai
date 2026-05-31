"""
Deepgram Nova-3 transcription.

Why Nova-3 over Whisper API:
    - ~2x faster (real-time factor ~0.08 vs ~0.15)
    - Better diarization (speaker labels) out of the box
    - Cheaper: $0.0043/min vs $0.006/min
    - Returns word-level timestamps with punctuation already aligned

Output shape — what _segment + later phases consume:

    {
        "duration_seconds": float,
        "language": "en",
        "words": [
            {
                "word": "the",
                "start": 0.42,
                "end": 0.51,
                "confidence": 0.99,
                "speaker": 0,
                "punctuated": "The"
            },
            ...
        ],
        "utterances": [
            {"start": 0.4, "end": 4.2, "speaker": 0, "text": "The thing is..."},
            ...
        ]
    }
"""

import structlog
from deepgram import DeepgramClient, FileSource, PrerecordedOptions

from app.core.config import get_settings

log = structlog.get_logger()


def _client() -> DeepgramClient:
    return DeepgramClient(api_key=get_settings().deepgram_api_key)


async def transcribe(audio_bytes: bytes) -> dict:
    """
    Send audio to Deepgram Nova-3 and return normalized word/utterance JSON.

    Deepgram's SDK is sync for prerecorded — we call it directly since this
    is already inside an Inngest step (async worker thread).
    """
    if not audio_bytes:
        raise ValueError("empty audio_bytes")

    options = PrerecordedOptions(
        model="nova-3",
        smart_format=True,        # adds punctuation, capitalization
        diarize=True,             # speaker labels
        punctuate=True,
        utterances=True,          # group words into utterances per speaker
        language="en",            # multilingual support added in Phase 6 if customers ask
    )
    source: FileSource = {"buffer": audio_bytes}

    log.info("deepgram_request", audio_bytes=len(audio_bytes))
    resp = _client().listen.rest.v("1").transcribe_file(source, options)

    # Convert SDK object → plain dict we control the shape of
    result = resp.to_dict() if hasattr(resp, "to_dict") else resp

    return _normalize(result)


def _normalize(raw: dict) -> dict:
    """
    Flatten Deepgram's nested response into the shape downstream code expects.

    Deepgram returns results.channels[0].alternatives[0].{transcript, words}.
    We want a flat words list + utterances list at the top level.
    """
    try:
        metadata = raw.get("metadata", {})
        duration = metadata.get("duration", 0.0)

        channel = raw["results"]["channels"][0]
        alt = channel["alternatives"][0]

        words = [
            {
                "word": w.get("word", ""),
                "start": w.get("start", 0.0),
                "end": w.get("end", 0.0),
                "confidence": w.get("confidence", 0.0),
                "speaker": w.get("speaker", 0),
                "punctuated": w.get("punctuated_word", w.get("word", "")),
            }
            for w in alt.get("words", [])
        ]

        utterances = [
            {
                "start": u.get("start", 0.0),
                "end": u.get("end", 0.0),
                "speaker": u.get("speaker", 0),
                "text": u.get("transcript", ""),
            }
            for u in raw.get("results", {}).get("utterances", [])
        ]

        # If diarization didn't produce utterances (short audio), synthesize one
        # from the full transcript so downstream segmentation has something to chew on.
        if not utterances and alt.get("transcript"):
            utterances = [
                {
                    "start": words[0]["start"] if words else 0.0,
                    "end": words[-1]["end"] if words else duration,
                    "speaker": 0,
                    "text": alt["transcript"],
                }
            ]

        return {
            "duration_seconds": duration,
            "language": metadata.get("model_info", {}).get("language", "en"),
            "words": words,
            "utterances": utterances,
        }
    except (KeyError, IndexError) as e:
        log.error("deepgram_unexpected_shape", error=str(e))
        raise RuntimeError(f"Deepgram returned unexpected shape: {e}") from e
