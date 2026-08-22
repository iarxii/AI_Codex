"""add user_mcp_servers table

Revision ID: add_user_mcp_servers
Revises: add_integration_tables
Create Date: 2026-08-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_user_mcp_servers'
down_revision: Union[str, Sequence[str], None] = 'add_integration_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - create user_mcp_servers table only."""
    op.create_table(
        'user_mcp_servers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('transport_type', sa.String(length=20), nullable=False),
        sa.Column('command', sa.Text(), nullable=True),
        sa.Column('args_json', sa.Text(), nullable=True),
        sa.Column('cwd', sa.Text(), nullable=True),
        sa.Column('env_json', sa.Text(), nullable=True),
        sa.Column('url', sa.Text(), nullable=True),
        sa.Column('headers_json', sa.Text(), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='disconnected'),
        sa.Column('last_connected_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_mcp_servers_user_id'), 'user_mcp_servers', ['user_id'], unique=False)
    op.create_index('ix_user_mcp_servers_user_name', 'user_mcp_servers', ['user_id', 'name'], unique=True)


def downgrade() -> None:
    """Downgrade schema - drop user_mcp_servers table."""
    op.drop_index('ix_user_mcp_servers_user_name', table_name='user_mcp_servers')
    op.drop_index(op.f('ix_user_mcp_servers_user_id'), table_name='user_mcp_servers')
    op.drop_table('user_mcp_servers')