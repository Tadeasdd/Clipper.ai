"""demo mode: feedback table + seeded demo org/user

Revision ID: 0004_demo_and_feedback
Revises: 0003_perf_indexes
Create Date: 2026-05-31

Two things for the feedback-ready MVP:

    1. feedback — captures visitor reactions (rating/message/clip ref). This
       is the whole point of the MVP: collect signal from the founders we
       send it to, in one queryable place.

    2. A seeded demo org + user (DEMO_ORG_ID / DEMO_USER_ID from app.core.auth).
       When DEMO_MODE is on, every request resolves to this org with no Clerk
       sign-in. We seed the org as ENTERPRISE on purpose: rate limits are
       per-org, and in demo mode every visitor SHARES this one org, so the
       50x enterprise multiplier (read 3000/min, expensive 500/min) keeps a
       handful of simultaneous founders from 429-ing each other.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_demo_and_feedback"
down_revision: Union[str, None] = "0003_perf_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEMO_ORG_ID = "00000000-0000-0000-0000-0000000000d0"
DEMO_USER_ID = "00000000-0000-0000-0000-0000000000d1"


def upgrade() -> None:
    # 1. feedback table
    op.create_table(
        "feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("clip_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("context", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_feedback_org_id", "feedback", ["org_id"])

    # 2. Seed the demo org (ENTERPRISE for rate-limit headroom) + demo user.
    #    ON CONFLICT DO NOTHING so re-running against a partly-seeded DB is safe.
    op.execute(
        f"""
        INSERT INTO orgs (id, name, plan_tier)
        VALUES ('{DEMO_ORG_ID}', 'Clipper Demo', 'enterprise')
        ON CONFLICT (id) DO NOTHING
        """
    )
    op.execute(
        f"""
        INSERT INTO users (id, org_id, clerk_user_id, email, name)
        VALUES ('{DEMO_USER_ID}', '{DEMO_ORG_ID}', 'demo_user',
                'demo@clipper.ai', 'Demo Visitor')
        ON CONFLICT (id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(f"DELETE FROM users WHERE id = '{DEMO_USER_ID}'")
    op.execute(f"DELETE FROM orgs WHERE id = '{DEMO_ORG_ID}'")
    op.drop_index("ix_feedback_org_id", table_name="feedback")
    op.drop_table("feedback")
