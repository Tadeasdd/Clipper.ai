"""
ORM models for Phase 1.

Schema is designed forward — fields like `virality_score`, `transcript_uri`,
and `rendered_clip_uri` exist now even though Phase 1 won't populate them.
This keeps Phase 2–4 as drop-in worker logic with no migration churn.
"""

from datetime import datetime
from enum import Enum as PyEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# ──────────────────────────────────────────────────────────── ENUMS


class JobStatus(str, PyEnum):
    QUEUED = "queued"
    TRANSCRIBING = "transcribing"
    SEGMENTING = "segmenting"
    SCORING = "scoring"
    RENDERING = "rendering"
    COMPLETE = "complete"
    FAILED = "failed"
    CANCELLED = "cancelled"   # user-requested cancellation; pipeline aborts on next step boundary


class PlanTier(str, PyEnum):
    STARTER = "starter"
    STUDIO = "studio"
    SCALE = "scale"
    ENTERPRISE = "enterprise"


# ──────────────────────────────────────────────────────────── MODELS


class Org(Base):
    """A workspace. Billing and usage attach here, not to individual users."""

    __tablename__ = "orgs"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    plan_tier: Mapped[PlanTier] = mapped_column(
        SAEnum(PlanTier, name="plan_tier"), default=PlanTier.STARTER, nullable=False
    )
    # Stripe linkage — populated in Phase 5
    stripe_customer_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    users: Mapped[list["User"]] = relationship(back_populates="org", cascade="all, delete-orphan")
    jobs: Mapped[list["Job"]] = relationship(back_populates="org", cascade="all, delete-orphan")


class User(Base):
    """A human. Belongs to one org (multi-org membership = Phase 5)."""

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Clerk user id — populated in Phase 5
    clerk_user_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    org: Mapped[Org] = relationship(back_populates="users")


class Job(Base):
    """
    A single upload → clips pipeline run.

    Status transitions through the 5-step pipeline. Each step writes intermediate
    artifacts (transcript, segments) so the next step can pick up cleanly even
    after a worker crash + retry.
    """

    __tablename__ = "jobs"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Source video
    source_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    source_r2_key: Mapped[str] = mapped_column(String(500), nullable=False)
    source_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    source_duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Pipeline state
    status: Mapped[JobStatus] = mapped_column(
        SAEnum(JobStatus, name="job_status"), default=JobStatus.QUEUED, nullable=False, index=True
    )
    progress_pct: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Intermediate artifacts (Phase 2+ populates these)
    transcript_r2_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    segments_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    org: Mapped[Org] = relationship(back_populates="jobs")
    clips: Mapped[list["Clip"]] = relationship(back_populates="job", cascade="all, delete-orphan")


class Clip(Base):
    """
    A scored, rendered short clip extracted from a job.

    Shape matches what the frontend results view consumes — see
    `generateMockClips()` in clipforge__2_.jsx.
    """

    __tablename__ = "clips"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    job_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    hook: Mapped[str] = mapped_column(Text, nullable=False)
    transcript_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timing
    start_seconds: Mapped[float] = mapped_column(nullable=False)
    end_seconds: Mapped[float] = mapped_column(nullable=False)
    duration_seconds: Mapped[float] = mapped_column(nullable=False)

    # Scoring (filled in Phase 3)
    virality_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    engagement_hook: Mapped[int | None] = mapped_column(Integer, nullable=True)
    engagement_retention: Mapped[int | None] = mapped_column(Integer, nullable=True)
    engagement_shareability: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reasons: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    platforms: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    # Renders (filled in Phase 4) — keyed by aspect ratio: "9:16", "1:1", "16:9"
    rendered_r2_keys: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    job: Mapped[Job] = relationship(back_populates="clips")


class UsageMinute(Base):
    """
    Upload-minute ledger. One row per job. Drives Stripe metered billing
    (Phase 5) and the quota enforcement on Starter/Studio/Scale tiers.
    """

    __tablename__ = "usage_minutes"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    billing_period: Mapped[str] = mapped_column(String(7), nullable=False, index=True)  # YYYY-MM

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class IdempotencyKey(Base):
    """
    Maps (org_id, idempotency_key) → job_id for safe retry of POST /v1/jobs.

    Clients pass an `Idempotency-Key` header on job creation. If the same
    key arrives again, we return the existing job instead of creating a
    duplicate. Keys are scoped per-org so two orgs picking the same UUID
    don't collide.

    Keys expire after 24h via the cleanup_old_keys() worker (Phase 6
    when we add scheduled Inngest functions).
    """

    __tablename__ = "idempotency_keys"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False
    )
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    job_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        # Different orgs can use the same string; same org can't.
        UniqueConstraint("org_id", "key", name="uq_idempotency_keys_org_key"),
    )


class ProcessedWebhook(Base):
    """
    Idempotency ledger for incoming Stripe webhooks.

    Stripe redelivers webhooks on 5xx and sometimes on network blips. If our
    handler partially succeeded (plan tier already flipped, but we crashed
    before returning 200), the retry would re-flip — usually a no-op since
    the update is idempotent, but logging twice creates noise. More
    importantly, this guards against bad handlers that aren't idempotent
    being added later.

    We store the event ID for 30 days (long enough to outlast Stripe's
    retry window of 3 days × 5 attempts).
    """

    __tablename__ = "processed_webhooks"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)  # "stripe", later "clerk"
    event_id: Mapped[str] = mapped_column(String(100), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        # Same provider can't replay the same event ID.
        UniqueConstraint("provider", "event_id", name="uq_processed_webhooks_provider_event"),
    )


class Feedback(Base):
    """
    Feedback left by a demo visitor.

    The whole point of the MVP is to collect reactions from the founders we
    send it to, so this is a first-class table rather than a Slack webhook or
    a Google Form. One row per submission. `clip_id` / `job_id` are optional —
    a visitor can leave general feedback or react to a specific clip.

    No FK to Org: in demo mode everything is the shared demo org, and we don't
    want a future "delete the demo org" cleanup to cascade away the feedback
    we collected. We store org_id as a plain column for grouping instead.
    """

    __tablename__ = "feedback"

    id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID | None] = mapped_column(PgUUID(as_uuid=True), nullable=True, index=True)

    # Who — optional; busy people won't always leave it.
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # What — rating is 1–5, message is freeform. At least one must be present
    # (enforced in the schema, not the DB, so we keep partial submissions).
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Optional context — what were they looking at when they reacted?
    job_id: Mapped[UUID | None] = mapped_column(PgUUID(as_uuid=True), nullable=True)
    clip_id: Mapped[UUID | None] = mapped_column(PgUUID(as_uuid=True), nullable=True)

    # Light provenance for triage — which page, what browser. Not PII-sensitive.
    context: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
