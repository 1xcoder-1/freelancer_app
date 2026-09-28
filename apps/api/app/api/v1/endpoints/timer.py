"""Live time-tracking sessions — the stopwatch lives on the server.

The browser used to count seconds in its own state, so a refresh, a crashed tab
or a phone swap silently zeroed the run, and the dashboard's "focus" widget was
hardcoded fake data. Here the run is a DB row and its length is derived from the
server clock (`started_at` / `paused_at` / `accumulated_seconds`), so tracking
is real-time and resumable from any device. Stopping writes exactly one
TimeEntry, which is what invoices and reports already read.
"""

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.finance import TimeEntry, TimerSession
from app.models.project import Project
from app.models.workspace import Workspace
from app.schemas.domain import TimeEntryOut, TimerSessionOut, TimerStartRequest

router = APIRouter(prefix="/timer", tags=["Live Time Tracking"])


def _elapsed_seconds(session: TimerSession, now: datetime) -> int:
    """Server-clock truth. The run's length is whatever the server's clock says,
    never what a client remembers; clamped at 0 so a skewed/future started_at
    can't produce a negative duration."""
    floor = session.paused_at or session.started_at
    running = max(0, int((now - floor).total_seconds()))
    return max(0, session.accumulated_seconds + running)


def _payload(session: TimerSession, project_title: Optional[str], now: datetime) -> dict:
    return TimerSessionOut(
        id=session.id,
        workspace_id=session.workspace_id,
        project_id=session.project_id,
        project_title=project_title,
        description=session.description,
        is_billable=session.is_billable,
        is_running=session.is_running,
        started_at=session.started_at,
        paused_at=session.paused_at,
        accumulated_seconds=session.accumulated_seconds,
        elapsed_seconds=_elapsed_seconds(session, now),
        ended_at=session.ended_at,
    )


async def _active_session(db: AsyncSession, workspace_id: str) -> Optional[TimerSession]:
    res = await db.execute(
        select(TimerSession)
        .where(TimerSession.workspace_id == workspace_id, TimerSession.ended_at.is_(None))
        .order_by(TimerSession.created_at.desc())
        .limit(1)
    )
    return res.scalars().first()


async def _project_title(db: AsyncSession, project_id: str) -> Optional[str]:
    res = await db.execute(select(Project.title).where(Project.id == project_id))
    return res.scalars().first()


@router.get("/active", response_model=Optional[TimerSessionOut])
async def get_active_session(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """The un-finished run for this workspace (running or paused), or null.
    Polled by the time-tracker page and the dashboard focus widget."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    session = await _active_session(db, workspace.id)
    if not session:
        return None
    title = await _project_title(db, session.project_id)
    return _payload(session, title, datetime.utcnow())


@router.post("/start", response_model=TimerSessionOut, status_code=status.HTTP_201_CREATED)
async def start_session(
    payload: TimerStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Start tracking. The previous open run is flushed to a TimeEntry first,
    so switching projects never loses logged time."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    p_res = await db.execute(
        select(Project).where(Project.id == payload.project_id, Project.workspace_id == workspace.id)
    )
    project = p_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    now = datetime.utcnow()
    open_session = await _active_session(db, workspace.id)
    if open_session:
        await _flush_entry(db, open_session, now)
        open_session.ended_at = now
        open_session.is_running = False

    session = TimerSession(
        workspace_id=workspace.id,
        project_id=project.id,
        description=payload.description,
        is_billable=payload.is_billable,
        is_running=True,
        started_at=now,
        accumulated_seconds=0,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return _payload(session, project.title, datetime.utcnow())


@router.post("/{session_id}/pause", response_model=TimerSessionOut)
async def pause_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Freeze the clock: elapsed so far is banked into `accumulated_seconds`."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    session = await _load_open_session(db, session_id, workspace.id)
    now = datetime.utcnow()

    if session.is_running:
        session.accumulated_seconds = _elapsed_seconds(session, now)
        session.paused_at = now
        session.is_running = False
        await db.commit()
        await db.refresh(session)
    title = await _project_title(db, session.project_id)
    return _payload(session, title, now)


@router.post("/{session_id}/resume", response_model=TimerSessionOut)
async def resume_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Restart the clock from the banked seconds — nothing is re-counted."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    session = await _load_open_session(db, session_id, workspace.id)
    now = datetime.utcnow()

    if not session.is_running:
        session.paused_at = None
        session.is_running = True
        await db.commit()
        await db.refresh(session)
    title = await _project_title(db, session.project_id)
    return _payload(session, title, now)


@router.post("/{session_id}/stop", response_model=Optional[TimeEntryOut])
async def stop_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Close the run and write the TimeEntry the rest of the app bills from.
    Returns null when less than a second was tracked (nothing to bill)."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    session = await _load_open_session(db, session_id, workspace.id)
    now = datetime.utcnow()

    if session.ended_at is not None:
        raise HTTPException(status_code=400, detail="Timer session already stopped")

    entry = await _flush_entry(db, session, now)
    session.ended_at = now
    session.is_running = False
    session.paused_at = None
    await db.commit()

    if entry is None:
        return None
    await db.refresh(entry)

    title = await _project_title(db, entry.project_id)
    return {
        "id": entry.id,
        "workspace_id": entry.workspace_id,
        "project_id": entry.project_id,
        "project_title": title,
        "task_id": entry.task_id,
        "description": entry.description,
        "start_time": entry.start_time,
        "end_time": entry.end_time,
        "duration_seconds": entry.duration_seconds,
        "hourly_rate": entry.hourly_rate,
        "is_billable": entry.is_billable,
        "is_invoiced": entry.is_invoiced,
        "created_at": entry.created_at,
    }


async def _load_open_session(db: AsyncSession, session_id: str, workspace_id: str) -> TimerSession:
    res = await db.execute(
        select(TimerSession).where(
            TimerSession.id == session_id, TimerSession.workspace_id == workspace_id
        )
    )
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Timer session not found")
    return session


async def _flush_entry(db: AsyncSession, session: TimerSession, now: datetime) -> Optional[TimeEntry]:
    """Bank a live run into a real TimeEntry. A run with nothing measurable
    (under a second) returns None instead of writing a noise row, so tracked
    hours, the entry list and the billing totals stay honest."""
    elapsed = _elapsed_seconds(session, now)
    session.accumulated_seconds = elapsed
    if elapsed < 1:
        return None

    p_res = await db.execute(select(Project).where(Project.id == session.project_id))
    project = p_res.scalar_one_or_none()
    rate = float(project.hourly_rate or 0.0) if project else 0.0
    if rate == 0.0:
        # No per-project rate set — fall back to the workspace default rate so
        # the Settings page's rate is the one that actually bills.
        w_res = await db.execute(select(Workspace).where(Workspace.id == session.workspace_id))
        ws = w_res.scalar_one_or_none()
        rate = float(ws.default_hourly_rate or 0.0) if ws else 0.0

    entry = TimeEntry(
        workspace_id=session.workspace_id,
        project_id=session.project_id,
        description=session.description,
        start_time=session.started_at,
        end_time=now,
        duration_seconds=elapsed,
        hourly_rate=rate,
        is_billable=session.is_billable,
    )
    db.add(entry)
    await db.flush()
    return entry
