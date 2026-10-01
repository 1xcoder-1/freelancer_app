from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.workspace import get_or_create_user_workspace
from app.models.project import Project, Task, Milestone, ChangeRequest, ProjectFile, generate_share_token
from app.models.contract import Contract
from app.models.client import Client
from app.models.workspace import Workspace
from app.models.finance import TimeEntry
from app.services.revenue_at_stake import compute_revenue_at_stake
from app.schemas.domain import (
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
    TaskCreate,
    TaskOut,
    TaskUpdate,
    MilestoneCreate,
    MilestoneOut,
    MilestoneUpdate,
    PublicProjectPortalOut,
    ChangeRequestCreate,
    ChangeRequestUpdate,
    ChangeRequestOut,
    ChangeRequestDecision,
    PortalVerifyIn,
    ProjectMilestoneSubmitIn,
    ProjectFileIn,
    ProjectFileOut,
)

router = APIRouter(prefix="/projects", tags=["Projects, Milestones & Client Portal"])

def calculate_progress(milestones: list, tasks: list, project_status: str) -> int:
    if project_status == "completed":
        return 100
    if milestones and len(milestones) > 0:
        completed = sum(1 for m in milestones if m.is_completed)
        return int((completed / len(milestones)) * 100)
    if tasks and len(tasks) > 0:
        done = sum(1 for t in tasks if t.status == "done")
        return int((done / len(tasks)) * 100)
    # No milestones/tasks logged yet — real progress is 0%, never a fake floor
    return 0


async def _tracked_hours_map(db: AsyncSession, project_ids: list) -> dict:
    """Real tracked hours per project from TimeEntry records (0.0 = none logged)."""
    if not project_ids:
        return {}
    stmt = (
        select(TimeEntry.project_id, func.coalesce(func.sum(TimeEntry.duration_seconds), 0))
        .where(TimeEntry.project_id.in_(project_ids))
        .group_by(TimeEntry.project_id)
    )
    res = await db.execute(stmt)
    return {pid: round((secs or 0) / 3600.0, 1) for pid, secs in res.all()}


async def _client_name_map(db: AsyncSession, workspace_id: str, client_ids: list) -> dict:
    """Workspace-scoped id -> name map (never leaks other tenants' clients)."""
    ids = [cid for cid in client_ids if cid]
    if not ids:
        return {}
    res = await db.execute(
        select(Client.id, Client.name).where(Client.id.in_(ids), Client.workspace_id == workspace_id)
    )
    return {cid: name for cid, name in res.all()}


def _as_date(value):
    """Date columns surface as datetime.date, but the ORM annotation is datetime;
    normalise so day maths never mixes a naive datetime with a date."""
    if value is None:
        return None
    return value.date() if isinstance(value, datetime) else value


def derive_deadline(project: Project, milestones: list, tasks: list, now: Optional[datetime] = None) -> Optional[dict]:
    """P2 deadline risk verdict: due date vs elapsed schedule and completion.
    Derived on read (never stored) so it is always live against the clock."""
    due = _as_date(project.due_date)
    if not due:
        return None
    now = now or datetime.utcnow()
    days_left = (due - now.date()).days
    progress = calculate_progress(milestones, tasks, project.status)
    if project.status == "completed":
        verdict = "completed"
    elif days_left < 0:
        verdict = "overdue"
    elif days_left <= 3 and progress < 100:
        verdict = "at_risk"
    else:
        verdict = "on_track"
        start = _as_date(project.start_date)
        if start:
            total = max((due - start).days, 1)
            elapsed = (now.date() - start).days
            if elapsed / total >= 0.6 and progress < 50:
                verdict = "at_risk"
    return {
        "verdict": verdict,
        "days_left": days_left,
        "due_date": due.isoformat(),
        "progress_pct": progress,
    }


