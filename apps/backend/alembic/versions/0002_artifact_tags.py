"""add tags column to artifacts

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-27

"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "artifacts",
        sa.Column("tags", JSONB(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("artifacts", "tags")
