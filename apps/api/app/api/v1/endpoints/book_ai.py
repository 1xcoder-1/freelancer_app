"""Book AI Q&A — deterministic intent engine over the workspace's real data.

No LLM keys exist in this deployment, so "AI" here is a keyword intent
classifier plus honest SQL aggregation: every number in an answer comes from
the freelancer's own invoices / projects / time entries, and every citation
carries a real record id so the frontend can deep-link to it.

Intents:
  client_billing      "how much did I bill <client> (this quarter/year...)"
  effective_rate      "highest/best effective hourly rate (client|project)"
  unbilled_time       "what is unbilled on <project>"
  recent_activity     fallback — the newest invoices and projects with amounts
"""

from datetime import datetime
import re
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.quota import bump_meter, enforce_meter, plan_context
from app.core.workspace import get_or_create_user_workspace
from app.models.client import Client
from app.models.finance import Invoice, TimeEntry
from app.models.project import Project

router = APIRouter(prefix="/book-ai", tags=["Book AI Q&A"])

_CAPABILITIES = [
    "Client billing totals by period",
    "Highest effective hourly rate (by client or project)",
    "Unbilled time value on a project",
    "Recent invoices and projects summary",
]


class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)


class Citation(BaseModel):
    label: str
    type: str  # "client" | "project" | "invoice"
    id: str


class AskResponse(BaseModel):
    answer: str
    intent: str
    citations: List[Citation]


def _money(x: float) -> str:
    return f"${x:,.2f}"


def _month_start(year: int, month: int) -> datetime:
    return datetime(year, month, 1)


