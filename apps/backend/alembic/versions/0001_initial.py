"""initial captures and artifacts tables

Revision ID: 0001
Revises:
Create Date: 2026-05-26

"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "captures",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("mode", sa.String(), nullable=False),
        sa.Column("raw_content", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_captures_user_id", "captures", ["user_id"])

    op.create_table(
        "artifacts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("capture_id", sa.String(36), sa.ForeignKey("captures.id"), nullable=False),
        sa.Column("artifact_type", sa.String(), nullable=False),
        sa.Column("content", JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_artifacts_capture_id", "artifacts", ["capture_id"])


def downgrade() -> None:
    op.drop_index("ix_artifacts_capture_id", "artifacts")
    op.drop_table("artifacts")
    op.drop_index("ix_captures_user_id", "captures")
    op.drop_table("captures")
