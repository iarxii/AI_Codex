"""add cloud inference connection support

Revision ID: add_cloud_inference_connections
Revises: add_user_mcp_servers
Create Date: 2026-09-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_cloud_inference_connections'
down_revision: Union[str, Sequence[str], None] = 'add_user_mcp_servers'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add connection_type to integration_providers and config_json to user_connections."""
    op.add_column(
        'integration_providers',
        sa.Column('connection_type', sa.String(length=20), nullable=False, server_default='oauth'),
    )
    op.add_column(
        'user_connections',
        sa.Column('config_json', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Drop the columns added for cloud inference connections."""
    op.drop_column('user_connections', 'config_json')
    op.drop_column('integration_providers', 'connection_type')
