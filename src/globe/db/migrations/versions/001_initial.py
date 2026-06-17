"""Initial platform + regional schema

Revision ID: 001
"""

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass  # Tables created via init_db / regional bootstrap in dev


def downgrade() -> None:
    pass
