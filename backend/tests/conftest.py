"""
Test-wide setup. Runs before any test module is imported.

We set test-friendly env vars here so that get_settings() — which is
@lru_cache-d in the app — picks them up before being instantiated.
This is the only reliable place to do it; doing it inside a test file
is too late if any other test imported the config first.
"""

import os

# Database URL — never actually used, but Pydantic settings require it
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")

# Stripe — needed for billing._price_to_plan / _plan_to_price tests
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_dummy")
os.environ.setdefault("STRIPE_PRICE_STARTER", "price_starter_xxx")
os.environ.setdefault("STRIPE_PRICE_STUDIO", "price_studio_xxx")
os.environ.setdefault("STRIPE_PRICE_SCALE", "price_scale_xxx")
