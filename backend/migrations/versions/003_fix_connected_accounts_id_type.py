"""Fix connected_accounts id type to text

Revision ID: 003_fix_ca_id
Revises: 002_add_connected_accounts
Create Date: 2026-03-03
"""
from alembic import op

revision = "003_fix_ca_id"
down_revision = "002_add_connected_accounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE connected_accounts ALTER COLUMN id TYPE text USING id::text")


def downgrade() -> None:
    op.execute("ALTER TABLE connected_accounts ALTER COLUMN id TYPE uuid USING id::uuid")
