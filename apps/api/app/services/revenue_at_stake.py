"""Revenue-at-stake aggregate (F4).

One service, one grouped pass per bucket, shared by two endpoints so the money
number is identical everywhere it is shown:

* ``unsigned_contracts`` — deals whose paperwork is not signed yet. The value at
  risk is the parent project's budget: work that could start but legally shouldn't.
* ``unbilled_time`` — billable time logged but never invoiced. Value is the same
  hours x rate the "bill exactly what you worked" flow already uses.
* ``unpaid_invoices`` — money already invoiced but not collected. Balance is the
  invoice total minus any recorded (partial) payments.

Every query is scoped to a single workspace and grouped server-side; nothing here
loops per row (the plan's explicit load guard). Callers shape the result for
their page (``GET /contracts/at-stake`` vs ``GET /projects/at-risk``).
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.contract import Contract
from app.models.finance import Invoice, InvoicePayment, TimeEntry
from app.models.project import Project

# Contract statuses that mean "still waiting to be executed" — a signed or
# declined contract no longer holds money hostage, an expired one is dead.
_OPEN_CONTRACT_STATUSES = ("draft", "sent", "viewed")
# Invoice statuses that represent outstanding receivables.
_UNPAID_INVOICE_STATUSES = ("sent", "overdue")


async def compute_revenue_at_stake(
    db: AsyncSession,
    workspace_id: str,
    currency: Optional[str] = None,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Return the three at-stake buckets plus a per-project rollup.

    ``now`` is injectable purely so date maths (days overdue / days since sent)
    is deterministic in tests; it defaults to the real clock.
    """
    now = now or datetime.utcnow()

    # --- Client name lookup (workspace-scoped, one pass) ----------------------
    client_rows = (await db.execute(
        select(Client.id, Client.name).where(Client.workspace_id == workspace_id)
    )).all()
    client_names = {cid: name for cid, name in client_rows}

    # --- 1. Unsigned contracts -> project budget ------------------------------
    contract_rows = (await db.execute(
        select(Contract, Project.title, Project.budget, Project.client_id)
        .join(Project, Contract.project_id == Project.id)
        .where(
            Contract.workspace_id == workspace_id,
            Contract.status.in_(_OPEN_CONTRACT_STATUSES),
        )
    )).all()

    unsigned_contracts: List[Dict[str, Any]] = []
    unsigned_value = 0.0
    for contract, project_title, budget, client_id in contract_rows:
        budget = float(budget or 0.0)
        unsigned_value += budget
        sent_days_ago = (now - contract.created_at).days if contract.created_at else None
        unsigned_contracts.append({
            "contract_id": contract.id,
            "title": contract.title,
            "status": contract.status,
            "project_id": contract.project_id,
            "project_title": project_title,
            "client_id": client_id,
            "client_name": client_names.get(client_id),
            "budget": round(budget, 2),
            "sent_days_ago": sent_days_ago,
        })

    # --- 2. Unbilled time -> hours x rate (grouped by project) ----------------
    unbilled_rows = (await db.execute(
        select(
            TimeEntry.project_id,
            Project.title,
            Project.client_id,
            func.coalesce(func.sum(TimeEntry.duration_seconds), 0),
            func.count(TimeEntry.id),
        )
        .join(Project, TimeEntry.project_id == Project.id)
        .where(
            TimeEntry.workspace_id == workspace_id,
            TimeEntry.is_billable.is_(True),
            TimeEntry.is_invoiced.is_(False),
        )
        .group_by(TimeEntry.project_id, Project.title, Project.client_id)
    )).all()

    unbilled_time: List[Dict[str, Any]] = []
    unbilled_value = 0.0
    unbilled_hours_total = 0.0
    for project_id, project_title, client_id, seconds, entry_count in unbilled_rows:
        hours = round((seconds or 0) / 3600.0, 2)
        # Value each project's unbilled hours at its own rate (entries default to
        # the project rate; the column-level hourly_rate is authoritative per row,
        # so sum the money server-side rather than re-deriving from one rate).
        value = await db.scalar(
            select(func.coalesce(func.sum(TimeEntry.duration_seconds / 3600.0 * TimeEntry.hourly_rate), 0.0))
            .where(
                TimeEntry.workspace_id == workspace_id,
                TimeEntry.project_id == project_id,
                TimeEntry.is_billable.is_(True),
                TimeEntry.is_invoiced.is_(False),
            )
        )
        value = float(value or 0.0)
        unbilled_value += value
        unbilled_hours_total += hours
        unbilled_time.append({
            "project_id": project_id,
            "project_title": project_title,
            "client_id": client_id,
            "client_name": client_names.get(client_id),
            "hours": hours,
            "entries": int(entry_count or 0),
            "value": round(value, 2),
        })

    # --- 3. Unpaid invoices -> balance (total - recorded payments) ------------
    invoice_rows = (await db.execute(
        select(
            Invoice.id, Invoice.invoice_number, Invoice.project_id, Invoice.client_id,
            Invoice.total_amount, Invoice.due_date,
            func.coalesce(func.sum(InvoicePayment.amount), 0.0),
        )
        .outerjoin(InvoicePayment, InvoicePayment.invoice_id == Invoice.id)
        .where(
            Invoice.workspace_id == workspace_id,
            Invoice.status.in_(_UNPAID_INVOICE_STATUSES),
        )
        .group_by(Invoice.id, Invoice.invoice_number, Invoice.project_id,
                  Invoice.client_id, Invoice.total_amount, Invoice.due_date)
    )).all()

    unpaid_invoices: List[Dict[str, Any]] = []
    unpaid_value = 0.0
    for inv_id, number, project_id, client_id, total, due_date, paid in invoice_rows:
        balance = round(float(total or 0.0) - float(paid or 0.0), 2)
        if balance <= 0:
            continue  # fully settled by partial payments — not "at stake"
        unpaid_value += balance
        days_overdue = (now - due_date).days if due_date and due_date < now else 0
        unpaid_invoices.append({
            "invoice_id": inv_id,
            "invoice_number": number,
            "project_id": project_id,
            "client_id": client_id,
            "client_name": client_names.get(client_id),
            "amount_due": balance,
            "days_overdue": max(0, days_overdue),
        })

    # --- Per-project rollup (powers /projects/at-risk) ------------------------
    projects: Dict[str, Dict[str, Any]] = {}

    def _bucket(project_id, project_title, client_id):
        return projects.setdefault(project_id, {
            "project_id": project_id,
            "project_title": project_title,
            "client_id": client_id,
            "client_name": client_names.get(client_id),
            "unsigned_contract_value": 0.0,
            "unbilled_value": 0.0,
            "unbilled_hours": 0.0,
            "unpaid_value": 0.0,
            "total_at_risk": 0.0,
        })

    for c in unsigned_contracts:
        if c["project_id"]:
            b = _bucket(c["project_id"], c["project_title"], c["client_id"])
            b["unsigned_contract_value"] = round(b["unsigned_contract_value"] + c["budget"], 2)
    for u in unbilled_time:
        b = _bucket(u["project_id"], u["project_title"], u["client_id"])
        b["unbilled_value"] = round(b["unbilled_value"] + u["value"], 2)
        b["unbilled_hours"] = round(b["unbilled_hours"] + u["hours"], 2)
    for i in unpaid_invoices:
        if i["project_id"]:
            b = _bucket(i["project_id"], None, i["client_id"])
            b["unpaid_value"] = round(b["unpaid_value"] + i["amount_due"], 2)

    # Attach due dates + roll each project's total.
    project_ids = list(projects.keys())
    due_map: Dict[str, Any] = {}
    if project_ids:
        due_rows = (await db.execute(
            select(Project.id, Project.title, Project.due_date, Project.status)
            .where(Project.id.in_(project_ids))
        )).all()
        due_map = {pid: (title, due, status) for pid, title, due, status in due_rows}
    for pid, b in projects.items():
        b["total_at_risk"] = round(
            b["unsigned_contract_value"] + b["unbilled_value"] + b["unpaid_value"], 2
        )
        title, due, status = due_map.get(pid, (b.get("project_title"), None, None))
        if not b.get("project_title"):
            b["project_title"] = title
        b["due_date"] = due.isoformat() if due else None
        b["project_status"] = status
        b["overdue"] = bool(due and due < now.date())

    at_risk_projects = sorted(projects.values(), key=lambda x: x["total_at_risk"], reverse=True)

    total_at_stake = round(unsigned_value + unbilled_value + unpaid_value, 2)
    return {
        "currency": currency or "USD",
        "totals": {
            "total_at_stake": total_at_stake,
            "unsigned_contracts_value": round(unsigned_value, 2),
            "unsigned_contracts_count": len(unsigned_contracts),
            "unbilled_value": round(unbilled_value, 2),
            "unbilled_hours": round(unbilled_hours_total, 2),
            "unpaid_invoices_value": round(unpaid_value, 2),
            "unpaid_invoices_count": len(unpaid_invoices),
        },
        "unsigned_contracts": unsigned_contracts,
        "unbilled_time": unbilled_time,
        "unpaid_invoices": unpaid_invoices,
        "at_risk_projects": at_risk_projects,
        "generated_at": now.isoformat(),
    }