async def _unbilled_map(db: AsyncSession, project_ids: list) -> dict:
    """P1 unbilled hours + value per project, one grouped pass (billable, not
    yet invoiced). Powers the 'Unbilled: n hrs = $x' chip on the card."""
    ids = [pid for pid in project_ids if pid]
    if not ids:
        return {}
    rows = (await db.execute(
        select(
            TimeEntry.project_id,
            func.coalesce(func.sum(TimeEntry.duration_seconds), 0),
            func.coalesce(func.sum(TimeEntry.duration_seconds / 3600.0 * TimeEntry.hourly_rate), 0.0),
        )
        .where(
            TimeEntry.project_id.in_(ids),
            TimeEntry.is_billable.is_(True),
            TimeEntry.is_invoiced.is_(False),
        )
        .group_by(TimeEntry.project_id)
    )).all()
    return {pid: (round((s or 0) / 3600.0, 2), round(float(v or 0.0), 2)) for pid, s, v in rows}


async def _task_actual_hours_map(db: AsyncSession, task_ids: list) -> dict:
    """P5 actual vs estimated: hours logged against each task via task_id."""
    ids = [tid for tid in task_ids if tid]
    if not ids:
        return {}
    rows = (await db.execute(
        select(TimeEntry.task_id, func.coalesce(func.sum(TimeEntry.duration_seconds), 0))
        .where(TimeEntry.task_id.in_(ids))
        .group_by(TimeEntry.task_id)
    )).all()
    return {tid: round((s or 0) / 3600.0, 2) for tid, s in rows}


def _serialize_tasks(tasks: list, task_hours: dict) -> list:
    """Tasks as dicts enriched with the P5 actual-hours overlay."""
    out = []
    for t in tasks:
        out.append({
            "id": t.id,
            "project_id": t.project_id,
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "priority": t.priority,
            "estimated_hours": t.estimated_hours,
            "due_date": _as_date(t.due_date),
            "actual_hours": task_hours.get(t.id, 0.0),
            "created_at": t.created_at,
        })
    return out


async def _project_payload(db: AsyncSession, project: Project) -> dict:
    """Uniform ProjectOut shape (progress + real tracked/unbilled hours)."""
    clients_map = await _client_name_map(db, project.workspace_id, [project.client_id])
    hours_map = await _tracked_hours_map(db, [project.id])
    unbilled_map = await _unbilled_map(db, [project.id])
    task_hours = await _task_actual_hours_map(db, [t.id for t in project.tasks])
    uh, uv = unbilled_map.get(project.id, (0.0, 0.0))
    return {
        "id": project.id,
        "workspace_id": project.workspace_id,
        "client_id": project.client_id,
        "client_name": clients_map.get(project.client_id),
        "title": project.title,
        "description": project.description,
        "status": project.status,
        "budget": project.budget,
        "hourly_rate": project.hourly_rate,
        "share_token": project.share_token,
        "progress_pct": calculate_progress(project.milestones, project.tasks, project.status),
        "tracked_hours": hours_map.get(project.id, 0.0),
        "unbilled_hours": uh,
        "unbilled_value": uv,
        "start_date": _as_date(project.start_date),
        "due_date": _as_date(project.due_date),
        "deadline": derive_deadline(project, project.milestones, project.tasks),
        "tasks": _serialize_tasks(project.tasks, task_hours),
        "milestones": project.milestones,
        "created_at": project.created_at,
    }

async def _project_with_relations(db: AsyncSession, project_id: str, workspace_id: str) -> Optional[Project]:
    res = await db.execute(
        select(Project)
        .options(selectinload(Project.tasks), selectinload(Project.milestones))
        .where(Project.id == project_id, Project.workspace_id == workspace_id)
    )
    return res.scalar_one_or_none()

# ------------------------------------------------------------------------------
# Authenticated Workspace Projects & Milestones
# ------------------------------------------------------------------------------

