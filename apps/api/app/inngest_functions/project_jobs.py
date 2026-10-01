"""Inngest durable workflows for projects & deliverables.

Two daily crons:

* ``project.status-scan`` (P2) — finds active projects that are overdue or at
  risk against their real ``due_date`` and emails the freelancer, instead of
  only logging a count like the original scan did.
* ``project.task-day-scan`` (P4) — builds each workspace's "today" briefing
  (overdue + due-today tasks) and emits it so a notification surface can fan it
  out.

Both keep their core logic in module-level helpers so the hermetic test suite
can drive them directly, without an Inngest server (the established seam).
"""

from datetime import datetime, date
from typing import Any, Dict, List, Optional

import inngest
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.core.inngest_client import emit, inngest_client
from app.models.project import Project, Milestone, Task
from app.models.workspace import User, Membership
from app.services.email_service import send_email


def _as_date(value):
    if value is None:
        return None
    return value.date() if isinstance(value, datetime) else value


def _progress(project: Project) -> int:
    if project.status == "completed":
        return 100
    ms = project.milestones
    if ms:
        return int((sum(1 for m in ms if m.is_completed) / len(ms)) * 100)
    ts = project.tasks
    if ts:
        return int((sum(1 for t in ts if t.status == "done") / len(ts)) * 100)
    return 0


def _deadline_verdict(project: Project, now: datetime) -> Optional[Dict[str, Any]]:
    """Mirror of the read-side P2 verdict so the cron and the API agree."""
    due = _as_date(project.due_date)
    if not due:
        return None
    days_left = (due - now.date()).days
    pct = _progress(project)
    if project.status == "completed":
        verdict = "completed"
    elif days_left < 0:
        verdict = "overdue"
    elif days_left <= 3 and pct < 100:
        verdict = "at_risk"
    else:
        verdict = "on_track"
        start = _as_date(project.start_date)
        if start:
            total = max((due - start).days, 1)
            if (now.date() - start).days / total >= 0.6 and pct < 50:
                verdict = "at_risk"
    if verdict in ("overdue", "at_risk"):
        return {
            "project_id": project.id,
            "workspace_id": project.workspace_id,
            "title": project.title,
            "verdict": verdict,
            "days_left": days_left,
            "progress_pct": pct,
        }
    return None


async def scan_active_projects_and_milestones(session, now: Optional[datetime] = None) -> dict:
    """Scan active projects and pending milestones; also derive deadline risk.

    Module-level so it can be tested directly. ``now`` is injectable for
    deterministic date maths in tests."""
    now = now or datetime.utcnow()

    p_res = await session.execute(
        select(Project)
        .options(selectinload(Project.milestones), selectinload(Project.tasks))
        .where(Project.status.in_(("in_progress", "planning", "paused")))
    )
    active_projects = p_res.scalars().all()
    active_summary = [{"id": p.id, "title": p.title, "status": p.status} for p in active_projects]

    deadline_alerts = [a for a in (_deadline_verdict(p, now) for p in active_projects) if a]

    m_res = await session.execute(select(Milestone).where(Milestone.is_completed == False))  # noqa: E712
    pending_milestones = [
        {"id": m.id, "title": m.title, "project_id": m.project_id} for m in m_res.scalars().all()
    ]

    return {
        "active_projects_count": len(active_summary),
        "pending_milestones_count": len(pending_milestones),
        "deadline_alerts_count": len(deadline_alerts),
        "projects": active_summary,
        "milestones": pending_milestones,
        "deadline_alerts": deadline_alerts,
    }


async def _owner_email(session, workspace_id: str) -> Optional[str]:
    res = await session.execute(
        select(User.email)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.workspace_id == workspace_id, Membership.role == "owner")
        .limit(1)
    )
    return res.scalars().first()


