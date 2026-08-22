"""add integration tables

Revision ID: add_integration_tables
Revises: 
Create Date: 2026-08-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_integration_tables'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - create integration tables only."""
    # integration_providers
    op.create_table(
        'integration_providers',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=50), nullable=False),
        sa.Column('oauth_authorize_url_template', sa.Text(), nullable=True),
        sa.Column('oauth_token_url', sa.String(length=200), nullable=False),
        sa.Column('scopes_json', sa.Text(), nullable=False),
        sa.Column('icon_url', sa.Text(), nullable=True),
        sa.Column('config_schema_json', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_integration_providers_slug'), 'integration_providers', ['slug'], unique=True)

    # user_connections
    op.create_table(
        'user_connections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.String(length=50), nullable=False),
        sa.Column('access_token_enc', sa.Text(), nullable=False),
        sa.Column('refresh_token_enc', sa.Text(), nullable=True),
        sa.Column('scopes', sa.Text(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_connections_user_id'), 'user_connections', ['user_id'], unique=False)
    op.create_index(op.f('ix_user_connections_provider_id'), 'user_connections', ['provider_id'], unique=False)

    # space_connections
    op.create_table(
        'space_connections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('space_id', sa.Integer(), nullable=False),
        sa.Column('connection_id', sa.Integer(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('config_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['space_id'], ['codex_spaces.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['connection_id'], ['user_connections.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_space_connections_space_id'), 'space_connections', ['space_id'], unique=False)
    op.create_index(op.f('ix_space_connections_connection_id'), 'space_connections', ['connection_id'], unique=False)

    # integration_flows
    op.create_table(
        'integration_flows',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('trigger_connection_id', sa.Integer(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('schedule_cron', sa.String(length=50), nullable=True),
        sa.Column('config_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['trigger_connection_id'], ['user_connections.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_integration_flows_owner_id'), 'integration_flows', ['owner_id'], unique=False)
    op.create_index(op.f('ix_integration_flows_trigger_connection_id'), 'integration_flows', ['trigger_connection_id'], unique=False)

    # integration_steps
    op.create_table(
        'integration_steps',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('flow_id', sa.Integer(), nullable=False),
        sa.Column('step_index', sa.Integer(), nullable=False),
        sa.Column('action_connection_id', sa.Integer(), nullable=False),
        sa.Column('action_name', sa.String(length=100), nullable=False),
        sa.Column('action_config_json', sa.Text(), nullable=True),
        sa.Column('action_output_json', sa.Text(), nullable=True),
        sa.Column('error_handling', sa.String(length=20), nullable=False, server_default='stop'),
        sa.Column('retry_config_json', sa.Text(), nullable=True),
        sa.Column('step_order', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['flow_id'], ['integration_flows.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['action_connection_id'], ['user_connections.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_integration_steps_flow_id'), 'integration_steps', ['flow_id'], unique=False)
    op.create_index(op.f('ix_integration_steps_action_connection_id'), 'integration_steps', ['action_connection_id'], unique=False)
    op.create_index('ix_integration_steps_flow_id_step', 'integration_steps', ['flow_id', 'step_index'], unique=False)

    # integration_flow_runs
    op.create_table(
        'integration_flow_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('flow_id', sa.Integer(), nullable=False),
        sa.Column('trigger_connection_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='pending'),
        sa.Column('trigger_payload_json', sa.Text(), nullable=True),
        sa.Column('steps_output_json', sa.Text(), nullable=True),
        sa.Column('error_text', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['flow_id'], ['integration_flows.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['trigger_connection_id'], ['user_connections.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_integration_flow_runs_flow_id'), 'integration_flow_runs', ['flow_id'], unique=False)
    op.create_index(op.f('ix_integration_flow_runs_trigger_connection_id'), 'integration_flow_runs', ['trigger_connection_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema - drop integration tables."""
    op.drop_index(op.f('ix_integration_flow_runs_trigger_connection_id'), table_name='integration_flow_runs')
    op.drop_index(op.f('ix_integration_flow_runs_flow_id'), table_name='integration_flow_runs')
    op.drop_table('integration_flow_runs')

    op.drop_index('ix_integration_steps_flow_id_step', table_name='integration_steps')
    op.drop_index(op.f('ix_integration_steps_action_connection_id'), table_name='integration_steps')
    op.drop_index(op.f('ix_integration_steps_flow_id'), table_name='integration_steps')
    op.drop_table('integration_steps')

    op.drop_index(op.f('ix_integration_flows_trigger_connection_id'), table_name='integration_flows')
    op.drop_index(op.f('ix_integration_flows_owner_id'), table_name='integration_flows')
    op.drop_table('integration_flows')

    op.drop_index(op.f('ix_space_connections_connection_id'), table_name='space_connections')
    op.drop_index(op.f('ix_space_connections_space_id'), table_name='space_connections')
    op.drop_table('space_connections')

    op.drop_index(op.f('ix_user_connections_provider_id'), table_name='user_connections')
    op.drop_index(op.f('ix_user_connections_user_id'), table_name='user_connections')
    op.drop_table('user_connections')

    op.drop_index(op.f('ix_integration_providers_slug'), table_name='integration_providers')
    op.drop_table('integration_providers')