def _add_months(dt: datetime, delta: int) -> datetime:
    total = dt.month - 1 + delta
    return _month_start(dt.year + total // 12, total % 12 + 1)


def _period_bounds(q: str, now: datetime) -> Tuple[Optional[datetime], Optional[datetime], str]:
    """Parse a time window out of the question. Returns (start, end, label);
    (None, None, ...) means all time."""
    if "last quarter" in q:
        qi = (now.month - 1) // 3
        start = _add_months(_month_start(now.year, qi * 3 + 1), -3)
        return start, _add_months(start, 3), "last quarter"
    if "quarter" in q:  # "this quarter", "in Q3"... default to current
        qi = (now.month - 1) // 3
        start = _month_start(now.year, qi * 3 + 1)
        return start, _add_months(start, 3), "this quarter"
    if "last year" in q:
        return datetime(now.year - 1, 1, 1), datetime(now.year, 1, 1), "last year"
    if "this year" in q or "year to date" in q or "ytd" in q:
        return datetime(now.year, 1, 1), datetime(now.year + 1, 1, 1), "this year"
    if "last month" in q:
        start = _add_months(_month_start(now.year, now.month), -1)
        return start, _add_months(start, 1), "last month"
    if "this month" in q or "month" in q:
        start = _month_start(now.year, now.month)
        return start, _add_months(start, 1), "this month"
    return None, None, "all time"


def _match_entities(q: str, rows: List[Any], name_of) -> Optional[Tuple[Any, List[str]]]:
    """Case-insensitive matching of a record name inside the question.
    A full-name mention wins; otherwise any distinctive word of the name
    ("acme" for "Acme Corp") matches as a whole word, so partial mentions
    still surface every ambiguous record. Returns (row, other_matched_names)
    so the answer can disclose ambiguity."""
    q_words = set(re.findall(r"[a-z0-9]+", q))
    matches: List[Any] = []
    for row in rows:
        name = (name_of(row) or "").lower()
        if not name:
            continue
        name_words = {w for w in re.findall(r"[a-z0-9]+", name) if len(w) >= 3}
        if name in q or (name_words & q_words):
            matches.append(row)
    if not matches:
        return None
    exact = [m for m in matches if name_of(m).lower() == q.strip().lower() or f" {name_of(m).lower()}" in f" {q} "]
    chosen = (exact or matches)[0]
    others = [name_of(m) for m in matches if m is not chosen]
    return chosen, others


def _ambiguity_note(others: List[str], chosen_name: str) -> str:
    if not others:
        return ""
    return f" (I matched '{chosen_name}'; your question also matched: {', '.join(others)}.)"


async def _billed_sum_by(
    db: AsyncSession, workspace_id: str, column, start: Optional[datetime], end: Optional[datetime]
):
    """Total of every invoice that left draft, grouped by `column`
    (Invoice.client_id or Invoice.project_id). Drafts are not billing yet."""
    stmt = (
        select(column, func.coalesce(func.sum(Invoice.total_amount), 0.0))
        .where(Invoice.workspace_id == workspace_id, Invoice.status != "draft", column.is_not(None))
        .group_by(column)
    )
    if start:
        stmt = stmt.where(Invoice.issue_date >= start)
    if end:
        stmt = stmt.where(Invoice.issue_date < end)
    return {cid: float(total or 0.0) for cid, total in (await db.execute(stmt)).all()}


async def _billable_hours_by_project(db: AsyncSession, workspace_id: str) -> Dict[str, float]:
    stmt = (
        select(TimeEntry.project_id, func.coalesce(func.sum(TimeEntry.duration_seconds), 0))
        .where(TimeEntry.workspace_id == workspace_id, TimeEntry.is_billable == True)  # noqa: E712
        .group_by(TimeEntry.project_id)
    )
    return {pid: (seconds or 0) / 3600.0 for pid, seconds in (await db.execute(stmt)).all()}


# ------------------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------------------
@router.get("/status")
async def status_endpoint():
    """UI capability probe. available=True: the engine is deterministic and
    needs no external key."""
    return {"available": True, "capabilities": list(_CAPABILITIES)}


@router.post("/ask", response_model=AskResponse)
async def ask(
    payload: AskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    q = payload.question.strip().lower()
    _, workspace = await get_or_create_user_workspace(db, current_user)

    # Ask counted before the answer is computed: this route has many return
    # paths and a meter that only burns on some of them is a meter that can be
    # farmed. Commit immediately — the counter is independent of the answer.
    ctx = await plan_context(db, current_user)
    await enforce_meter(db, ctx, "ai_asks")
    await bump_meter(db, ctx, "ai_asks")
    await db.commit()

    clients = list((await db.execute(
        select(Client).where(Client.workspace_id == workspace.id).order_by(Client.created_at.desc())
    )).scalars().all())
    projects = list((await db.execute(
        select(Project).where(Project.workspace_id == workspace.id).order_by(Project.created_at.desc())
    )).scalars().all())

    client_hit = _match_entities(q, clients, lambda c: c.name)
    project_hit = _match_entities(q, projects, lambda p: p.title)

    # --- intent: unbilled time on a project -----------------------------------
    if "unbilled" in q or "uninvoiced" in q or "not yet billed" in q or "not billed" in q:
        if project_hit:
            project, others = project_hit
            hours_rows = (await db.execute(
                select(
                    func.coalesce(func.sum(TimeEntry.duration_seconds), 0),
                    func.coalesce(func.sum(TimeEntry.duration_seconds / 3600.0 * TimeEntry.hourly_rate), 0.0),
                    func.count(TimeEntry.id),
                )
                .where(
                    TimeEntry.workspace_id == workspace.id,
                    TimeEntry.project_id == project.id,
                    TimeEntry.is_billable == True,   # noqa: E712
                    TimeEntry.is_invoiced == False,  # noqa: E712
                )
            )).one()
            hours = round((hours_rows[0] or 0) / 3600.0, 2)
            value = round(float(hours_rows[1] or 0.0), 2)
            entry_count = hours_rows[2] or 0
            invoiced_total = round(float((await db.execute(
                select(func.coalesce(func.sum(Invoice.total_amount), 0.0)).where(
                    Invoice.workspace_id == workspace.id,
                    Invoice.project_id == project.id,
                    Invoice.status != "draft",
                )
            )).scalar() or 0.0), 2)

            answer = (
                f"'{project.title}' has {hours:,.2f} billable hours ({entry_count} entr"
                f"{'y' if entry_count == 1 else 'ies'}) still unbilled, worth about {_money(value)} "
                f"at your logged rates. So far {_money(invoiced_total)} has been invoiced for this project."
            )
            answer += _ambiguity_note(others, project.title)
            citations = [Citation(label=project.title, type="project", id=project.id)]
            if project.client_id:
                client = next((c for c in clients if c.id == project.client_id), None)
                if client:
                    citations.append(Citation(label=client.name, type="client", id=client.id))
            return AskResponse(answer=answer, intent="unbilled_time", citations=citations)

        names = ", ".join(f"'{p.title}'" for p in projects[:5])
        answer = (
            "Which project do you mean? I can tell you the unbilled hours and value for "
            + (names if names else "any project — but none exist in your books yet")
            + "."
        )
        return AskResponse(
            answer=answer,
            intent="unbilled_time",
            citations=[Citation(label=p.title, type="project", id=p.id) for p in projects[:5]],
        )

    # --- intent: effective hourly rate -----------------------------------------
    wants_rate = ("effective" in q and "rate" in q) or "hourly rate" in q or (
        any(w in q for w in ("highest", "best", "top", "worst", "lowest")) and "rate" in q
    )
    if wants_rate:
        by_project_dim = "project" in q or (project_hit and not client_hit)
        hours_by_project = await _billable_hours_by_project(db, workspace.id)

        if by_project_dim:
            revenue_by_project = await _billed_sum_by(db, workspace.id, Invoice.project_id, None, None)
            scored = []
            for p in projects:
                hours = hours_by_project.get(p.id, 0.0)
                revenue = revenue_by_project.get(p.id, 0.0)
                if hours > 0 and revenue > 0:
                    scored.append((revenue / hours, hours, revenue, p))
            if not scored:
                return AskResponse(
                    answer="I could not compute a project effective rate yet — no project has both billed invoices and billable tracked hours.",
                    intent="effective_rate",
                    citations=[],
                )
            scored.sort(key=lambda t: t[0], reverse=True)
            rate, hours, revenue, top = scored[0]
            answer = (
                f"Your highest effective hourly rate is {_money(rate)}/hr on '{top.title}': "
                f"{hours:,.1f} billable hours tracked vs {_money(revenue)} billed."
            )
            citations = [Citation(label=top.title, type="project", id=top.id)]
            return AskResponse(answer=answer, intent="effective_rate", citations=citations)

        # client dimension (default): revenue per client / hours across their projects
        revenue_by_client = await _billed_sum_by(db, workspace.id, Invoice.client_id, None, None)
        hours_by_client: Dict[str, float] = {}
        for p in projects:
            if p.client_id:
                hours_by_client[p.client_id] = hours_by_client.get(p.client_id, 0.0) + hours_by_project.get(p.id, 0.0)
        scored = []
        for c in clients:
            hours = hours_by_client.get(c.id, 0.0)
            revenue = revenue_by_client.get(c.id, 0.0)
            if hours > 0 and revenue > 0:
                scored.append((revenue / hours, hours, revenue, c))
        if not scored:
            return AskResponse(
                answer="I could not compute a client effective rate yet — no client has both billed invoices and billable tracked hours on their projects.",
                intent="effective_rate",
                citations=[],
            )
        scored.sort(key=lambda t: t[0], reverse=True)
        rate, hours, revenue, top = scored[0]
        answer = (
            f"Your best effective hourly rate is {_money(rate)}/hr with {top.name}: "
            f"{hours:,.1f} billable hours tracked vs {_money(revenue)} billed."
        )
        citations = [Citation(label=top.name, type="client", id=top.id)]
        return AskResponse(answer=answer, intent="effective_rate", citations=citations)

    # --- intent: how much did I bill <client> ----------------------------------
    money_words = any(w in q for w in ("bill", "charg", "invoic", "revenue", "paid", "earn", "made", "money"))
    if client_hit and money_words:
        client, others = client_hit
        start, end, label = _period_bounds(q, datetime.utcnow())
        stmt = (
            select(Invoice)
            .where(
                Invoice.workspace_id == workspace.id,
                Invoice.client_id == client.id,
                Invoice.status != "draft",
            )
            .order_by(Invoice.issue_date.desc())
        )
        if start:
            stmt = stmt.where(Invoice.issue_date >= start)
        if end:
            stmt = stmt.where(Invoice.issue_date < end)
        invs = list((await db.execute(stmt)).scalars().all())
        total = round(sum(float(i.total_amount or 0.0) for i in invs), 2)

        detail = "; ".join(f"{i.invoice_number} {_money(i.total_amount or 0.0)} ({i.status})" for i in invs[:5])
        more = f" (+{len(invs) - 5} more)" if len(invs) > 5 else ""
        if invs:
            answer = (
                f"You billed {client.name} {_money(total)} across {len(invs)} invoice"
                f"{'' if len(invs) == 1 else 's'} {label}: {detail}{more}."
            )
        else:
            answer = f"You have billed {client.name} nothing {label} — no non-draft invoices in that window."
        answer += _ambiguity_note(others, client.name)
        citations = [Citation(label=client.name, type="client", id=client.id)]
        citations += [
            Citation(label=i.invoice_number, type="invoice", id=i.id) for i in invs[:5]
        ]
        return AskResponse(answer=answer, intent="client_billing", citations=citations)

    # --- fallback: recent activity, still citing real records -------------------
    recent_invoices = list((await db.execute(
        select(Invoice)
        .where(Invoice.workspace_id == workspace.id)
        .order_by(Invoice.created_at.desc())
        .limit(3)
    )).scalars().all())
    client_names = {c.id: c.name for c in clients}
    recent_projects = projects[:3]

    parts = []
    if recent_invoices:
        inv_bits = "; ".join(
            f"{i.invoice_number} for {client_names.get(i.client_id, 'a client')} — "
            f"{_money(i.total_amount or 0.0)} ({i.status})"
            for i in recent_invoices
        )
        parts.append(f"Most recent invoices: {inv_bits}.")
    if recent_projects:
        proj_bits = "; ".join(
            f"'{p.title}' — budget {_money(p.budget or 0.0)}, status {p.status}"
            for p in recent_projects
        )
        parts.append(f"Most recent projects: {proj_bits}.")
    answer = (
        "I couldn't match that to a specific report, but here is what's most recent in your books. "
        + " ".join(parts)
        if parts else
        "I couldn't match that to a specific report, and your books are still empty — no invoices or projects to cite."
    )
    citations = [Citation(label=i.invoice_number, type="invoice", id=i.id) for i in recent_invoices]
    citations += [Citation(label=p.title, type="project", id=p.id) for p in recent_projects]
    return AskResponse(answer=answer, intent="recent_activity", citations=citations)
