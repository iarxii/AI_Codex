"""
Invoicing API — Adaptivconcept-FL
Provides client management, invoice CRUD, status transitions,
payment recording, PDF generation, and a public share-token view.

All owner-scoped routes require JWT auth + business role.
Public routes (/public/*) require only a valid share_token.
"""

import secrets
from datetime import datetime, timedelta
from io import BytesIO
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.auth import get_current_user
from backend.db.models import Invoice, InvoiceClient, InvoiceItem, InvoicePayment, User
from backend.db.session import get_db

router = APIRouter()

# ---------------------------------------------------------------------------
# Role-guard dependency
# ---------------------------------------------------------------------------

BUSINESS_ROLES = {"admin", "super_admin", "business_owner"}

async def require_business_role(current_user: Annotated[User, Depends(get_current_user)]):
    if current_user.role not in BUSINESS_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient privileges. Business role required.",
        )
    return current_user


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

# ---- Clients ----

class ClientIn(BaseModel):
    name: str = Field(..., max_length=150)
    company: Optional[str] = Field(None, max_length=150)
    email: Optional[str] = Field(None, max_length=150)
    phone: Optional[str] = Field(None, max_length=50)
    billing_address: Optional[str] = Field(None, max_length=2000)
    vat_number: Optional[str] = Field(None, max_length=50)


class ClientOut(BaseModel):
    id: int
    owner_id: int
    name: str
    company: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    billing_address: Optional[str]
    vat_number: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Invoice items ----

class InvoiceItemIn(BaseModel):
    description: str = Field(..., max_length=300)
    quantity: float = Field(1.0, gt=0)
    unit_price_cents: int = Field(..., ge=0)
    sort_order: int = Field(0, ge=0)


class InvoiceItemOut(BaseModel):
    id: int
    description: str
    quantity: float
    unit_price_cents: int
    sort_order: int

    class Config:
        from_attributes = True


# ---- Invoices ----

ALLOWED_CURRENCIES = {"ZAR", "USD", "EUR", "GBP", "NAD", "BWP", "MWK", "ZMW"}
EDITABLE_STATUSES = {"draft", "sent"}


class InvoiceIn(BaseModel):
    client_id: int
    currency: str = Field("ZAR", max_length=6)
    issue_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    # Tax rate in basis points (e.g. 1500 == 15.00%)
    tax_rate_bp: int = Field(0, ge=0, le=10000)
    discount_cents: int = Field(0, ge=0)
    notes: Optional[str] = Field(None, max_length=4000)
    items: List[InvoiceItemIn] = Field(default_factory=list)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        v = v.upper()
        if v not in ALLOWED_CURRENCIES:
            raise ValueError(f"Currency must be one of: {', '.join(sorted(ALLOWED_CURRENCIES))}")
        return v


class InvoiceOut(BaseModel):
    id: int
    owner_id: int
    client_id: int
    invoice_number: str
    status: str
    currency: str
    issue_date: datetime
    due_date: Optional[datetime]
    subtotal_cents: int
    tax_rate_bp: int
    tax_cents: int
    discount_cents: int
    total_cents: int
    notes: Optional[str]
    share_token: str
    paid_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    items: List[InvoiceItemOut] = []

    class Config:
        from_attributes = True


# ---- Payments ----

ALLOWED_METHODS = {"manual", "eft", "card", "other"}


class PaymentIn(BaseModel):
    amount_cents: int = Field(..., gt=0)
    method: str = Field("manual", max_length=30)
    reference: Optional[str] = Field(None, max_length=120)

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        if v not in ALLOWED_METHODS:
            raise ValueError(f"Method must be one of: {', '.join(sorted(ALLOWED_METHODS))}")
        return v


class PaymentOut(BaseModel):
    id: int
    invoice_id: int
    amount_cents: int
    method: str
    reference: Optional[str]
    recorded_at: datetime

    class Config:
        from_attributes = True


# ---- Stats ----

class StatsSummary(BaseModel):
    outstanding_cents: int
    overdue_count: int
    paid_this_month_cents: int
    draft_count: int
    sent_count: int
    paid_count: int
    total_invoices: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_totals(items: List[InvoiceItemIn], tax_rate_bp: int, discount_cents: int):
    subtotal = sum(int(i.quantity * i.unit_price_cents) for i in items)
    tax = int(subtotal * tax_rate_bp / 10000)
    total = max(0, subtotal + tax - discount_cents)
    return subtotal, tax, total


