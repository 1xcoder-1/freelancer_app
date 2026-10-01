from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.client import Client
from app.models.contract import Contract
from app.models.finance import Invoice, TimeEntry
from app.models.project import Project
from app.schemas.domain import (
    ClientCreate,
    ClientEarningsOut,
    ClientOut,
    ClientRelationshipOut,
    ClientUpdate,
    TopIncomeSourceOut,
)

router = APIRouter(prefix="/clients", tags=["Clients CRM"])

async def _get_workspace_client(db: AsyncSession, workspace_id: str, client_id: str) -> Client:
    res = await db.execute(
        select(Client).where(Client.id == client_id, Client.workspace_id == workspace_id)
    )
    client = res.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


async def _client_invoice_rollups(db: AsyncSession, workspace_id: str, client_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """One bounded scan of the workspace's non-draft invoices, aggregated per
    client in Python (freelancer invoice counts are small; no per-row queries)."""
    if not client_ids:
        return {}
    rows = (await db.execute(
        select(
            Invoice.client_id, Invoice.status, Invoice.total_amount,
            Invoice.issue_date, Invoice.paid_at,
        ).where(Invoice.workspace_id == workspace_id, Invoice.client_id.in_(client_ids))
    )).all()

    roll: Dict[str, Dict[str, Any]] = {
        cid: {"billed": 0.0, "paid": 0.0, "outstanding": 0.0, "overdue": 0.0,
              "count": 0, "pay_days": []}
        for cid in client_ids
    }
    for client_id, inv_status, total, issue_date, paid_at in rows:
        if client_id not in roll:
            continue
        r = roll[client_id]
        total = float(total or 0.0)
        if inv_status == "draft":
            continue
        r["billed"] += total
        r["count"] += 1
        if inv_status == "paid":
            r["paid"] += total
            if paid_at and issue_date:
                r["pay_days"].append(max(0, (paid_at - issue_date).days))
        elif inv_status in ("sent", "overdue"):
            r["outstanding"] += total
            if inv_status == "overdue":
                r["overdue"] += total
    return roll


async def _client_hours_map(db: AsyncSession, workspace_id: str, client_ids: List[str]) -> Dict[str, float]:
    if not client_ids:
        return {}
    rows = (await db.execute(
        select(Project.client_id, func.coalesce(func.sum(TimeEntry.duration_seconds), 0))
        .join(TimeEntry, TimeEntry.project_id == Project.id)
        .where(Project.workspace_id == workspace_id, Project.client_id.in_(client_ids))
        .group_by(Project.client_id)
    )).all()
    return {cid: round((secs or 0) / 3600.0, 1) for cid, secs in rows}


@router.get("", response_model=List[ClientOut])
async def list_clients(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Workspace clients with revenue all computed in grouped passes."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    clients = (await db.execute(
        select(Client).where(Client.workspace_id == workspace.id).order_by(Client.created_at.desc())
    )).scalars().all()
    ids = [c.id for c in clients]

    roll = await _client_invoice_rollups(db, workspace.id, ids)

    out: List[Dict[str, Any]] = []
    for c in clients:
        r = roll.get(c.id, {"billed": 0.0, "paid": 0.0, "outstanding": 0.0, "overdue": 0.0, "count": 0, "pay_days": []})
        out.append({
            "id": c.id, "workspace_id": c.workspace_id, "name": c.name,
            "company_name": c.company_name, "email": c.email, "phone": c.phone,
            "website": c.website, "status": c.status, "notes": c.notes,
            "total_billed": round(r["billed"], 2),
            "total_paid": round(r["paid"], 2),
            "days_since_touch": None,
            "created_at": c.created_at,
        })
    return out


