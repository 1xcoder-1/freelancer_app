"""Cash Flow Guard — receivables aging, income history, and a 90-day forecast.

Income uncertainty is the #2 freelancer pain point (and late payments #3):
the money a freelancer has *earned* often arrives months after the work.
This endpoint reads only real persisted data (invoices, expenses, leads) and
answers the three questions a freelancer actually asks:

  1. Who owes me money and how late is it?        (aging buckets)
  2. What does the next 90 days realistically look like?  (forecast)
  3. How much can I safely commit/spend now?      (safe-to-spend)

Pure aggregation — no new tables, no writes, workspace-scoped, auth-required.
"""

import statistics
from datetime import datetime, timedelta
from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.finance import Expense, Invoice
from app.models.lead import STAGE_PROBABILITY, Lead

router = APIRouter(prefix="/cashflow", tags=["Cash Flow"])

_OPEN_STATUSES = ("sent", "overdue")
# Invoices paid before the paid_at column existed fall back to updated_at —
# the row's last touch is almost always the mark-paid action itself.
_EFFECTIVE_PAID_AT = func.coalesce(Invoice.paid_at, Invoice.updated_at)


def _month_key(dt: datetime) -> str:
    return dt.strftime("%Y-%m")


def _months_back(now: datetime, count: int) -> list[tuple[str, datetime, datetime]]:
    """(label, start, end) windows for the last `count` calendar months."""
    windows = []
    year, month = now.year, now.month
    for _ in range(count):
        start = datetime(year, month, 1)
        end = datetime(year + (month == 12), (month % 12) + 1, 1)
        windows.append((f"{year:04d}-{month:02d}", start, end))
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return list(reversed(windows))


def _months_ahead(count: int) -> list[tuple[str, datetime, datetime]]:
    windows = []
    now = datetime.utcnow()
    year, month = now.year, now.month
    for _ in range(count):
        month += 1
        if month == 13:
            month, year = 1, year + 1
        start = datetime(year, month, 1)
        end = datetime(year + (month == 12), (month % 12) + 1, 1)
        windows.append((f"{year:04d}-{month:02d}", start, end))
    return windows


