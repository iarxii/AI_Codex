from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean, Integer, Float, Index, Enum as SQLEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from backend.config import settings
import enum

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Contact Info
    email: Mapped[Optional[str]] = mapped_column(String(150), unique=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), unique=True, index=True)
    
    # Profile Info
    title: Mapped[Optional[str]] = mapped_column(String(20)) # Mr, Ms, Mx, Dr, etc.
    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    surname: Mapped[Optional[str]] = mapped_column(String(100))
    dob: Mapped[Optional[datetime]] = mapped_column(DateTime)
    gender: Mapped[Optional[str]] = mapped_column(String(50))
    pronouns: Mapped[Optional[str]] = mapped_column(String(50), default="Prefer not to say")
    country: Mapped[Optional[str]] = mapped_column(String(100))
    profession: Mapped[Optional[str]] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20), default="user") # user, admin, super_admin
    
    # Cloud-Synced Settings
    settings_json: Mapped[Optional[str]] = mapped_column(Text) # JSON string for UI/Model preferences
    
    conversations: Mapped[List["Conversation"]] = relationship(back_populates="user")
    connections: Mapped[List["UserConnection"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    flows: Mapped[List["IntegrationFlow"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    mcp_servers: Mapped[List["UserMCPServer"]] = relationship(back_populates="user", cascade="all, delete-orphan")

class Conversation(Base):
    __tablename__ = "conversations"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True, nullable=True)
    title: Mapped[str] = mapped_column(String(200), default="New Conversation")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    space_type: Mapped[str] = mapped_column(String(50), default="general", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user: Mapped["User"] = relationship(back_populates="conversations")
    messages: Mapped[List["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"))
    role: Mapped[str] = mapped_column(String(20)) # system, user, assistant, tool
    content: Mapped[str] = mapped_column(Text)
    model: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Metadata for tool calls, routing, etc.
    metadata_json: Mapped[Optional[str]] = mapped_column(Text) 
    
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")

class Skill(Base):
    __tablename__ = "skills"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(Text)
    is_enabled: Mapped[bool] = mapped_column(default=True)
    config: Mapped[Optional[str]] = mapped_column(Text) # JSON config
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    source_path: Mapped[str] = mapped_column(String(500))
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[Vector] = mapped_column(Vector(settings.EMBEDDING_DIM)) # Use dimension from settings
    metadata_json: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Index for cosine similarity
    __table_args__ = (
        Index("idx_document_chunks_embedding", embedding, postgresql_using="ivfflat", postgresql_with={"lists": 100}, postgresql_ops={"embedding": "vector_cosine_ops"}),
    )

# CodexSpaces models are isolated in the private codex_spaces submodule.
# Re-exported here to maintain backward compatibility with all existing imports.
from codex_spaces.backend.db.space_models import CodexSpace, CodexSpaceAccess, BridgeSession  # noqa: F401

# ---------------------------------------------------------------------------
# Invoicing Models (Adaptivconcept-FL business invoicing module)
# ---------------------------------------------------------------------------

class InvoiceClient(Base):
    __tablename__ = "invoice_clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    company: Mapped[Optional[str]] = mapped_column(String(150))
    email: Mapped[Optional[str]] = mapped_column(String(150))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    billing_address: Mapped[Optional[str]] = mapped_column(Text)
    vat_number: Mapped[Optional[str]] = mapped_column(String(50))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    invoices: Mapped[List["Invoice"]] = relationship(back_populates="client")


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("invoice_clients.id"), index=True)
    # e.g. INV-2026-0001 — generated server-side
    invoice_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    # draft | sent | viewed | paid | overdue | void
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    currency: Mapped[str] = mapped_column(String(6), default="ZAR")
    issue_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    # All monetary values stored as integer cents to avoid floating-point issues
    subtotal_cents: Mapped[int] = mapped_column(Integer, default=0)
    # Tax rate in basis points: 1500 == 15.00%
    tax_rate_bp: Mapped[int] = mapped_column(Integer, default=0)
    tax_cents: Mapped[int] = mapped_column(Integer, default=0)
    discount_cents: Mapped[int] = mapped_column(Integer, default=0)
    total_cents: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    # Opaque token for unauthenticated client-facing share link
    share_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client: Mapped["InvoiceClient"] = relationship(back_populates="invoices")
    items: Mapped[List["InvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan", order_by="InvoiceItem.sort_order")
    payments: Mapped[List["InvoicePayment"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), index=True)
    description: Mapped[str] = mapped_column(String(300))
    quantity: Mapped[float] = mapped_column(default=1.0)
    unit_price_cents: Mapped[int] = mapped_column(Integer, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    invoice: Mapped["Invoice"] = relationship(back_populates="items")


class InvoicePayment(Base):
    __tablename__ = "invoice_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), index=True)
    amount_cents: Mapped[int] = mapped_column(Integer)
    # manual | eft | card | other
    method: Mapped[str] = mapped_column(String(30), default="manual")
    reference: Mapped[Optional[str]] = mapped_column(String(120))
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    invoice: Mapped["Invoice"] = relationship(back_populates="payments")


# ---------------------------------------------------------------------------

class ArcadeScore(Base):
    __tablename__ = "arcade_scores"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    game_id: Mapped[str] = mapped_column(String(50), index=True)
    score: Mapped[int] = mapped_column(Integer, default=0)
    stars_earned: Mapped[int] = mapped_column(Integer, default=0)
    accuracy: Mapped[Optional[float]] = mapped_column(default=100.0)
    time_spent_sec: Mapped[int] = mapped_column(Integer, default=0)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CachedStream(Base):
    __tablename__ = "cached_streams"

    id: Mapped[int] = mapped_column(primary_key=True)
    platform: Mapped[str] = mapped_column(String(50), index=True)
    stream_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    title: Mapped[str] = mapped_column(Text)
    channel_name: Mapped[str] = mapped_column(String(150))
    thumbnail_url: Mapped[str] = mapped_column(Text)
    stream_url: Mapped[str] = mapped_column(Text)
    viewer_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class IntegrationProvider(Base):
    __tablename__ = "integration_providers"
    
    id: Mapped[str] = mapped_column(String(50), primary_key=True) # e.g., "google", "github", "slack"
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    connection_type: Mapped[str] = mapped_column(String(20), default="oauth") # "oauth" | "api_key" (cloud inference providers without a usable OAuth consent flow)
    oauth_authorize_url_template: Mapped[Optional[str]] = mapped_column(Text) # {state_param} gets replaced
    oauth_token_url: Mapped[str] = mapped_column(String(200))
    scopes_json: Mapped[str] = mapped_column(Text) # JSON array of scopes
    icon_url: Mapped[Optional[str]] = mapped_column(Text)
    config_schema_json: Mapped[Optional[str]] = mapped_column(Text) # JSON schema for connection config
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class UserConnection(Base):
    __tablename__ = "user_connections"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    provider_id: Mapped[str] = mapped_column(String(50), ForeignKey("integration_providers.id"), index=True)
    access_token_enc: Mapped[str] = mapped_column(Text)
    refresh_token_enc: Mapped[Optional[str]] = mapped_column(Text)
    scopes: Mapped[Optional[str]] = mapped_column(Text)
    config_json: Mapped[Optional[str]] = mapped_column(Text) # non-secret provider config, e.g. Azure Foundry endpoint/deployment_name
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user: Mapped["User"] = relationship(back_populates="connections")
    provider_relation: Mapped["IntegrationProvider"] = relationship(foreign_keys=[provider_id])
    space_relations: Mapped[List["SpaceConnection"]] = relationship(back_populates="connection")

class SpaceConnection(Base):
    __tablename__ = "space_connections"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    space_id: Mapped[int] = mapped_column(ForeignKey("codex_spaces.id"), index=True)
    connection_id: Mapped[int] = mapped_column(ForeignKey("user_connections.id"), index=True)
    enabled: Mapped[bool] = mapped_column(default=True)
    config_json: Mapped[Optional[str]] = mapped_column(Text) # provider-specific config (e.g., Drive folder ID)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    space: Mapped["CodexSpace"] = relationship(back_populates="connections")
    connection: Mapped["UserConnection"] = relationship(back_populates="space_relations")
    


class IntegrationFlow(Base):
    __tablename__ = "integration_flows"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    trigger_connection_id: Mapped[int] = mapped_column(ForeignKey("user_connections.id"), index=True)
    enabled: Mapped[bool] = mapped_column(default=True)
    schedule_cron: Mapped[Optional[str]] = mapped_column(String(50)) # e.g., "*/5 * * * *" for every 5 min
    config_json: Mapped[Optional[str]] = mapped_column(Text) # e.g., time windows, dedup keys
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    owner: Mapped["User"] = relationship(back_populates="flows")
    trigger_connection: Mapped["UserConnection"] = relationship(foreign_keys=[trigger_connection_id])
    steps: Mapped[List["IntegrationStep"]] = relationship(back_populates="flow", order_by="IntegrationStep.step_index")
    runs: Mapped[List["IntegrationFlowRun"]] = relationship(back_populates="flow", order_by="IntegrationFlowRun.started_at.desc()")
    


class IntegrationStep(Base):
    __tablename__ = "integration_steps"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    flow_id: Mapped[int] = mapped_column(ForeignKey("integration_flows.id"), index=True)
    step_index: Mapped[int] = mapped_column(Integer)
    action_connection_id: Mapped[int] = mapped_column(ForeignKey("user_connections.id"), index=True)
    action_name: Mapped[str] = mapped_column(String(100)) # e.g., "send_message", "create_document"
    action_config_json: Mapped[Optional[str]] = mapped_column(Text) # JSON config specific to the action
    action_output_json: Mapped[Optional[str]] = mapped_column(Text) # Output of this step
    error_handling: Mapped[str] = mapped_column(String(20), default="stop") # stop, continue, retry
    retry_config_json: Mapped[Optional[str]] = mapped_column(Text) # max_attempts, backoff_seconds
    step_order: Mapped[int] = mapped_column(Integer, default=0)
    
    flow: Mapped["IntegrationFlow"] = relationship(back_populates="steps")
    
    __table_args__ = (
        Index("ix_integration_steps_flow_id_step", "flow_id", "step_index"),
    )

class IntegrationFlowRun(Base):
    __tablename__ = "integration_flow_runs"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    flow_id: Mapped[int] = mapped_column(ForeignKey("integration_flows.id"), index=True)
    trigger_connection_id: Mapped[Optional[int]] = mapped_column(ForeignKey("user_connections.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="pending") # pending, running, success, failed, cancelled
    trigger_payload_json: Mapped[Optional[str]] = mapped_column(Text) # JSON input from trigger
    steps_output_json: Mapped[Optional[str]] = mapped_column(Text) # JSON output from all steps
    error_text: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer)
    
    flow: Mapped["IntegrationFlow"] = relationship(back_populates="runs")

class PortalSyncMetadata(Base):
    __tablename__ = "portal_sync_metadata"

    id: Mapped[int] = mapped_column(primary_key=True)
    platform: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    last_sync_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    sync_status: Mapped[str] = mapped_column(String(50), default="success")


class UserMCPServer(Base):
    """Per-user MCP server configuration, synced from VSCode extension."""
    __tablename__ = "user_mcp_servers"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(50))  # e.g., "git", "filesystem", "github"
    transport_type: Mapped[str] = mapped_column(String(20))  # "stdio" | "http"
    command: Mapped[Optional[str]] = mapped_column(Text)
    args_json: Mapped[Optional[str]] = mapped_column(Text)  # JSON array
    cwd: Mapped[Optional[str]] = mapped_column(Text)
    env_json: Mapped[Optional[str]] = mapped_column(Text)  # JSON object
    url: Mapped[Optional[str]] = mapped_column(Text)
    headers_json: Mapped[Optional[str]] = mapped_column(Text)  # JSON object
    enabled: Mapped[bool] = mapped_column(default=True)
    status: Mapped[str] = mapped_column(String(20), default="disconnected")  # connected, disconnected, error
    last_connected_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user: Mapped["User"] = relationship(back_populates="mcp_servers")
    
    __table_args__ = (
        Index("ix_user_mcp_servers_user_name", "user_id", "name", unique=True),
    )