@router.get("", response_model=List[ProjectOut])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = (
        select(Project)
        .options(selectinload(Project.tasks), selectinload(Project.milestones))
        .where(Project.workspace_id == workspace.id)
        .order_by(Project.created_at.desc())
    )
    result = await db.execute(stmt)
    projects = result.scalars().all()

    # Load client names (columns-only — full ORM rows cost extra load state).
    # Scoped to this workspace: an unscoped IN lookup would leak other
    # tenants' client names into our response the moment ids ever collide.
    clients_map = await _client_name_map(db, workspace.id, [p.client_id for p in projects])

    # Real tracked hours per project (from logged time entries)
    hours_map = await _tracked_hours_map(db, [p.id for p in projects])
    # P1 unbilled + P5 task actuals, both bulk (never a query per project).
    unbilled_map = await _unbilled_map(db, [p.id for p in projects])
    all_task_ids = [t.id for p in projects for t in p.tasks]
    task_hours = await _task_actual_hours_map(db, all_task_ids)
    out = []
    for p in projects:
        pct = calculate_progress(p.milestones, p.tasks, p.status)
        uh, uv = unbilled_map.get(p.id, (0.0, 0.0))
        p_dict = {
            "id": p.id,
            "workspace_id": p.workspace_id,
            "client_id": p.client_id,
            "client_name": clients_map.get(p.client_id) if p.client_id else None,
            "title": p.title,
            "description": p.description,
            "status": p.status,
            "budget": p.budget,
            "hourly_rate": p.hourly_rate,
            "share_token": p.share_token,
            "progress_pct": pct,
            "tracked_hours": hours_map.get(p.id, 0.0),
            "unbilled_hours": uh,
            "unbilled_value": uv,
            "start_date": _as_date(p.start_date),
            "due_date": _as_date(p.due_date),
            "deadline": derive_deadline(p, p.milestones, p.tasks),
            "tasks": _serialize_tasks(p.tasks, task_hours),
            "milestones": p.milestones,
            "created_at": p.created_at
        }
        out.append(p_dict)
    return out


