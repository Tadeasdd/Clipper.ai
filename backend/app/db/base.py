"""
Async SQLAlchemy engine, session factory, and FastAPI dependency.

# Pool tuning

    pool_size=10        Persistent connections per process.
    max_overflow=20     Extra connections under burst (closed after use).
    pool_pre_ping=True  Verify the connection is alive before checkout —
                        survives DB restarts and stale connections through
                        firewalls / load balancers.
    pool_recycle=1800   Recycle connections older than 30 min. Supabase and
                        most managed Postgres setups will idle-kill anything
                        older than ~10 min in their pooler. Recycling
                        ourselves keeps the symptom (mystery 500s) away.

With 2 API replicas + 4 worker replicas, that's 6 * 10 = 60 baseline
connections. Supabase free tier allows 60 direct connections; the worker
runs through pgbouncer in production.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    pass


_settings = get_settings()

engine = create_async_engine(
    _settings.database_url,
    # Only echo in dev. In tests, the env var is set but we don't want noise.
    echo=_settings.is_dev and not _settings.testing,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields a request-scoped DB session.

    The `async with` context manager guarantees session.close() runs even
    on exception. We additionally rollback on exception to drop any
    uncommitted state — without this, a half-flushed transaction would
    stay open until close, which under load can hold row locks for
    longer than necessary.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
