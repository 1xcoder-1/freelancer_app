"""Reports & Analytics (M3) — the boss view, one grouped pass per block.

Everything here already has a producer: invoices/payments know revenue,
expenses know run rate, leads know the funnel, and the revenue-at-stake
service owns the at-risk buckets. This endpoint shapes those numbers for one
page; nothing loops per row (grouped queries only) and every query is
workspace-scoped.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.client import Client
from app.models.finance import Expense, Invoice, InvoicePayment
from app.models.lead import Lead
from app.services.revenue_at_stake import compute_revenue_at_stake

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])

# Storage keys, not UI labels — the lead detail page calls 'negotiation'
# "Talking Price", so the funnel reports the real column values.
_LEAD_STAGES = ("new", "contacted", "proposal", "negotiation", "won", "lost")
_OPEN_LEAD_STAGES = _LEAD_STAGES[:4]


@router.get("/summary", response_model=Dict[str, Any])
async def reports_summary(
    months: int = 6,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    months = max(3, min(months, 12))
    now = datetime.utcnow()
    window_start = (now.replace(day=1) - timedelta(days=31 * (months - 1))).replace(day=1)

    is_sqlite = db.get_bind().dialect.name == "sqlite"

    def month_of(column):
        # strftime works on SQLite; to_char on Postgres.
        return (
            func.strftime("%Y-%m", column) if is_sqlite
            else func.to_char(column, "YYYY-MM")
        )

    # --- Revenue by month (cash in, from payment records) --------------------
    paid_month = month_of(InvoicePayment.paid_at)
    payment_rows = (await db.execute(
        select(paid_month, func.coalesce(func.sum(InvoicePayment.amount), 0.0))
        .where(
            InvoicePayment.workspace_id == workspace.id,
            InvoicePayment.paid_at >= window_start,
        )
        .group_by(paid_month)
    )).all()

    # --- Revenue by client, top earners (payments joined through invoices) ---
    client_rows = (await db.execute(
        select(
            Client.name,
            func.coalesce(func.sum(InvoicePayment.amount), 0.0),
        )
        .select_from(InvoicePayment)
        .join(Invoice, InvoicePayment.invoice_id == Invoice.id)
        .join(Client, Invoice.client_id == Client.id)
        .where(
            InvoicePayment.workspace_id == workspace.id,
            InvoicePayment.paid_at >= window_start,
        )
        .group_by(Client.name)
        .order_by(func.sum(InvoicePayment.amount).desc())
        .limit(5)
    )).all()

    # --- Lead funnel + pipeline value ----------------------------------------
    stage_rows = (await db.execute(
        select(Lead.stage, func.count())
        .where(Lead.workspace_id == workspace.id)
        .group_by(Lead.stage)
    )).all()
    stages = {stage: count for stage, count in stage_rows}
    pipeline_value = (await db.execute(
        select(func.coalesce(func.sum(Lead.estimated_value), 0.0)).where(
            Lead.workspace_id == workspace.id,
            Lead.stage.in_(_OPEN_LEAD_STAGES),
        )
    )).scalar_one()

    # --- Expenses: this month split + recurring run rate ---------------------
    expense_rows = (await db.execute(
        select(
            func.coalesce(func.sum(case((Expense.is_recurring.is_(True), Expense.amount), else_=0.0)), 0.0),
            func.coalesce(func.sum(case((Expense.is_recurring.is_(False), Expense.amount), else_=0.0)), 0.0),
        ).where(
            Expense.workspace_id == workspace.id,
            Expense.created_at >= now.replace(day=1),
        )
    )).first()
    recurring_run_rate, one_time_month = (expense_rows[0], expense_rows[1]) if expense_rows else (0.0, 0.0)

    # --- Invoice health ------------------------------------------------------
    inv_rows = (await db.execute(
        select(
            func.count(case((Invoice.status == "paid", 1), else_=None)),
            func.coalesce(func.sum(case((Invoice.status == "paid", Invoice.total_amount), else_=0.0)), 0.0),
            func.count(case((Invoice.status == "overdue", 1), else_=None)),
            func.coalesce(func.sum(case((Invoice.status == "overdue", Invoice.total_amount), else_=0.0)), 0.0),
            func.count(case((Invoice.status == "sent", 1), else_=None)),
            func.coalesce(func.sum(case((Invoice.status == "sent", Invoice.total_amount), else_=0.0)), 0.0),
        ).where(Invoice.workspace_id == workspace.id)
    )).first()

    # --- Revenue at stake (shared service — same numbers as the module pages)
    at_stake = await compute_revenue_at_stake(db, workspace.id)

    won = stages.get("won", 0)
    lost = stages.get("lost", 0)
    closed = won + lost
    return {
        "generated_at": now,
        "months_window": months,
        "revenue_by_month": [
            {"month": month, "total": float(total)} for month, total in payment_rows
        ],
        "revenue_by_client": [
            {"client": name, "total": float(total)} for name, total in client_rows
        ],
        "lead_funnel": {
            "stages": {stage: stages.get(stage, 0) for stage in _LEAD_STAGES},
            "pipeline_value": float(pipeline_value),
            "win_rate": round(won / closed, 4) if closed else None,
        },
        "expenses": {
            "recurring_run_rate": float(recurring_run_rate),
            "one_time_this_month": float(one_time_month),
        },
        "invoices": {
            "paid_count": int(inv_rows[0]) if inv_rows else 0,
            "paid_total": float(inv_rows[1]) if inv_rows else 0.0,
            "overdue_count": int(inv_rows[2]) if inv_rows else 0,
            "overdue_total": float(inv_rows[3]) if inv_rows else 0.0,
            "awaiting_count": int(inv_rows[4]) if inv_rows else 0,
            "awaiting_total": float(inv_rows[5]) if inv_rows else 0.0,
        },
        "revenue_at_stake": at_stake,
    }
