from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean, Integer, Float, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from backend.config import settings

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


class PortalSyncMetadata(Base):
    __tablename__ = "portal_sync_metadata"

    id: Mapped[int] = mapped_column(primary_key=True)
    platform: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    last_sync_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    sync_status: Mapped[str] = mapped_column(String(50), default="success")


