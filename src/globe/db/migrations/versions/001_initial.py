"""Initial platform schema

Revision ID: 001
Revises:
Create Date: 2026-06-13
"""

from alembic import op

from globe.db.base import PlatformBase
from globe.db import platform_models  # noqa: F401

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    PlatformBase.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    PlatformBase.metadata.drop_all(bind=bind)
