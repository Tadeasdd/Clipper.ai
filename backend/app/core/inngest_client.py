"""
Inngest client.

Inngest handles long-running, multi-step jobs with durable retries. Each step
in the pipeline (transcribe, segment, score, render) is registered as a step
in `app.workers.pipeline` — if any step fails, Inngest retries just that step
without re-running upstream work.
"""

import inngest

from app.core.config import get_settings

_settings = get_settings()

inngest_client = inngest.Inngest(
    app_id=_settings.inngest_app_id,
    event_key=_settings.inngest_event_key or None,
    signing_key=_settings.inngest_signing_key or None,
    is_production=not _settings.is_dev,
)
