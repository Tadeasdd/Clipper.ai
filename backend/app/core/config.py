"""Application settings, loaded from environment variables."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_env: Literal["development", "staging", "production"] = "development"
    log_level: str = "INFO"

    # Database
    database_url: str

    # Cloudflare R2
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "clipper-uploads"
    r2_endpoint: str = ""

    # Inngest
    inngest_app_id: str = "clipper-backend"
    inngest_event_key: str = ""
    inngest_signing_key: str = ""

    # CORS — comma-separated list
    cors_origins: str = "http://localhost:3000"

    # Phase 2: Transcription + LLM
    deepgram_api_key: str = ""
    anthropic_api_key: str = ""
    ffmpeg_bin: str = "ffmpeg"

    # Phase 5: Auth (Clerk)
    clerk_jwks_url: str = ""
    clerk_issuer: str = ""
    clerk_webhook_secret: str = ""

    # Phase 5: Billing (Stripe)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_starter: str = ""
    stripe_price_studio: str = ""
    stripe_price_scale: str = ""
    stripe_checkout_success_url: str = "http://localhost:3000/billing/success"
    stripe_checkout_cancel_url: str = "http://localhost:3000/pricing"

    # Phase 5: Dev mode — when set, skip Clerk and use DEV_ORG_ID for all requests.
    # Useful for local testing without setting up Clerk. Never enable in production.
    dev_mode_skip_auth: bool = False

    # MVP demo mode — when set, skip Clerk and route every request to the shared
    # DEMO_ORG_ID. Unlike dev_mode_skip_auth, this is *meant* to run in a public
    # deployment: it's how we send a no-sign-in-wall demo to people for feedback.
    # It does NOT touch Stripe (the demo org sits on a generous demo quota) and
    # it leaves the showcase jobs seeded by seed_demo.py visible to everyone.
    demo_mode: bool = False

    # Admin token guarding GET /v1/feedback (so visitor emails/messages aren't
    # publicly listable in a demo deployment). Leave empty to disable reads
    # entirely — you can still query the feedback table directly in the DB.
    admin_token: str = ""

    # Sentry — leave empty to disable. Set in production.
    sentry_dsn: str = ""
    sentry_environment: str = "development"
    sentry_traces_sample_rate: float = 0.1  # 10% of requests get full traces

    # Rate limiting (per-org, per-minute).
    # Tuned per tier in app/core/rate_limit.py; this is the global override.
    rate_limit_enabled: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_dev(self) -> bool:
        return self.app_env == "development"

    @property
    def skip_clerk_auth(self) -> bool:
        """
        True when Clerk verification should be bypassed — either local dev
        (dev_mode_skip_auth) or a public no-login demo (demo_mode). The auth
        dependency reads this; the two modes differ only in which org they
        resolve to.
        """
        return self.dev_mode_skip_auth or self.demo_mode

    @property
    def testing(self) -> bool:
        """True under pytest. Used to silence the SQL echo + skip startup checks."""
        import sys
        return "pytest" in sys.modules


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor — instantiated once per process."""
    return Settings()