@router.get("/summary", response_model=Dict[str, Any])
async def cashflow_summary(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    now = datetime.utcnow()

    # --- one pass over unpaid (sent/overdue) invoices: aging + forecast ------
    open_invoices = (await db.execute(
        select(Invoice).where(
            Invoice.workspace_id == workspace.id,
            Invoice.status.in_(_OPEN_STATUSES),
        )
    )).scalars().all()

    aging = {
        "not_due_yet": {"count": 0, "amount": 0.0},
        "days_1_15": {"count": 0, "amount": 0.0},
        "days_16_30": {"count": 0, "amount": 0.0},
        "days_31_plus": {"count": 0, "amount": 0.0},
    }
    receivables_total = 0.0
    at_risk_total = 0.0  # >30 days late: the money that needs a phone call
    expected_by_month: Dict[str, float] = {}
    overdue_rows: list[Dict[str, Any]] = []

    def _due(inv: Invoice) -> datetime:
        # Missing due date is treated as net-30 from issue — better to show a
        # conservative bucket than silently drop real receivables.
        return inv.due_date or (inv.issue_date + timedelta(days=30))

    for inv in open_invoices:
        due = _due(inv)
        days_past = (now - due).days
        amount = inv.total_amount or 0.0
        receivables_total += amount
        if days_past <= 0:
            aging["not_due_yet"]["count"] += 1
            aging["not_due_yet"]["amount"] += amount
        elif days_past <= 15:
            aging["days_1_15"]["count"] += 1
            aging["days_1_15"]["amount"] += amount
        elif days_past <= 30:
            aging["days_16_30"]["count"] += 1
            aging["days_16_30"]["amount"] += amount
        else:
            aging["days_31_plus"]["count"] += 1
            aging["days_31_plus"]["amount"] += amount
            at_risk_total += amount
        expected_by_month[_month_key(due)] = expected_by_month.get(_month_key(due), 0.0) + amount
        if days_past > 0:
            overdue_rows.append({
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "amount": amount,
                "due_date": due.isoformat(),
                "days_overdue": days_past,
            })

    overdue_rows.sort(key=lambda r: r["days_overdue"], reverse=True)

    # --- collection history: paid invoices in the last 6 months -------------
    collected_rows = (await db.execute(
        select(_EFFECTIVE_PAID_AT, Invoice.total_amount).where(
            Invoice.workspace_id == workspace.id,
            Invoice.status == "paid",
            _EFFECTIVE_PAID_AT >= now - timedelta(days=185),
        )
    )).all()

    # --- expense history: same window ----------------------------------------
    expense_rows = (await db.execute(
        select(Expense.created_at, Expense.amount).where(
            Expense.workspace_id == workspace.id,
            Expense.created_at >= now - timedelta(days=185),
        )
    )).all()

    history = []
    for label, start, end in _months_back(now, 6):
        earned = round(sum(a for paid_at, a in collected_rows if start <= paid_at < end), 2)
        spent = round(sum(a for created, a in expense_rows if start <= created < end), 2)
        history.append({"month": label, "collected": earned, "expenses": spent, "net": round(earned - spent, 2)})

    monthly_collected = [h["collected"] for h in history]
    avg_income_6m = round(sum(monthly_collected) / len(monthly_collected), 2)
    avg_expenses_6m = round(sum(h["expenses"] for h in history) / len(history), 2)
    # Coefficient of variation: 0 = steady salary-like income, >0.5 = lumpy.
    volatility_pct = (
        round((statistics.pstdev(monthly_collected) / avg_income_6m) * 100, 1)
        if avg_income_6m > 0 else 0.0
    )

    # --- average days to get paid (paid invoices only, clamped to >= 0) -----
    paid_pairs = (await db.execute(
        select(Invoice.issue_date, _EFFECTIVE_PAID_AT).where(
            Invoice.workspace_id == workspace.id,
            Invoice.status == "paid",
        )
    )).all()
    deltas = [(paid - issued).days for issued, paid in paid_pairs if paid]
    avg_days_to_payment = round(sum(deltas) / len(deltas), 1) if deltas else None

    # --- 90-day forecast: due receivables + weighted open pipeline ----------
    weighted_pipeline = 0.0
    pipeline_rows = (await db.execute(
        select(Lead.stage, Lead.estimated_value).where(
            Lead.workspace_id == workspace.id,
            Lead.stage.in_(("new", "contacted", "proposal", "negotiation")),
        )
    )).all()
    for stage, value in pipeline_rows:
        weighted_pipeline += (value or 0.0) * STAGE_PROBABILITY.get(stage, 0.0)

    forecast = []
    buckets = _months_ahead(3)
    for i, (label, _start, _end) in enumerate(buckets):
        invoices_due = round(expected_by_month.get(label, 0.0), 2)
        # New-work component: weighted pipeline spread across the horizon,
        # front-loaded (a deal closing typically pays 30 days after the win).
        new_work = round(weighted_pipeline * (0.50, 0.30, 0.20)[i], 2)
        forecast.append({
            "month": label,
            "expected_invoices": invoices_due,
            "expected_new_work": new_work,
            "total_expected": round(invoices_due + new_work, 2),
        })

    expected_30d = forecast[0]["total_expected"] if forecast else 0.0
    # Safe-to-spend: only 80% of the next-30-day inflow (late payments are the
    # norm, not the exception) minus the average monthly burn. Floor at 0.
    safe_to_spend_30d = round(max(0.0, expected_30d * 0.8 - avg_expenses_6m), 2)

    return {
        "currency": workspace.currency or "USD",
        "receivables_total": round(receivables_total, 2),
        "at_risk_total": round(at_risk_total, 2),
        "aging": {k: {"count": v["count"], "amount": round(v["amount"], 2)} for k, v in aging.items()},
        "overdue_invoices": overdue_rows[:20],
        "history_6m": history,
        "avg_monthly_collected": avg_income_6m,
        "avg_monthly_expenses": avg_expenses_6m,
        "income_volatility_pct": volatility_pct,
        "avg_days_to_payment": avg_days_to_payment,
        "forecast_90d": forecast,
        "weighted_pipeline_value": round(weighted_pipeline, 2),
        "safe_to_spend_next_30d": safe_to_spend_30d,
        "timestamp": now.isoformat(),
    }
