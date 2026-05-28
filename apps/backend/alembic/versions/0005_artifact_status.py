"""add status column to artifacts

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-28

"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "artifacts",
        sa.Column("status", sa.String(20), nullable=False, server_default="tagged"),
    )
    op.alter_column("artifacts", "status", server_default=None)


def downgrade() -> None:
    op.drop_column("artifacts", "status")
