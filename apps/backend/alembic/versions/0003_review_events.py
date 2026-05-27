"""create review_events table

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-27

"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "review_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False, index=True),
        sa.Column(
            "artifact_id",
            sa.String(36),
            sa.ForeignKey("artifacts.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("outcome", sa.String(10), nullable=False),
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("review_events")
