"""
Inngest webhook integration.

Inngest's serve handler exposes /api/inngest. Inngest's dev server (and prod
cloud) calls this endpoint to invoke registered functions. We register all
worker functions here — the main job pipeline plus the Phase 6.5 scheduled
cleanup crons.
"""

import inngest.fast_api

from app.core.inngest_client import inngest_client
from app.workers.cleanup import (
    cleanup_idempotency_keys,
    cleanup_orphan_uploads,
    cleanup_processed_webhooks,
)
from app.workers.pipeline import process_job


def register_inngest(app):
    """Attach the Inngest serve handler to a FastAPI app."""
    inngest.fast_api.serve(
        app,
        inngest_client,
        [
            process_job,
            cleanup_idempotency_keys,
            cleanup_processed_webhooks,
            cleanup_orphan_uploads,
        ],
    )
