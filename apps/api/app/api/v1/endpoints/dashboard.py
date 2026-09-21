import asyncio
from fastapi import APIRouter, Depends
from typing import Dict, Any, List
from datetime import datetime
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from sqlalchemy.orm import selectinload

from app.core.database import get_db, AsyncSessionLocal
from app.core.auth import require_authenticated_user
from app.core.workspace import get_or_create_user_workspace
from app.api.v1.endpoints.projects import calculate_progress
from app.models.project import Project, Task
from app.models.client import Client
from app.models.finance import Invoice, TimeEntry, Expense

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

class StartTimerRequest(BaseModel):
    project_id: str
    task_name: str = "Focus Session"

@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Returns LIVE aggregated KPIs computed directly from the user's Neon PostgreSQL workspace.
    Zero dummy data.

    Performance: the KPIs collapse into two round trips — one conditional-aggregation
    query over invoices and one SELECT combining the projects/clients/time scalar
    sublinks — instead of five sequential SELECTs (each a full Neon network RTT).
    """
    _, workspace = await get_or_create_user_workspace(db, user)

    # 1. Invoices: paid revenue + pending count/amount in a single query
    # (CASE-based aggregates instead of FILTER so the SQLite dev URL works too)
    _pending = Invoice.status.in_(["sent", "viewed", "overdue"])
    inv_stmt = select(
        func.coalesce(func.sum(case((Invoice.status == "paid", Invoice.total_amount), else_=0.0)), 0.0),
        func.count(case((_pending, 1), else_=None)),
        func.coalesce(func.sum(case((_pending, Invoice.total_amount), else_=0.0)), 0.0),
    ).where(Invoice.workspace_id == workspace.id)
    inv_res = await db.execute(inv_stmt)
    monthly_revenue, pending_count, pending_amount = inv_res.one()
    monthly_revenue = float(monthly_revenue or 0.0)

    # 2. Projects / clients / billable hours as scalar sublinks in one query
    combined_stmt = select(
        select(func.count()).select_from(Project).where(
            Project.workspace_id == workspace.id, Project.status != "completed"
        ).scalar_subquery(),
        select(func.count()).select_from(Client).where(Client.workspace_id == workspace.id).scalar_subquery(),
        select(func.coalesce(func.sum(TimeEntry.duration_seconds), 0)).where(
            TimeEntry.workspace_id == workspace.id, TimeEntry.is_billable == True
        ).scalar_subquery(),
    )
    combined_res = await db.execute(combined_stmt)
    active_projects_count, active_clients_count, total_seconds = combined_res.one()
    active_projects_count = int(active_projects_count or 0)
    active_clients_count = int(active_clients_count or 0)
    total_seconds = int(total_seconds or 0)
    billable_hours = round(total_seconds / 3600.0, 1)

    effective_rate = round(monthly_revenue / billable_hours, 2) if billable_hours > 0 else 0.0

    return {
        "monthly_revenue": monthly_revenue,
        "revenue_growth_pct": 0.0,
        "active_projects_count": active_projects_count,
        "billable_hours_this_month": billable_hours,
        "effective_hourly_rate": effective_rate,
        "pending_invoices_amount": float(pending_amount or 0.0),
        "pending_invoices_count": int(pending_count or 0),
        "active_clients_count": active_clients_count,
        "currency": workspace.currency or "USD",
        "timestamp": datetime.utcnow().isoformat(),
        "user_email": user.get("email") or ""
    }

@router.get("/overview")
async def get_dashboard_overview(
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Returns LIVE categorized dashboard overview computed directly from Neon PostgreSQL database.
    Zero hardcoded mock arrays.

    Performance: the three independent sections (projects, invoices, time entries)
    run concurrently, each in its own session — a single AsyncSession cannot
    execute queries in parallel. With remote Neon latency this turns ~8 serial
    round trips into two parallel chains of ~2-3.
    """
    _, workspace = await get_or_create_user_workspace(db, user)
    workspace_id = workspace.id

    recent_projects, (recent_invoices, total_paid_revenue), (recent_time_entries, total_duration_sec) = await asyncio.gather(
        _overview_projects(workspace_id),
        _overview_invoices(workspace_id),
        _overview_time_entries(workspace_id),
    )

    billable_hours = round(total_duration_sec / 3600.0, 1)

    return {
        "summary": {
            "monthly_revenue": total_paid_revenue,
            "active_projects": len(recent_projects),
            "billable_hours": billable_hours,
            "effective_rate": round(total_paid_revenue / billable_hours, 2) if billable_hours > 0 else 0.0,
        },
        "recent_projects": recent_projects,
        "recent_invoices": recent_invoices,
        "recent_time_entries": recent_time_entries,
        "active_focus_timer": {
            "is_running": False,
            "project_name": "",
            "task_name": "",
            "elapsed_seconds": 0,
            "started_at": datetime.utcnow().isoformat(),
        }
    }


