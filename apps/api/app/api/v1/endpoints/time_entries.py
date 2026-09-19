from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from datetime import datetime
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.workspace import get_or_create_user_workspace
from app.models.finance import TimeEntry
from app.models.project import Project
from app.schemas.domain import TimeEntryCreate, TimeEntryOut

router = APIRouter(prefix="/time-entries", tags=["Time Tracking"])

@router.get("", response_model=List[TimeEntryOut])
async def list_time_entries(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(TimeEntry).where(TimeEntry.workspace_id == workspace.id).order_by(TimeEntry.created_at.desc())
    result = await db.execute(stmt)
    entries = result.scalars().all()

    proj_ids = [e.project_id for e in entries]
    projects_map = {}
    if proj_ids:
        p_res = await db.execute(select(Project).where(Project.id.in_(proj_ids)))
        projects_map = {p.id: p.title for p in p_res.scalars().all()}

    out = []
    for e in entries:
        out.append({
            "id": e.id,
            "workspace_id": e.workspace_id,
            "project_id": e.project_id,
            "project_title": projects_map.get(e.project_id, "Project"),
            "task_id": e.task_id,
            "description": e.description,
            "start_time": e.start_time,
            "end_time": e.end_time,
            "duration_seconds": e.duration_seconds,
            "hourly_rate": e.hourly_rate,
            "is_billable": e.is_billable,
            "is_invoiced": e.is_invoiced,
            "created_at": e.created_at
        })
    return out

@router.post("", response_model=TimeEntryOut, status_code=status.HTTP_201_CREATED)
async def log_time_entry(
    payload: TimeEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    p_res = await db.execute(select(Project).where(Project.id == payload.project_id, Project.workspace_id == workspace.id))
    project = p_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    entry = TimeEntry(
        workspace_id=workspace.id,
        project_id=project.id,
        task_id=payload.task_id,
        description=payload.description,
        start_time=datetime.utcnow(),
        duration_seconds=payload.duration_seconds,
        hourly_rate=payload.hourly_rate or project.hourly_rate,
        is_billable=payload.is_billable
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return {
        "id": entry.id,
        "workspace_id": entry.workspace_id,
        "project_id": entry.project_id,
        "project_title": project.title,
        "task_id": entry.task_id,
        "description": entry.description,
        "start_time": entry.start_time,
        "end_time": entry.end_time,
        "duration_seconds": entry.duration_seconds,
        "hourly_rate": entry.hourly_rate,
        "is_billable": entry.is_billable,
        "is_invoiced": entry.is_invoiced,
        "created_at": entry.created_at
    }

@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_time_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(TimeEntry).where(TimeEntry.id == entry_id, TimeEntry.workspace_id == workspace.id)
    res = await db.execute(stmt)
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    await db.delete(entry)
    await db.commit()
