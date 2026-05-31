"""hardening: cancelled status + idempotency + webhook dedupe tables

Revision ID: 0002_hardening
Revises: 0001_initial
Create Date: 2026-05-26

Adds three things needed for production hardening:
    1. JobStatus.CANCELLED — for user-requested job cancellation
    2. idempotency_keys — for safe retry of POST /v1/jobs
    3. processed_webhooks — for at-most-once webhook handling
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_hardening"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add CANCELLED to the job_status enum.
    # ALTER TYPE ... ADD VALUE is the standard Postgres way; can't be in
    # a transaction block, so we COMMIT first via op.execute.
    op.execute("ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'cancelled'")

    # 2. idempotency_keys
    op.create_table(
        "idempotency_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orgs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(255), nullable=False),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("org_id", "key", name="uq_idempotency_keys_org_key"),
    )
    op.create_index(
        "ix_idempotency_keys_created_at",
        "idempotency_keys",
        ["created_at"],
    )

    # 3. processed_webhooks
    op.create_table(
        "processed_webhooks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("event_id", sa.String(100), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column(
            "processed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "provider", "event_id", name="uq_processed_webhooks_provider_event"
        ),
    )
    op.create_index(
        "ix_processed_webhooks_processed_at",
        "processed_webhooks",
        ["processed_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_processed_webhooks_processed_at", "processed_webhooks")
    op.drop_table("processed_webhooks")
    op.drop_index("ix_idempotency_keys_created_at", "idempotency_keys")
    op.drop_table("idempotency_keys")
    # Note: Postgres doesn't support removing enum values without recreating
    # the type. Skip the cancelled removal on downgrade — leaving the value
    # in the enum is harmless if no rows use it.
