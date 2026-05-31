"""indexes for pagination + cleanup lookups

Revision ID: 0003_perf_indexes
Revises: 0002_hardening
Create Date: 2026-05-26

Two indexes added in support of post-hardening features:

    1. ix_jobs_org_created  (jobs.org_id, jobs.created_at DESC)
       Composite index for the paginated list query:
            WHERE org_id = ? ORDER BY created_at DESC LIMIT N
       Without this we'd do an index scan on org_id (already indexed) then
       a sort — fine for 100 jobs per org, painful at 10k.

    2. ix_jobs_source_r2_key  (jobs.source_r2_key)
       Used by the cleanup_orphan_uploads cron, which does
            WHERE source_r2_key IN (... up to 500 keys ...)
       to identify which R2 candidate keys are referenced by a Job. Without
       this it's a seq scan per cron run.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003_perf_indexes"
down_revision: Union[str, None] = "0002_hardening"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_jobs_org_created",
        "jobs",
        ["org_id", "created_at"],
        postgresql_using="btree",
        # We want DESC on created_at so the pagination query is index-ordered.
        # Postgres supports per-column DESC in btree indexes.
        postgresql_ops={"created_at": "DESC"},
    )
    op.create_index(
        "ix_jobs_source_r2_key",
        "jobs",
        ["source_r2_key"],
    )


def downgrade() -> None:
    op.drop_index("ix_jobs_source_r2_key", "jobs")
    op.drop_index("ix_jobs_org_created", "jobs")
