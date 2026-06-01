"""add media_key column to captures

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-01

"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "captures",
        sa.Column("media_key", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("captures", "media_key")