@router.get("/at-risk", response_model=Dict[str, Any])
async def projects_at_risk(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Where the money is stuck, project by project (P1 / F4).

    Shares ``compute_revenue_at_stake`` with the contracts page so both read one
    source of truth. Declared before ``/{project_id}`` so the literal path wins.
    Only projects with something actually at stake are returned, biggest first.
    """
    _, workspace = await get_or_create_user_workspace(db, current_user)
    agg = await compute_revenue_at_stake(db, workspace.id, workspace.currency)
    projects = [p for p in agg["at_risk_projects"] if p["total_at_risk"] > 0]
    return {
        "currency": agg["currency"],
        "totals": agg["totals"],
        "projects": projects,
        "generated_at": agg["generated_at"],
    }


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    # A project can only ever point at a client that lives in this workspace —
    # without this check any authenticated user could attach arbitrary client_ids
    # (IDOR write) and expose another tenant's client on a shared project.
    if payload.client_id:
        cl_res = await db.execute(
            select(Client.id).where(Client.id == payload.client_id, Client.workspace_id == workspace.id)
        )
        if cl_res.scalars().first() is None:
            raise HTTPException(status_code=400, detail="Client not found in current workspace")
    project = Project(
        workspace_id=workspace.id,
        client_id=payload.client_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        budget=payload.budget,
        hourly_rate=payload.hourly_rate,
        start_date=payload.start_date,
        due_date=payload.due_date
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    # Auto-seed standard 3-phase milestones if none provided
    m1 = Milestone(project_id=project.id, title="Phase 1: Discovery & Architecture", amount=project.budget * 0.3, is_completed=False, deliverable_note="Wireframes & Tech Architecture Approved")
    m2 = Milestone(project_id=project.id, title="Phase 2: Core Feature Implementation", amount=project.budget * 0.4, is_completed=False, deliverable_note="MVP Features & Staging Deployment")
    m3 = Milestone(project_id=project.id, title="Phase 3: QA, Final Delivery & Launch", amount=project.budget * 0.3, is_completed=False, deliverable_note="Production Deploy & Source Handover")
    db.add_all([m1, m2, m3])
    await db.commit()

    # Re-fetch with relationships
    stmt = select(Project).options(selectinload(Project.tasks), selectinload(Project.milestones)).where(Project.id == project.id)
    r = await db.execute(stmt)
    full_p = r.scalar_one()

    hours_map = await _tracked_hours_map(db, [full_p.id])

    client_name = None
    if full_p.client_id:
        c_res = await db.execute(
            select(Client).where(Client.id == full_p.client_id, Client.workspace_id == workspace.id)
        )
        cl = c_res.scalar_one_or_none()
        if cl:
            client_name = cl.name

    return {
        "id": full_p.id,
        "workspace_id": full_p.workspace_id,
        "client_id": full_p.client_id,
        "client_name": client_name,
        "title": full_p.title,
        "description": full_p.description,
        "status": full_p.status,
        "budget": full_p.budget,
        "hourly_rate": full_p.hourly_rate,
        "share_token": full_p.share_token,
        "progress_pct": calculate_progress(full_p.milestones, full_p.tasks, full_p.status),
        "tracked_hours": hours_map.get(full_p.id, 0.0),
        "tasks": full_p.tasks,
        "milestones": full_p.milestones,
        "created_at": full_p.created_at
    }

@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    project = await _project_with_relations(db, project_id, workspace.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await _project_payload(db, project)

@router.post("/{project_id}/milestones", response_model=MilestoneOut, status_code=status.HTTP_201_CREATED)
async def create_milestone(
    project_id: str,
    payload: MilestoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    p_stmt = select(Project).where(Project.id == project_id, Project.workspace_id == workspace.id)
    p_res = await db.execute(p_stmt)
    project = p_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    milestone = Milestone(
        project_id=project.id,
        title=payload.title,
        description=payload.description,
        amount=payload.amount,
        deliverable_note=payload.deliverable_note,
        due_date=payload.due_date,
        is_completed=False
    )
    db.add(milestone)
    await db.commit()
    await db.refresh(milestone)
    return milestone

@router.post("/{project_id}/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: str,
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    p_stmt = select(Project).where(Project.id == project_id, Project.workspace_id == workspace.id)
    p_res = await db.execute(p_stmt)
    project = p_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    task = Task(
        project_id=project.id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        estimated_hours=payload.estimated_hours,
        due_date=payload.due_date,
        status="todo"
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task

async def _get_child_in_workspace(db: AsyncSession, model, child_id: str, workspace_id: str):
    """Fetch a Task/Milestone only when its parent project belongs to this
    workspace — ids from another tenant must 404, never 200."""
    res = await db.execute(
        select(model)
        .join(Project, model.project_id == Project.id)
        .where(model.id == child_id, Project.workspace_id == workspace_id)
    )
    return res.scalar_one_or_none()


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Edits and the status lifecycle (planning → in_progress → completed/paused).
    Without this the progress bar and the 'completed' state were unreachable."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    project = await _project_with_relations(db, project_id, workspace.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    changes = payload.model_dump(exclude_unset=True)
    if "client_id" in changes and changes["client_id"]:
        cl_res = await db.execute(
            select(Client.id).where(Client.id == changes["client_id"], Client.workspace_id == workspace.id)
        )
        if cl_res.scalars().first() is None:
            raise HTTPException(status_code=400, detail="Client not found in current workspace")
    for key, value in changes.items():
        setattr(project, key, value)
    await db.commit()

    updated = await _project_with_relations(db, project_id, workspace.id)
    return await _project_payload(db, updated)


@router.patch("/{project_id}/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    project_id: str,
    task_id: str,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    task = await _get_child_in_workspace(db, Task, task_id, workspace.id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found in this project")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{project_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    project_id: str,
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    task = await _get_child_in_workspace(db, Task, task_id, workspace.id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Task not found in this project")
    await db.delete(task)
    await db.commit()
    return None


@router.patch("/{project_id}/milestones/{milestone_id}", response_model=MilestoneOut)
async def update_milestone(
    project_id: str,
    milestone_id: str,
    payload: MilestoneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Milestone check-off / amount edits — feeds progress % and the portal."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    milestone = await _get_child_in_workspace(db, Milestone, milestone_id, workspace.id)
    if not milestone or milestone.project_id != project_id:
        raise HTTPException(status_code=404, detail="Milestone not found in this project")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(milestone, key, value)
    await db.commit()
    await db.refresh(milestone)
    return milestone


@router.delete("/{project_id}/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_milestone(
    project_id: str,
    milestone_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    milestone = await _get_child_in_workspace(db, Milestone, milestone_id, workspace.id)
    if not milestone or milestone.project_id != project_id:
        raise HTTPException(status_code=404, detail="Milestone not found in this project")
    await db.delete(milestone)
    await db.commit()
    return None


@router.post("/{project_id}/rotate-share-token", response_model=ProjectOut)
async def rotate_project_share_token(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """SE10: revoke a leaked client-portal link by minting a fresh share token.
    The old portal URL stops resolving immediately (the public route keys on it).
    """
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Project).where(Project.id == project_id, Project.workspace_id == workspace.id)
    project = (await db.execute(stmt)).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.share_token = generate_share_token()
    await db.commit()
    # Re-load with relationships eager so the payload never triggers lazy IO.
    project = await _project_with_relations(db, project_id, workspace.id)
    return await _project_payload(db, project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Project).where(Project.id == project_id, Project.workspace_id == workspace.id)
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()


@router.get("/{project_id}/unbilled-time", response_model=Dict[str, Any])
async def project_unbilled_time(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """P1 — the hours this project earned but never billed, with the individual
    entries so the freelancer can select and bill them. Was only reachable from
    the Invoices page; here it lives on the project that earned it."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    project = await _project_with_relations(db, project_id, workspace.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    rows = (await db.execute(
        select(TimeEntry)
        .where(
            TimeEntry.project_id == project.id,
            TimeEntry.workspace_id == workspace.id,
            TimeEntry.is_billable.is_(True),
            TimeEntry.is_invoiced.is_(False),
        )
        .order_by(TimeEntry.start_time.desc())
    )).scalars().all()
    hours = round(sum((e.duration_seconds or 0) for e in rows) / 3600.0, 2)
    value = round(sum((e.duration_seconds or 0) / 3600.0 * (e.hourly_rate or 0.0) for e in rows), 2)
    entries = [
        {
            "id": e.id,
            "description": e.description,
            "start_time": e.start_time,
            "duration_seconds": e.duration_seconds,
            "hours": round((e.duration_seconds or 0) / 3600.0, 2),
            "hourly_rate": e.hourly_rate,
            "task_id": e.task_id,
        }
        for e in rows
    ]
    return {
        "project_id": project.id,
        "hours": hours,
        "value": value,
        "entries": entries,
    }