@router.get("/earnings/top", response_model=List[TopIncomeSourceOut])
async def top_income_sources(
    limit: int = 8,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """C1 'top income sources' — clients ranked by money actually collected."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    limit = max(1, min(limit, 50))
    paid_total = func.coalesce(func.sum(Invoice.total_amount), 0.0)
    rows = (await db.execute(
        select(Client.id, Client.name, paid_total, func.count(Invoice.id))
        .join(Invoice, Invoice.client_id == Client.id)
        .where(Client.workspace_id == workspace.id, Invoice.status == "paid")
        .group_by(Client.id, Client.name)
        .order_by(paid_total.desc())
        .limit(limit)
    )).all()
    return [
        {"client_id": cid, "name": name, "total_paid": round(float(paid or 0.0), 2), "invoice_count": int(cnt or 0)}
        for cid, name, paid, cnt in rows
    ]


@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    client = Client(
        workspace_id=workspace.id,
        name=payload.name,
        company_name=payload.company_name,
        email=payload.email,
        phone=payload.phone,
        website=payload.website,
        notes=payload.notes,
        status=payload.status,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientOut)
async def get_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    return await _get_workspace_client(db, workspace.id, client_id)


@router.patch("/{client_id}", response_model=ClientOut)
@router.put("/{client_id}", response_model=ClientOut)
async def update_client(
    client_id: str,
    payload: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    client = await _get_workspace_client(db, workspace.id, client_id)
    for field, val in payload.model_dump(exclude_unset=True).items():
        if hasattr(client, field):
            setattr(client, field, val)
    await db.commit()
    await db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    client = await _get_workspace_client(db, workspace.id, client_id)
    await db.delete(client)
    await db.commit()


# ------------------------------------------------------------------------------
# C1 — per-client earnings
# ------------------------------------------------------------------------------
@router.get("/{client_id}/earnings", response_model=ClientEarningsOut)
async def client_earnings(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    client = await _get_workspace_client(db, workspace.id, client_id)

    roll = await _client_invoice_rollups(db, workspace.id, [client_id])
    r = roll.get(client_id, {"billed": 0.0, "paid": 0.0, "outstanding": 0.0, "overdue": 0.0, "count": 0, "pay_days": []})
    hours_map = await _client_hours_map(db, workspace.id, [client_id])
    avg_pay = (sum(r["pay_days"]) / len(r["pay_days"])) if r["pay_days"] else None
    # "deals" = invoices that left draft; avg deal size keeps it simple & honest.
    avg_deal = round(r["billed"] / r["count"], 2) if r["count"] else 0.0
    return {
        "client_id": client.id,
        "name": client.name,
        "currency": workspace.currency or "USD",
        "lifetime_revenue": round(r["paid"], 2),
        "total_invoiced": round(r["billed"], 2),
        "total_paid": round(r["paid"], 2),
        "outstanding": round(r["outstanding"], 2),
        "avg_deal_size": avg_deal,
        "days_to_payment": round(avg_pay, 1) if avg_pay is not None else None,
        "lifetime_hours": hours_map.get(client_id, 0.0),
        "invoice_count": r["count"],
    }


# ------------------------------------------------------------------------------
# C6 — relationship strip (cross-page numbers, reuses the F4 idea locally)
# ------------------------------------------------------------------------------
@router.get("/{client_id}/relationship", response_model=ClientRelationshipOut)
async def client_relationship(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Clean, high-level client relationship metrics: Projects, Revenue, Contracts, Invoices."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    client = await _get_workspace_client(db, workspace.id, client_id)

    # 1. Projects Breakdown
    all_projects = (await db.execute(
        select(Project.id, Project.status).where(
            Project.workspace_id == workspace.id,
            Project.client_id == client.id,
        )
    )).all()
    total_projects = len(all_projects)
    completed_projects = sum(1 for p in all_projects if p.status in ("completed", "archived", "delivered"))
    open_projects = sum(1 for p in all_projects if p.status in ("planning", "in_progress", "paused"))

    # 2. Invoices & Revenue Breakdown
    all_invoices = (await db.execute(
        select(Invoice.id, Invoice.status, Invoice.total_amount).where(
            Invoice.workspace_id == workspace.id,
            Invoice.client_id == client.id,
        )
    )).all()
    total_invoices = len(all_invoices)
    paid_invoices = sum(1 for inv in all_invoices if inv.status == "paid")
    pending_invoices = sum(1 for inv in all_invoices if inv.status in ("sent", "viewed", "overdue", "partially_paid", "draft"))
    overdue_count = sum(1 for inv in all_invoices if inv.status == "overdue")

    total_revenue = round(sum(float(inv.total_amount or 0.0) for inv in all_invoices), 2)
    paid_amount = round(sum(float(inv.total_amount or 0.0) for inv in all_invoices if inv.status == "paid"), 2)
    pending_amount = round(sum(float(inv.total_amount or 0.0) for inv in all_invoices if inv.status != "paid"), 2)
    overdue_value = round(sum(float(inv.total_amount or 0.0) for inv in all_invoices if inv.status == "overdue"), 2)

    # 3. Contracts Breakdown
    all_contracts = (await db.execute(
        select(Contract.id, Contract.status, Project.budget)
        .outerjoin(Project, Contract.project_id == Project.id)
        .where(
            Contract.workspace_id == workspace.id,
            (Contract.client_id == client.id) | (Project.client_id == client.id),
        )
    )).all()
    total_contracts = len(all_contracts)
    signed_contracts = sum(1 for c in all_contracts if c.status == "signed")
    pending_contracts = sum(1 for c in all_contracts if c.status in ("draft", "sent", "viewed"))
    unsigned_contract_value = round(sum(float(c.budget or 0.0) for c in all_contracts if c.status != "signed"), 2)

    # 4. Optional / legacy time tracking metrics
    unbilled = (await db.execute(
        select(
            func.coalesce(func.sum(TimeEntry.duration_seconds), 0),
            func.coalesce(func.sum(TimeEntry.duration_seconds / 3600.0 * TimeEntry.hourly_rate), 0.0),
        )
        .join(Project, TimeEntry.project_id == Project.id)
        .where(
            TimeEntry.workspace_id == workspace.id,
            Project.client_id == client.id,
            TimeEntry.is_billable.is_(True),
            TimeEntry.is_invoiced.is_(False),
        )
    )).one()
    unbilled_hours = round((unbilled[0] or 0) / 3600.0, 2)
    unbilled_value = round(float(unbilled[1] or 0.0), 2)

    return {
        "client_id": client.id,
        "currency": workspace.currency or "USD",
        # Projects
        "total_projects": total_projects,
        "open_projects": open_projects,
        "completed_projects": completed_projects,
        # Financials
        "total_revenue": total_revenue,
        "paid_amount": paid_amount,
        "pending_amount": pending_amount,
        # Contracts
        "total_contracts": total_contracts,
        "signed_contracts": signed_contracts,
        "pending_contracts": pending_contracts,
        "unsigned_contracts": pending_contracts,
        "unsigned_contract_value": unsigned_contract_value,
        # Invoices
        "total_invoices": total_invoices,
        "paid_invoices": paid_invoices,
        "pending_invoices": pending_invoices,
        "overdue_invoices": overdue_count,
        "overdue_value": overdue_value,
        # Compatibility
        "unbilled_hours": unbilled_hours,
        "unbilled_value": unbilled_value,
        "days_since_touch": None,
    }