async def _generate_invoice_number(db: AsyncSession, owner_id: int) -> str:
    year = datetime.utcnow().year
    result = await db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.owner_id == owner_id,
            func.strftime("%Y", Invoice.created_at) == str(year),
        )
    )
    count = (result.scalar() or 0) + 1
    return f"INV-{year}-{count:04d}"


async def _get_owned_invoice(db: AsyncSession, invoice_id: int, owner_id: int) -> Invoice:
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.owner_id == owner_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    return inv


async def _get_owned_client(db: AsyncSession, client_id: int, owner_id: int) -> InvoiceClient:
    result = await db.execute(
        select(InvoiceClient).where(
            InvoiceClient.id == client_id,
            InvoiceClient.owner_id == owner_id,
            InvoiceClient.is_deleted == False,  # noqa: E712
        )
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found.")
    return client


# ---------------------------------------------------------------------------
# Client endpoints
# ---------------------------------------------------------------------------

@router.get("/clients", response_model=List[ClientOut])
async def list_clients(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    result = await db.execute(
        select(InvoiceClient).where(
            InvoiceClient.owner_id == user.id,
            InvoiceClient.is_deleted == False,  # noqa: E712
        ).order_by(InvoiceClient.name)
    )
    return result.scalars().all()


@router.post("/clients", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
async def create_client(
    body: ClientIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    client = InvoiceClient(owner_id=user.id, **body.model_dump())
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


@router.get("/clients/{client_id}", response_model=ClientOut)
async def get_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    return await _get_owned_client(db, client_id, user.id)


@router.put("/clients/{client_id}", response_model=ClientOut)
async def update_client(
    client_id: int,
    body: ClientIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    client = await _get_owned_client(db, client_id, user.id)
    for field, value in body.model_dump().items():
        setattr(client, field, value)
    await db.commit()
    await db.refresh(client)
    return client


@router.delete("/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    client = await _get_owned_client(db, client_id, user.id)
    # Block hard delete if invoices exist
    inv_count = await db.execute(
        select(func.count(Invoice.id)).where(Invoice.client_id == client.id)
    )
    if (inv_count.scalar() or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Client has associated invoices; it cannot be deleted. Archive instead.",
        )
    client.is_deleted = True
    await db.commit()


# ---------------------------------------------------------------------------
# Invoice endpoints
# ---------------------------------------------------------------------------

@router.get("/invoices", response_model=List[InvoiceOut])
async def list_invoices(
    status_filter: Optional[str] = Query(None, alias="status"),
    client_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    q = select(Invoice).where(Invoice.owner_id == user.id)
    if status_filter:
        q = q.where(Invoice.status == status_filter)
    if client_id:
        q = q.where(Invoice.client_id == client_id)
    q = q.order_by(Invoice.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/invoices", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    body: InvoiceIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    # Verify client belongs to this owner
    await _get_owned_client(db, body.client_id, user.id)

    subtotal, tax, total = _compute_totals(body.items, body.tax_rate_bp, body.discount_cents)
    invoice_number = await _generate_invoice_number(db, user.id)
    share_token = secrets.token_urlsafe(32)

    inv = Invoice(
        owner_id=user.id,
        client_id=body.client_id,
        invoice_number=invoice_number,
        currency=body.currency,
        issue_date=body.issue_date or datetime.utcnow(),
        due_date=body.due_date,
        tax_rate_bp=body.tax_rate_bp,
        discount_cents=body.discount_cents,
        subtotal_cents=subtotal,
        tax_cents=tax,
        total_cents=total,
        notes=body.notes,
        share_token=share_token,
    )
    db.add(inv)
    await db.flush()  # get inv.id

    for idx, item_data in enumerate(body.items):
        item = InvoiceItem(
            invoice_id=inv.id,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_price_cents=item_data.unit_price_cents,
            sort_order=item_data.sort_order if item_data.sort_order else idx,
        )
        db.add(item)

    await db.commit()
    await db.refresh(inv)
    return inv


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    return await _get_owned_invoice(db, invoice_id, user.id)


@router.put("/invoices/{invoice_id}", response_model=InvoiceOut)
async def update_invoice(
    invoice_id: int,
    body: InvoiceIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    inv = await _get_owned_invoice(db, invoice_id, user.id)
    if inv.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invoice in '{inv.status}' status cannot be edited.",
        )
    await _get_owned_client(db, body.client_id, user.id)

    subtotal, tax, total = _compute_totals(body.items, body.tax_rate_bp, body.discount_cents)

    inv.client_id = body.client_id
    inv.currency = body.currency
    inv.issue_date = body.issue_date or inv.issue_date
    inv.due_date = body.due_date
    inv.tax_rate_bp = body.tax_rate_bp
    inv.discount_cents = body.discount_cents
    inv.subtotal_cents = subtotal
    inv.tax_cents = tax
    inv.total_cents = total
    inv.notes = body.notes

    # Replace line items
    result = await db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == inv.id))
    for old_item in result.scalars().all():
        await db.delete(old_item)

    for idx, item_data in enumerate(body.items):
        db.add(InvoiceItem(
            invoice_id=inv.id,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_price_cents=item_data.unit_price_cents,
            sort_order=item_data.sort_order if item_data.sort_order else idx,
        ))

    await db.commit()
    await db.refresh(inv)
    return inv


@router.delete("/invoices/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    inv = await _get_owned_invoice(db, invoice_id, user.id)
    if inv.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft invoices can be deleted.",
        )
    await db.delete(inv)
    await db.commit()


# ---------------------------------------------------------------------------
# Status transition endpoints
# ---------------------------------------------------------------------------

@router.post("/invoices/{invoice_id}/send", response_model=InvoiceOut)
async def send_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    inv = await _get_owned_invoice(db, invoice_id, user.id)
    if inv.status not in ("draft",):
        raise HTTPException(status_code=400, detail="Only draft invoices can be sent.")
    inv.status = "sent"
    await db.commit()
    await db.refresh(inv)
    return inv


@router.post("/invoices/{invoice_id}/void", response_model=InvoiceOut)
async def void_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    inv = await _get_owned_invoice(db, invoice_id, user.id)
    if inv.status == "paid":
        raise HTTPException(status_code=400, detail="A paid invoice cannot be voided.")
    inv.status = "void"
    await db.commit()
    await db.refresh(inv)
    return inv


# ---------------------------------------------------------------------------
# Payment recording
# ---------------------------------------------------------------------------

@router.post("/invoices/{invoice_id}/payments", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
async def record_payment(
    invoice_id: int,
    body: PaymentIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    inv = await _get_owned_invoice(db, invoice_id, user.id)
    if inv.status in ("void",):
        raise HTTPException(status_code=400, detail="Cannot record payment on a voided invoice.")

    payment = InvoicePayment(
        invoice_id=inv.id,
        amount_cents=body.amount_cents,
        method=body.method,
        reference=body.reference,
    )
    db.add(payment)
    await db.flush()

    # Re-sum all payments and auto-flip to paid
    result = await db.execute(
        select(func.sum(InvoicePayment.amount_cents)).where(InvoicePayment.invoice_id == inv.id)
    )
    total_paid = result.scalar() or 0
    if total_paid >= inv.total_cents:
        inv.status = "paid"
        inv.paid_at = datetime.utcnow()

    await db.commit()
    await db.refresh(payment)
    return payment


# ---------------------------------------------------------------------------
# PDF generation (owner, JWT-protected)
# ---------------------------------------------------------------------------

async def _render_pdf(inv: Invoice, db: AsyncSession) -> bytes:
    """Renders the invoice as a PDF via WeasyPrint + Jinja2."""
    try:
        from jinja2 import Environment, PackageLoader, select_autoescape
        from weasyprint import HTML
    except ImportError as e:
        raise HTTPException(
            status_code=503,
            detail=f"PDF generation unavailable: missing dependency ({e}). Install weasyprint and jinja2.",
        )

    # Reload items & client with a fresh query to ensure relationships are loaded
    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == inv.id)
    )
    inv = result.scalar_one()

    items_result = await db.execute(
        select(InvoiceItem).where(InvoiceItem.invoice_id == inv.id).order_by(InvoiceItem.sort_order)
    )
    items = items_result.scalars().all()

    client_result = await db.execute(
        select(InvoiceClient).where(InvoiceClient.id == inv.client_id)
    )
    client = client_result.scalar_one_or_none()

    import os
    from pathlib import Path
    templates_dir = Path(__file__).parent.parent / "templates"

    env = Environment(
        loader=PackageLoader("backend", "templates"),
        autoescape=select_autoescape(["html"]),
    )

    def cents_to_display(cents: int, currency: str = "ZAR") -> str:
        try:
            import locale
            # Use basic formatting — Intl not available in Python
            major = cents // 100
            minor = cents % 100
            return f"{currency} {major:,}.{minor:02d}"
        except Exception:
            return f"{currency} {cents / 100:.2f}"

    env.globals["cents_to_display"] = cents_to_display

    template = env.get_template("invoice.html")
    html_content = template.render(
        invoice=inv,
        items=items,
        client=client,
        generated_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
    )

    pdf_bytes = HTML(string=html_content).write_pdf()
    return pdf_bytes


@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    inv = await _get_owned_invoice(db, invoice_id, user.id)
    pdf_bytes = await _render_pdf(inv, db)
    filename = f"{inv.invoice_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Public share-token endpoints (no auth required)
# ---------------------------------------------------------------------------

async def _get_invoice_by_token(db: AsyncSession, share_token: str) -> Invoice:
    result = await db.execute(
        select(Invoice).where(Invoice.share_token == share_token)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if inv.status == "void":
        raise HTTPException(status_code=410, detail="This invoice has been voided.")
    return inv


@router.get("/public/invoices/{share_token}", response_model=InvoiceOut)
async def public_view_invoice(
    share_token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Unauthenticated read-only invoice view for the client share link.
    Transitions status sent → viewed on first access.
    """
    # Basic rate-limit: rely on Cloud Run + upstream CDN; add IP-level check if needed
    if len(share_token) < 10:
        raise HTTPException(status_code=400, detail="Invalid token.")

    inv = await _get_invoice_by_token(db, share_token)
    if inv.status == "sent":
        inv.status = "viewed"
        await db.commit()
        await db.refresh(inv)
    return inv


@router.get("/public/invoices/{share_token}/pdf")
async def public_download_pdf(
    share_token: str,
    db: AsyncSession = Depends(get_db),
):
    """Unauthenticated PDF download via share token."""
    if len(share_token) < 10:
        raise HTTPException(status_code=400, detail="Invalid token.")
    inv = await _get_invoice_by_token(db, share_token)
    pdf_bytes = await _render_pdf(inv, db)
    filename = f"{inv.invoice_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

@router.get("/stats/summary", response_model=StatsSummary)
async def stats_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_business_role),
):
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    async def _count(extra_where) -> int:
        q = select(func.count(Invoice.id)).where(Invoice.owner_id == user.id, *extra_where)
        r = await db.execute(q)
        return r.scalar() or 0

    async def _sum(extra_where) -> int:
        q = select(func.coalesce(func.sum(Invoice.total_cents), 0)).where(
            Invoice.owner_id == user.id, *extra_where
        )
        r = await db.execute(q)
        return r.scalar() or 0

    outstanding = await _sum([Invoice.status.in_(["sent", "viewed", "overdue"])])
    overdue_count = await _count([Invoice.status == "overdue"])
    draft_count = await _count([Invoice.status == "draft"])
    sent_count = await _count([Invoice.status.in_(["sent", "viewed"])])
    paid_count = await _count([Invoice.status == "paid"])
    total_invoices = await _count([])

    # Paid this month via payments table
    paid_month_result = await db.execute(
        select(func.coalesce(func.sum(InvoicePayment.amount_cents), 0))
        .join(Invoice, Invoice.id == InvoicePayment.invoice_id)
        .where(
            Invoice.owner_id == user.id,
            InvoicePayment.recorded_at >= month_start,
        )
    )
    paid_this_month = paid_month_result.scalar() or 0

    return StatsSummary(
        outstanding_cents=outstanding,
        overdue_count=overdue_count,
        paid_this_month_cents=paid_this_month,
        draft_count=draft_count,
        sent_count=sent_count,
        paid_count=paid_count,
        total_invoices=total_invoices,
    )