@router.post("/{project_id}/milestones/{milestone_id}/submit", response_model=MilestoneOut)
async def submit_milestone(
    project_id: str,
    milestone_id: str,
    payload: ProjectMilestoneSubmitIn,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """P6 — freelancer delivers the phase: stamp submitted_at (the client's
    sign-off clock starts). Completion still only happens on client approval."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    milestone = await _get_child_in_workspace(db, Milestone, milestone_id, workspace.id)
    if not milestone or milestone.project_id != project_id:
        raise HTTPException(status_code=404, detail="Milestone not found in this project")
    milestone.submitted_at = datetime.utcnow()
    if payload.note:
        milestone.deliverable_note = payload.note
    await db.commit()
    await db.refresh(milestone)
    return milestone


# ------------------------------------------------------------------------------
# Change Requests (P3 — priced, auditable scope changes; client decides in portal)
# ------------------------------------------------------------------------------

@router.get("/{project_id}/change-requests", response_model=List[ChangeRequestOut])
async def list_change_requests(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    project = await _project_with_relations(db, project_id, workspace.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    rows = (await db.execute(
        select(ChangeRequest)
        .where(ChangeRequest.project_id == project.id, ChangeRequest.workspace_id == workspace.id)
        .order_by(ChangeRequest.created_at.desc())
    )).scalars().all()
    return rows


@router.post("/{project_id}/change-requests", response_model=ChangeRequestOut, status_code=status.HTTP_201_CREATED)
async def create_change_request(
    project_id: str,
    payload: ChangeRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    project = await _project_with_relations(db, project_id, workspace.id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    cr = ChangeRequest(
        project_id=project.id,
        workspace_id=workspace.id,
        title=payload.title,
        detail=payload.detail,
        price=payload.price,
        impact_days=payload.impact_days,
        requested_by=payload.requested_by,
        status="requested",
    )
    db.add(cr)
    await db.commit()
    await db.refresh(cr)
    return cr


@router.patch("/{project_id}/change-requests/{cr_id}", response_model=ChangeRequestOut)
async def update_change_request(
    project_id: str,
    cr_id: str,
    payload: ChangeRequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Freelancer-side edits (re-price, mark implemented). Client approvals go
    through the recipient-guarded portal route, not here."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    cr = (await db.execute(
        select(ChangeRequest).where(
            ChangeRequest.id == cr_id,
            ChangeRequest.project_id == project_id,
            ChangeRequest.workspace_id == workspace.id,
        )
    )).scalar_one_or_none()
    if not cr:
        raise HTTPException(status_code=404, detail="Change request not found")
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(cr, key, value)
    await db.commit()
    await db.refresh(cr)
    return cr

# ------------------------------------------------------------------------------
# Public Client Portal Endpoints (Passwordless Share Token)
# ------------------------------------------------------------------------------

async def _load_portal_project(db: AsyncSession, token: str) -> Project:
    """Fetch the portal project with every relation the page renders, so the
    read view and every approving mutation share one load path."""
    stmt = (
        select(Project)
        .options(
            selectinload(Project.milestones),
            selectinload(Project.tasks),
            selectinload(Project.contracts),
            selectinload(Project.change_requests),
        )
        .where(Project.share_token == token)
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project portal link is invalid or expired")
    return project


def _require_portal_recipient(project: Project, email: str) -> None:
    """SE4 gate: an approving portal action needs a captured recipient email
    that matches. A leaked token alone is inert until identity is proven."""
    if not project.portal_recipient_email:
        raise HTTPException(status_code=403, detail="Verify the recipient email for this project first")
    if project.portal_recipient_email != email.lower().strip():
        raise HTTPException(status_code=403, detail="Recipient email does not match this project")


async def _portal_payload(db: AsyncSession, project: Project) -> dict:
    w_res = await db.execute(select(Workspace).where(Workspace.id == project.workspace_id))
    workspace = w_res.scalar_one_or_none()

    client_name = None
    if project.client_id:
        c_res = await db.execute(select(Client).where(Client.id == project.client_id))
        cl = c_res.scalar_one_or_none()
        if cl:
            client_name = cl.name

    contract_status = None
    contract_signed = False
    if project.contracts:
        latest_c = project.contracts[-1]
        contract_status = latest_c.status
        contract_signed = latest_c.status == "signed"

    change_requests = sorted(project.change_requests, key=lambda c: c.created_at, reverse=True)

    return {
        "id": project.id,
        "title": project.title,
        "description": project.description,
        "status": project.status,
        "budget": project.budget,
        "share_token": project.share_token,
        "progress_pct": calculate_progress(project.milestones, project.tasks, project.status),
        "freelancer_name": workspace.name if workspace else "",
        "client_name": client_name,
        "milestones": project.milestones,
        "completed_milestones_count": sum(1 for m in project.milestones if m.is_completed),
        "total_milestones_count": len(project.milestones),
        "active_tasks_count": sum(1 for t in project.tasks if t.status != "done"),
        "completed_tasks_count": sum(1 for t in project.tasks if t.status == "done"),
        "contract_status": contract_status,
        "contract_signed": contract_signed,
        "change_requests": change_requests,
        "recipient_verified": bool(project.portal_recipient_email),
        "created_at": project.created_at,
    }


@router.get("/portal/{token}", response_model=PublicProjectPortalOut)
async def get_public_project_portal(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    project = await _load_portal_project(db, token)
    return await _portal_payload(db, project)


@router.post("/portal/{token}/verify", response_model=PublicProjectPortalOut)
async def verify_portal_recipient(
    token: str,
    payload: PortalVerifyIn,
    db: AsyncSession = Depends(get_db)
):
    """SE4 — the viewer proves they are the intended recipient by supplying the
    email this project was shared with. Stored once; approving actions (milestone
    sign-off, change-request decisions) require this exact address afterwards."""
    project = await _load_portal_project(db, token)
    email = payload.email.lower().strip()
    if project.portal_recipient_email:
        if project.portal_recipient_email != email:
            raise HTTPException(status_code=403, detail="This email does not match the project's shared recipient")
    else:
        project.portal_recipient_email = email
        await db.commit()
    return await _portal_payload(db, project)


@router.post("/portal/{token}/milestones/{milestone_id}/approve", response_model=PublicProjectPortalOut)
async def approve_public_milestone(
    token: str,
    milestone_id: str,
    payload: PortalVerifyIn,
    db: AsyncSession = Depends(get_db)
):
    """P6 client sign-off — gated by SE4: a leaked token can no longer approve a
    deliverable on its own; the approver's email must match the recorded one."""
    project = await _load_portal_project(db, token)
    _require_portal_recipient(project, payload.email)

    milestone = next((m for m in project.milestones if m.id == milestone_id), None)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found in this project")

    milestone.is_completed = True
    milestone.approved_at = datetime.utcnow()
    await db.commit()
    return await _portal_payload(db, project)


@router.post("/portal/{token}/change-requests/{cr_id}/decide", response_model=PublicProjectPortalOut)
async def decide_public_change_request(
    token: str,
    cr_id: str,
    payload: ChangeRequestDecision,
    db: AsyncSession = Depends(get_db)
):
    """P3 client approves/declines a priced scope change. SE4: recipient email
    must match, and only an open (requested) change can be decided."""
    project = await _load_portal_project(db, token)
    _require_portal_recipient(project, payload.email)

    cr = next((c for c in project.change_requests if c.id == cr_id), None)
    if not cr:
        raise HTTPException(status_code=404, detail="Change request not found in this project")
    if cr.status != "requested":
        raise HTTPException(status_code=409, detail="This change request has already been decided")

    cr.status = payload.decision
    cr.decided_at = datetime.utcnow()
    cr.decision_note = payload.note
    await db.commit()
    return await _portal_payload(db, project)


# ------------------------------------------------------------------------------
# Project Files / Documents (Vault, Briefs, Specs, Assets, Deliverables)
# ------------------------------------------------------------------------------
@router.get("/{project_id}/files", response_model=List[ProjectFileOut])
async def list_project_files(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    # Validate project exists in workspace
    project = await db.scalar(
        select(Project).where(Project.id == project_id, Project.workspace_id == workspace.id)
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    rows = (await db.execute(
        select(ProjectFile).where(
            ProjectFile.project_id == project_id,
            ProjectFile.workspace_id == workspace.id
        ).order_by(ProjectFile.created_at.desc())
    )).scalars().all()
    return rows


@router.post("/{project_id}/files", response_model=ProjectFileOut, status_code=status.HTTP_201_CREATED)
async def register_project_file(
    project_id: str,
    payload: ProjectFileIn,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    project = await db.scalar(
        select(Project).where(Project.id == project_id, Project.workspace_id == workspace.id)
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if ".." in payload.file_key or payload.file_key.startswith("/"):
        raise HTTPException(status_code=422, detail="Invalid file key")

    file = ProjectFile(
        project_id=project_id,
        workspace_id=workspace.id,
        file_key=payload.file_key,
        file_name=payload.file_name,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
        category=payload.category,
    )
    db.add(file)
    await db.commit()
    await db.refresh(file)
    return file


@router.delete("/{project_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_file(
    project_id: str,
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    file = await db.scalar(
        select(ProjectFile).where(
            ProjectFile.id == file_id,
            ProjectFile.project_id == project_id,
            ProjectFile.workspace_id == workspace.id
        )
    )
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    await db.delete(file)
    await db.commit()