async def notify_deadline_alerts(session, alerts: List[Dict[str, Any]]) -> dict:
    """P2 — email the freelancer about projects slipping past their due date.

    Kept separate from the scan so tests can assert the verdicts without the
    email side effect. send_email is a console no-op without RESEND_API_KEY."""
    if not alerts:
        return {"notified": 0}

    # Group per workspace so the owner gets one digest, not one email a project.
    by_ws: Dict[str, List[Dict[str, Any]]] = {}
    for a in alerts:
        by_ws.setdefault(a["workspace_id"], []).append(a)

    emails_sent = 0
    for ws_id, items in by_ws.items():
        owner = await _owner_email(session, ws_id)
        if not owner:
            continue
        lines = "\n".join(
            f"  - {i['title']}: {i['verdict']}"
            + (f" ({-i['days_left']} days overdue)" if i["days_left"] < 0 else f" ({i['days_left']} days left)")
            for i in items
        )
        subject = f"{len(items)} project(s) need attention — deadline check-in"
        text = f"Hi,\n\nYour daily project deadline scan flagged:\n{lines}\n\n— Freelance Book"
        await send_email(to=owner, subject=subject, text=text)
        emails_sent += 1

    return {"notified": emails_sent, "workspaces": len(by_ws)}


@inngest_client.create_function(
    fn_id="project.status-scan",
    trigger=inngest.TriggerCron(cron="0 7 * * *"),
)
async def project_status_scan(ctx: inngest.Context) -> dict:
    """Daily cron sweep: active projects + deadline alerts emailed to owner."""

    async def _scan() -> dict:
        async with AsyncSessionLocal() as session:
            return await scan_active_projects_and_milestones(session)

    result = await ctx.step.run("scan-active-projects", _scan)
    ctx.logger.info(
        f"Project status scan: {result['active_projects_count']} active, "
        f"{result['deadline_alerts_count']} deadline alert(s)"
    )

    async def _notify() -> dict:
        async with AsyncSessionLocal() as session:
            return await notify_deadline_alerts(session, result["deadline_alerts"])

    await ctx.step.run("email-deadline-alerts", _notify)
    return result


async def today_tasks(session, on_date: Optional[date] = None) -> dict:
    """P4 — the "today" briefing: overdue and due-today open tasks.

    Module-level helper so tests can seed tasks and assert the buckets without a
    cron run. ``on_date`` defaults to today; injectable for determinism."""
    on_date = on_date or datetime.utcnow().date()
    res = await session.execute(
        select(Task)
        .options(selectinload(Task.project))
        .join(Project, Task.project_id == Project.id)
        .where(
            Task.due_date.is_not(None),
            Task.status != "done",
        )
        .order_by(Task.due_date.asc())
    )
    tasks = res.scalars().all()
    overdue: List[Dict[str, Any]] = []
    due_today: List[Dict[str, Any]] = []
    for t in tasks:
        due = _as_date(t.due_date)
        if due is None:
            continue
        item = {
            "id": t.id,
            "title": t.title,
            "project_id": t.project_id,
            "priority": t.priority,
            "due_date": due.isoformat(),
            "days_overdue": (on_date - due).days,
        }
        if due < on_date:
            overdue.append(item)
        elif due == on_date:
            due_today.append(item)
    return {
        "date": on_date.isoformat(),
        "overdue_count": len(overdue),
        "due_today_count": len(due_today),
        "overdue": overdue,
        "due_today": due_today,
    }


@inngest_client.create_function(
    fn_id="project.task-day-scan",
    trigger=inngest.TriggerCron(cron="30 7 * * *"),
)
async def project_task_day_scan(ctx: inngest.Context) -> dict:
    """Daily briefing: emit the overdue/due-today task list for notification."""

    async def _briefing() -> dict:
        async with AsyncSessionLocal() as session:
            return await today_tasks(session)

    result = await ctx.step.run("collect-today-tasks", _briefing)
    ctx.logger.info(
        f"Task day scan: {result['overdue_count']} overdue, {result['due_today_count']} due today"
    )
    await emit("project.today-briefing", {
        "date": result["date"],
        "overdue_count": result["overdue_count"],
        "due_today_count": result["due_today_count"],
    })
    return result
