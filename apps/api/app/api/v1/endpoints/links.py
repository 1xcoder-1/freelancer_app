"""Shared Links manager (M4) — every public token in one place.

The app issues share tokens from seven modules (pay links, contracts, intake
forms, booking pages, planner boards, portals, report-card). Until now each
was only visible inside its own module; this router aggregates them so the
security promise — "tokenized sharing, revocable links" — has a single
surface. Read-only by design: rotation/revocation stays in the owning module
(the row links there). Every query is workspace-scoped and bounded.
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.booking import BookingConsultation
from app.models.client import Client
from app.models.contract import Contract
from app.models.finance import Invoice
from app.models.intake import IntakeForm
from app.models.planner import PlannerBoard
from app.models.project import Project

router = APIRouter(prefix="/share-links", tags=["Shared Links"])

_FRONTEND_URL = None  # resolved lazily from settings to keep tests env-free


def _frontend_base() -> str:
    global _FRONTEND_URL
    if _FRONTEND_URL is None:
        from app.core.config import settings
        _FRONTEND_URL = (getattr(settings, "WEB_APP_URL", "") or "").rstrip("/")
    return _FRONTEND_URL


def _url(path: str) -> Dict[str, str]:
    base = _frontend_base()
    return {"path": path, "url": f"{base}{path}" if base else path}


@router.get("", response_model=List[Dict[str, Any]])
async def list_share_links(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """One row per live public link across modules, newest first per group."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    links: List[Dict[str, Any]] = []

    client_names = {
        cid: name for cid, name in (await db.execute(
            select(Client.id, Client.name).where(Client.workspace_id == workspace.id)
        )).all()
    }

    # Pay links — invoices
    for inv in (await db.execute(
        select(Invoice).where(
            Invoice.workspace_id == workspace.id, Invoice.status != "draft"
        ).order_by(Invoice.created_at.desc()).limit(200)
    )).scalars().all():
        links.append({
            "module": "invoices",
            "label": inv.invoice_number,
            "subtitle": client_names.get(inv.client_id),
            "status": inv.status,
            "kind": "pay_link",
            "is_active": inv.status in ("sent", "overdue"),
            **_url(f"/pay/{inv.token}"),
        })

    # Contracts — e-sign links
    for c in (await db.execute(
        select(Contract).where(Contract.workspace_id == workspace.id)
        .order_by(Contract.created_at.desc()).limit(200)
    )).scalars().all():
        links.append({
            "module": "contracts",
            "label": c.title,
            "subtitle": c.recipient_name or client_names.get(c.client_id),
            "status": c.status,
            "kind": "esign_link",
            "is_active": c.status not in ("declined", "superseded", "expired"),
            **_url(f"/sign-contract/{c.token}"),
        })

    # Intake forms — public questionnaires
    for f in (await db.execute(
        select(IntakeForm).where(IntakeForm.workspace_id == workspace.id)
        .order_by(IntakeForm.created_at.desc()).limit(200)
    )).scalars().all():
        links.append({
            "module": "intake",
            "label": f.title,
            "subtitle": None,
            "status": f.status,
            "kind": "intake_form",
            "is_active": f.status == "active",
            **_url(f"/intake/{f.token}"),
        })

    # Booking — public consultation pages
    for b in (await db.execute(
        select(BookingConsultation).where(BookingConsultation.workspace_id == workspace.id)
        .order_by(BookingConsultation.created_at.desc()).limit(100)
    )).scalars().all():
        links.append({
            "module": "booking",
            "label": b.title,
            "subtitle": f"{b.duration_minutes} min",
            "status": "active" if b.is_active else "inactive",
            "kind": "booking_page",
            "is_active": b.is_active,
            **_url(f"/booking/{b.token}"),
        })

    # Planner — read-only board shares
    for board in (await db.execute(
        select(PlannerBoard).where(
            PlannerBoard.workspace_id == workspace.id,
            PlannerBoard.share_token.is_not(None),
        ).limit(100)
    )).scalars().all():
        links.append({
            "module": "planner",
            "label": board.name,
            "subtitle": None,
            "status": "shared" if board.is_public else "off",
            "kind": "readonly_board",
            "is_active": board.is_public,
            **_url(f"/planner/share/{board.share_token}"),
        })

    # Projects — client portal links
    for project in (await db.execute(
        select(Project).where(
            Project.workspace_id == workspace.id,
            Project.share_token.is_not(None),
        ).limit(100)
    )).scalars().all():
        links.append({
            "module": "projects",
            "label": project.title,
            "subtitle": client_names.get(project.client_id),
            "status": "shared",
            "kind": "client_portal",
            "is_active": True,
            **_url(f"/portal/{project.share_token}"),
        })

    return links
