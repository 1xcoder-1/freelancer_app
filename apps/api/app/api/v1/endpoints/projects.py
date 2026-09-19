from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any, Optional
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.workspace import get_or_create_user_workspace
from app.models.project import Project, Task, Milestone
from app.models.contract import Contract
from app.models.client import Client
from app.models.workspace import Workspace
from app.schemas.domain import (
    ProjectCreate,
    ProjectOut,
    TaskCreate,
    TaskOut,
    MilestoneCreate,
    MilestoneOut,
    PublicProjectPortalOut,
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
    if project_status == "in_progress":
        return 50
    return 10

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

    # Load client names
    client_ids = [p.client_id for p in projects if p.client_id]
    clients_map = {}
    if client_ids:
        c_stmt = select(Client).where(Client.id.in_(client_ids))
        c_res = await db.execute(c_stmt)
        clients_map = {c.id: c.name for c in c_res.scalars().all()}

    out = []
    for p in projects:
        pct = calculate_progress(p.milestones, p.tasks, p.status)
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
            "tracked_hours": 0.0,
            "tasks": p.tasks,
            "milestones": p.milestones,
            "created_at": p.created_at
        }
        out.append(p_dict)
    return out

@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    project = Project(
        workspace_id=workspace.id,
        client_id=payload.client_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        budget=payload.budget,
        hourly_rate=payload.hourly_rate
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    # Auto-seed standard 3-phase milestones if none provided
    m1 = Milestone(project_id=project.id, title="Phase 1: Discovery & Architecture", amount=project.budget * 0.3, is_completed=True, deliverable_note="Wireframes & Tech Architecture Approved")
    m2 = Milestone(project_id=project.id, title="Phase 2: Core Feature Implementation", amount=project.budget * 0.4, is_completed=False, deliverable_note="MVP Features & Staging Deployment")
    m3 = Milestone(project_id=project.id, title="Phase 3: QA, Final Delivery & Launch", amount=project.budget * 0.3, is_completed=False, deliverable_note="Production Deploy & Source Handover")
    db.add_all([m1, m2, m3])
    await db.commit()

    # Re-fetch with relationships
    stmt = select(Project).options(selectinload(Project.tasks), selectinload(Project.milestones)).where(Project.id == project.id)
    r = await db.execute(stmt)
    full_p = r.scalar_one()

    client_name = None
    if full_p.client_id:
        c_res = await db.execute(select(Client).where(Client.id == full_p.client_id))
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
        "tracked_hours": 0.0,
        "tasks": full_p.tasks,
        "milestones": full_p.milestones,
        "created_at": full_p.created_at
    }

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
        status="todo"
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task

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

# ------------------------------------------------------------------------------
# Public Client Portal Endpoints (Passwordless Share Token)
# ------------------------------------------------------------------------------

@router.get("/portal/{token}", response_model=PublicProjectPortalOut)
async def get_public_project_portal(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Project)
        .options(
            selectinload(Project.milestones),
            selectinload(Project.tasks),
            selectinload(Project.contracts)
        )
        .where(Project.share_token == token)
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project portal link is invalid or expired")

    # Get Workspace / Freelancer info
    w_res = await db.execute(select(Workspace).where(Workspace.id == project.workspace_id))
    workspace = w_res.scalar_one_or_none()

    # Get Client info
    client_name = None
    if project.client_id:
        c_res = await db.execute(select(Client).where(Client.id == project.client_id))
        cl = c_res.scalar_one_or_none()
        if cl:
            client_name = cl.name

    # Contract status
    contract_status = None
    contract_signed = False
    if project.contracts and len(project.contracts) > 0:
        latest_c = project.contracts[-1]
        contract_status = latest_c.status
        contract_signed = latest_c.status == "signed"

    completed_milestones = sum(1 for m in project.milestones if m.is_completed)
    total_milestones = len(project.milestones)
    progress_pct = calculate_progress(project.milestones, project.tasks, project.status)

    active_tasks = sum(1 for t in project.tasks if t.status != "done")
    completed_tasks = sum(1 for t in project.tasks if t.status == "done")

    return {
        "id": project.id,
        "title": project.title,
        "description": project.description,
        "status": project.status,
        "budget": project.budget,
        "share_token": project.share_token,
        "progress_pct": progress_pct,
        "freelancer_name": workspace.name if workspace else "Freelancer",
        "client_name": client_name,
        "milestones": project.milestones,
        "completed_milestones_count": completed_milestones,
        "total_milestones_count": total_milestones,
        "active_tasks_count": active_tasks,
        "completed_tasks_count": completed_tasks,
        "contract_status": contract_status,
        "contract_signed": contract_signed,
        "created_at": project.created_at
    }

@router.post("/portal/{token}/milestones/{milestone_id}/approve", response_model=PublicProjectPortalOut)
async def approve_public_milestone(
    token: str,
    milestone_id: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Project)
        .options(
            selectinload(Project.milestones),
            selectinload(Project.tasks),
            selectinload(Project.contracts)
        )
        .where(Project.share_token == token)
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project portal link is invalid or expired")

    milestone = next((m for m in project.milestones if m.id == milestone_id), None)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found in this project")

    milestone.is_completed = True
    await db.commit()
    await db.refresh(project)

    # Re-fetch full project
    stmt_full = (
        select(Project)
        .options(
            selectinload(Project.milestones),
            selectinload(Project.tasks),
            selectinload(Project.contracts)
        )
        .where(Project.id == project.id)
    )
    r = await db.execute(stmt_full)
    updated_p = r.scalar_one()

    w_res = await db.execute(select(Workspace).where(Workspace.id == updated_p.workspace_id))
    workspace = w_res.scalar_one_or_none()

    client_name = None
    if updated_p.client_id:
        c_res = await db.execute(select(Client).where(Client.id == updated_p.client_id))
        cl = c_res.scalar_one_or_none()
        if cl:
            client_name = cl.name

    contract_status = None
    contract_signed = False
    if updated_p.contracts and len(updated_p.contracts) > 0:
        latest_c = updated_p.contracts[-1]
        contract_status = latest_c.status
        contract_signed = latest_c.status == "signed"

    completed_milestones = sum(1 for m in updated_p.milestones if m.is_completed)
    total_milestones = len(updated_p.milestones)
    progress_pct = calculate_progress(updated_p.milestones, updated_p.tasks, updated_p.status)

    active_tasks = sum(1 for t in updated_p.tasks if t.status != "done")
    completed_tasks = sum(1 for t in updated_p.tasks if t.status == "done")

    return {
        "id": updated_p.id,
        "title": updated_p.title,
        "description": updated_p.description,
        "status": updated_p.status,
        "budget": updated_p.budget,
        "share_token": updated_p.share_token,
        "progress_pct": progress_pct,
        "freelancer_name": workspace.name if workspace else "Freelancer",
        "client_name": client_name,
        "milestones": updated_p.milestones,
        "completed_milestones_count": completed_milestones,
        "total_milestones_count": total_milestones,
        "active_tasks_count": active_tasks,
        "completed_tasks_count": completed_tasks,
        "contract_status": contract_status,
        "contract_signed": contract_signed,
        "created_at": updated_p.created_at
    }
