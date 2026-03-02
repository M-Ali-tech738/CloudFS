"""Add connected_accounts table for multi-account support

Revision ID: 002_add_connected_accounts
Revises: 001_initial
Create Date: 2026-03-02
"""
from alembic import op
import sqlalchemy as sa


revision = "002_add_connected_accounts"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create connected_accounts table
    op.create_table(
        "connected_accounts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_user_id", sa.String(), nullable=False),
        sa.Column("google_sub", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=True),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column("encrypted_refresh_token", sa.LargeBinary(), nullable=False),
        sa.Column("refresh_token_iv", sa.LargeBinary(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked", sa.Boolean(), server_default="false", nullable=False),
    )
    
    # Create indexes
    op.create_index("ix_connected_accounts_owner_user_id", "connected_accounts", ["owner_user_id"])
    op.create_index("ix_connected_accounts_google_sub", "connected_accounts", ["google_sub"])
    
    # Add constraint: unique google_sub per owner_user_id
    op.create_unique_constraint(
        "uq_owner_google_sub", 
        "connected_accounts", 
        ["owner_user_id", "google_sub"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_owner_google_sub", "connected_accounts")
    op.drop_index("ix_connected_accounts_google_sub")
    op.drop_index("ix_connected_accounts_owner_user_id")
    op.drop_table("connected_accounts")