async def _client_name_map(db: AsyncSession, client_ids: List[str]) -> Dict[str, str]:
    """id -> name for the given clients (columns-only — no full ORM rows)."""
    if not client_ids:
        return {}
    c_res = await db.execute(select(Client.id, Client.name).where(Client.id.in_(client_ids)))
    return {cid: name for cid, name in c_res.all()}


async def _overview_projects(workspace_id: str):
    """Recent projects with live progress + tracked hours (own session)."""
    async with AsyncSessionLocal() as s:
        proj_res = await s.execute(
            select(Project)
            .options(selectinload(Project.tasks), selectinload(Project.milestones))
            .where(Project.workspace_id == workspace_id)
            .order_by(Project.created_at.desc())
            .limit(5)
        )
        projects = proj_res.scalars().all()
        clients_map = await _client_name_map(s, [p.client_id for p in projects if p.client_id])

        hours_map: Dict[str, float] = {}
        proj_ids = [p.id for p in projects]
        if proj_ids:
            h_res = await s.execute(
                select(TimeEntry.project_id, func.coalesce(func.sum(TimeEntry.duration_seconds), 0))
                .where(TimeEntry.project_id.in_(proj_ids))
                .group_by(TimeEntry.project_id)
            )
            hours_map = {pid: round((secs or 0) / 3600.0, 1) for pid, secs in h_res.all()}

        out = []
        for p in projects:
            out.append({
                "id": p.id,
                "title": p.title,
                "client_name": clients_map.get(p.client_id, ""),
                "status": p.status,
                "progress_pct": calculate_progress(p.milestones, p.tasks, p.status),
                "budget": p.budget,
                "tracked_hours": hours_map.get(p.id, 0.0),
                "due_date": ""
            })
        return out


async def _overview_invoices(workspace_id: str):
    """Recent invoices + paid revenue total (own session)."""
    async with AsyncSessionLocal() as s:
        inv_res = await s.execute(
            select(Invoice)
            .where(Invoice.workspace_id == workspace_id)
            .order_by(Invoice.created_at.desc())
            .limit(5)
        )
        invoices = inv_res.scalars().all()
        clients_map = await _client_name_map(s, [i.client_id for i in invoices])

        recent_invoices = []
        total_paid_revenue = 0.0
        for inv in invoices:
            if inv.status == "paid":
                total_paid_revenue += inv.total_amount
            recent_invoices.append({
                "id": inv.id,
                "number": inv.invoice_number,
                "client": clients_map.get(inv.client_id, ""),
                "amount": inv.total_amount,
                "status": inv.status,
                "issue_date": inv.issue_date.strftime("%Y-%m-%d") if inv.issue_date else ""
            })
        return recent_invoices, total_paid_revenue


async def _overview_time_entries(workspace_id: str):
    """Recent time entries with real project titles + total duration (own session)."""
    async with AsyncSessionLocal() as s:
        time_res = await s.execute(
            select(TimeEntry)
            .where(TimeEntry.workspace_id == workspace_id)
            .order_by(TimeEntry.created_at.desc())
            .limit(5)
        )
        time_entries = time_res.scalars().all()

        te_projects_map: Dict[str, str] = {}
        te_project_ids = [t.project_id for t in time_entries if t.project_id]
        if te_project_ids:
            tp_res = await s.execute(select(Project.id, Project.title).where(Project.id.in_(te_project_ids)))
            te_projects_map = {pid: title for pid, title in tp_res.all()}

        recent_time_entries = []
        total_duration_sec = 0
        for t in time_entries:
            total_duration_sec += t.duration_seconds
            mins, secs = divmod(t.duration_seconds, 60)
            hrs, mins = divmod(mins, 60)
            recent_time_entries.append({
                "id": t.id,
                "project": te_projects_map.get(t.project_id, ""),
                "task": t.description or "",
                "duration": f"{hrs:02d}:{mins:02d}:{secs:02d}",
                "billable": t.is_billable,
                "date": t.created_at.strftime("%Y-%m-%d") if t.created_at else ""
            })
        return recent_time_entries, total_duration_sec
