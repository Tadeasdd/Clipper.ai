"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums
    plan_tier = postgresql.ENUM(
        "starter", "studio", "scale", "enterprise", name="plan_tier", create_type=False
    )
    plan_tier.create(op.get_bind(), checkfirst=True)

    job_status = postgresql.ENUM(
        "queued",
        "transcribing",
        "segmenting",
        "scoring",
        "rendering",
        "complete",
        "failed",
        name="job_status",
        create_type=False,
    )
    job_status.create(op.get_bind(), checkfirst=True)

    # orgs
    op.create_table(
        "orgs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("plan_tier", plan_tier, nullable=False, server_default="starter"),
        sa.Column("stripe_customer_id", sa.String(100), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("clerk_user_id", sa.String(100), unique=True, nullable=True),
        sa.Column("email", sa.String(320), unique=True, nullable=False),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_org_id", "users", ["org_id"])
    op.create_index("ix_users_email", "users", ["email"])

    # jobs
    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_filename", sa.String(500), nullable=False),
        sa.Column("source_r2_key", sa.String(500), nullable=False),
        sa.Column("source_size_bytes", sa.BigInteger, nullable=True),
        sa.Column("source_duration_seconds", sa.Integer, nullable=True),
        sa.Column("status", job_status, nullable=False, server_default="queued"),
        sa.Column("progress_pct", sa.Integer, nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("transcript_r2_key", sa.String(500), nullable=True),
        sa.Column("segments_json", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_jobs_org_id", "jobs", ["org_id"])
    op.create_index("ix_jobs_status", "jobs", ["status"])

    # clips
    op.create_table(
        "clips",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("hook", sa.Text, nullable=False),
        sa.Column("transcript_excerpt", sa.Text, nullable=True),
        sa.Column("start_seconds", sa.Float, nullable=False),
        sa.Column("end_seconds", sa.Float, nullable=False),
        sa.Column("duration_seconds", sa.Float, nullable=False),
        sa.Column("virality_score", sa.Integer, nullable=True),
        sa.Column("engagement_hook", sa.Integer, nullable=True),
        sa.Column("engagement_retention", sa.Integer, nullable=True),
        sa.Column("engagement_shareability", sa.Integer, nullable=True),
        sa.Column("reasons", sa.JSON, nullable=True),
        sa.Column("platforms", sa.JSON, nullable=True),
        sa.Column("rendered_r2_keys", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_clips_job_id", "clips", ["job_id"])

    # usage_minutes
    op.create_table(
        "usage_minutes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("minutes", sa.Integer, nullable=False),
        sa.Column("billing_period", sa.String(7), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_usage_minutes_org_id", "usage_minutes", ["org_id"])
    op.create_index("ix_usage_minutes_billing_period", "usage_minutes", ["billing_period"])

    # Phase 1 dev org — so the hard-coded DEV_ORG_ID works without a seed step
    op.execute(
        """
        INSERT INTO orgs (id, name, plan_tier)
        VALUES ('00000000-0000-0000-0000-000000000001', 'Dev Org', 'starter')
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.drop_table("usage_minutes")
    op.drop_table("clips")
    op.drop_table("jobs")
    op.drop_table("users")
    op.drop_table("orgs")
    op.execute("DROP TYPE IF EXISTS job_status")
    op.execute("DROP TYPE IF EXISTS plan_tier")
