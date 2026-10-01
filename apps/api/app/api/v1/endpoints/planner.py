from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from typing import Any, Dict, List
from datetime import datetime, date, timedelta
import uuid

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.planner import PlannerBoard, PlannerTodo, PlannerSnapshot
from app.models.project import Project
from app.schemas.domain import (
    PlannerBoardCreate,
    PlannerBoardFullOut,
    PlannerBoardHeadOut,
    PlannerBoardRename,
    PlannerBoardSave,
    PlannerBoardSummary,
    PlannerRevisionOut,
    PlannerShareEnable,
    PlannerShareOut,
    PlannerSnapshotOut,
    PlannerSnapshotSummary,
    PlannerTodoCreate,
    PlannerTodoOut,
    PlannerTodoUpdate,
    PublicPlannerBoardOut,
)

router = APIRouter(prefix="/planner", tags=["Planner"])

# Ceiling on todos per board so a rogue client can't grow one row unboundedly;
# the scene itself is bounded by the size caps in PlannerBoardSave.
_MAX_TODOS = 500


async def _owned_board(db: AsyncSession, workspace_id: str, board_id: str) -> PlannerBoard:
    """Load a board ONLY when it belongs to this workspace, else 404.

    Filtering by workspace_id in the WHERE clause (not trusting the id alone)
    is the IDOR guard: another tenant's board id is a 404, never a read/write.
    """
    res = await db.execute(
        select(PlannerBoard).where(
            PlannerBoard.id == board_id,
            PlannerBoard.workspace_id == workspace_id,
        )
    )
    board = res.scalars().first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


async def _validate_project(db: AsyncSession, workspace_id: str, project_id: str) -> None:
    exists = (await db.execute(
        select(Project.id).where(Project.id == project_id, Project.workspace_id == workspace_id)
    )).scalars().first()
    if not exists:
        raise HTTPException(status_code=400, detail="Specified project does not exist in your workspace")


async def _bump(db: AsyncSession, board: PlannerBoard) -> None:
    """Any todo mutation moves the revision so every open tab/device re-pulls
    the (small) head payload — the same real-time mechanism the canvas uses."""
    board.revision = (board.revision or 0) + 1


async def _todo_counts(db: AsyncSession, board_id: str) -> Dict[str, int]:
    res = await db.execute(
        select(
            func.count(PlannerTodo.id),
            func.count(case((PlannerTodo.is_done == True, 1))),  # noqa: E712
        ).where(PlannerTodo.board_id == board_id)
    )
    total, done = res.one()
    return {"todos_count": int(total or 0), "done_count": int(done or 0)}


def _scene(board: PlannerBoard) -> Dict[str, Any]:
    # Legacy / raw-SQL rows can read NULL columns back; treat as empty scene.
    return {
        "id": board.id,
        "name": board.name,
        "revision": board.revision or 0,
        "elements": board.elements if isinstance(board.elements, list) else [],
        "files": board.files if isinstance(board.files, dict) else {},
    }


def _board_summary(board: PlannerBoard, total: int, done: int, stats: Dict[str, int]) -> Dict[str, Any]:
    return {
        "id": board.id,
        "name": board.name,
        "revision": board.revision or 0,
        "todos_count": total,
        "done_count": done,
        "overdue_count": stats.get("overdue", 0),
        "due_today_count": stats.get("due_today", 0),
        "planned_today_count": stats.get("planned", 0),
        "is_public": bool(board.is_public),
        "has_share": bool(board.share_token),
        "share_expires_at": board.expires_at,
        "created_at": board.created_at,
        "updated_at": board.updated_at,
    }


async def _today_stats(db: AsyncSession, workspace_id: str, today: date) -> Dict[str, Dict[str, int]]:
    """One pass over the workspace's todos to derive each board's overdue /
    due-today / planned-today counts (PL6). Never an N+1 across boards."""
    rows = (await db.execute(
        select(
            PlannerTodo.board_id,
            PlannerTodo.due_date,
            PlannerTodo.date,
            PlannerTodo.start_minute,
            PlannerTodo.is_done,
        ).where(PlannerTodo.workspace_id == workspace_id)
    )).all()

    stats: Dict[str, Dict[str, int]] = {}
    for board_id, due_date, day_date, start_minute, is_done in rows:
        s = stats.setdefault(board_id, {"overdue": 0, "due_today": 0, "planned": 0})
        if not is_done and due_date is not None:
            if due_date < today:
                s["overdue"] += 1
            elif due_date == today:
                s["due_today"] += 1
        if day_date == today and start_minute is not None:
            s["planned"] += 1
    return stats


# ------------------------------------------------------------------------------
# Boards ("files"): list, create, open, rename, delete
# ------------------------------------------------------------------------------
@router.get("/boards", response_model=List[PlannerBoardSummary])
async def list_boards(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Every board in this workspace, newest first — no scenes, just metadata
    plus the live Today counts and share state (PL6)."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    boards = (
        await db.execute(
            select(PlannerBoard)
            .where(PlannerBoard.workspace_id == workspace.id)
            .order_by(PlannerBoard.updated_at.desc())
        )
    ).scalars().all()

    today = datetime.utcnow().date()
    counts = (
        await db.execute(
            select(
                PlannerTodo.board_id,
                func.count(PlannerTodo.id),
                func.count(case((PlannerTodo.is_done == True, 1))),  # noqa: E712
            )
            .where(PlannerTodo.workspace_id == workspace.id)
            .group_by(PlannerTodo.board_id)
        )
    ).all()
    by_board = {b: (int(t or 0), int(d or 0)) for b, t, d in counts}
    stats = await _today_stats(db, workspace.id, today)

    return [
        _board_summary(board, *by_board.get(board.id, (0, 0)), stats.get(board.id, {}))
        for board in boards
    ]


@router.post("/boards", response_model=PlannerBoardSummary, status_code=status.HTTP_201_CREATED)
async def create_board(
    payload: PlannerBoardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Create an empty board; the client navigates straight into it."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = PlannerBoard(
        workspace_id=workspace.id, name=payload.name, revision=0, elements=[], files={}
    )
    db.add(board)
    await db.commit()
    await db.refresh(board)
    return _board_summary(board, 0, 0, {})


@router.get("/boards/{board_id}", response_model=PlannerBoardFullOut)
async def get_board(
    board_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Full board (scene + todos) — fetched once when the editor opens."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)
    todos = (
        await db.execute(
            select(PlannerTodo)
            .where(PlannerTodo.board_id == board.id)
            .order_by(PlannerTodo.created_at.asc())
        )
    ).scalars().all()
    return {**_scene(board), "todos": todos}


@router.get("/boards/{board_id}/head", response_model=PlannerBoardHeadOut)
async def get_board_head(
    board_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Cheap poll target: revision + todos only. A changed revision tells the
    tab to re-fetch the scene; unchanged polls never move scene bytes. `today`
    lets the day view compute overdue/due-today client-side without a clock."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)
    todos = (
        await db.execute(
            select(PlannerTodo)
            .where(PlannerTodo.board_id == board.id)
            .order_by(PlannerTodo.created_at.asc())
        )
    ).scalars().all()
    return {"revision": board.revision or 0, "todos": todos, "today": datetime.utcnow().date()}


@router.put("/boards/{board_id}", response_model=PlannerRevisionOut)
async def save_board(
    board_id: str,
    payload: PlannerBoardSave,
    rev: int = Query(..., ge=0, description="Client's last known board revision"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Persist the scene and bump the revision so other tabs/devices sync.

    `rev` is the client's base revision. A mismatch means another session wrote
    first: the whole-scene write would silently clobber theirs, so it's rejected
    (409) and the client must pull the head scene before saving again.
    """
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)

    if rev != (board.revision or 0):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Board changed elsewhere. Pull the latest revision and retry.",
                "revision": board.revision or 0,
            },
        )

    board.elements = payload.elements
    board.files = payload.files
    board.revision = (board.revision or 0) + 1

    # PL4 daily snapshot: capture the day's plan at most once per board, so a
    # past day stays reviewable. Insert-only (never overwrite) keeps it cheap.
    captured_on = datetime.utcnow().date().isoformat()
    existing = (await db.execute(
        select(PlannerSnapshot).where(
            PlannerSnapshot.board_id == board.id,
            PlannerSnapshot.captured_on == captured_on,
        )
    )).scalars().first()
    if not existing:
        db.add(PlannerSnapshot(
            board_id=board.id,
            workspace_id=workspace.id,
            captured_on=captured_on,
            revision=board.revision,
            elements=board.elements,
            files=board.files,
        ))

    await db.commit()
    await db.refresh(board)
    return {"revision": board.revision}


@router.patch("/boards/{board_id}", response_model=PlannerBoardSummary)
async def rename_board(
    board_id: str,
    payload: PlannerBoardRename,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """PL6 inline rename target — no popup, just a PATCH from the row's field."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)
    board.name = payload.name
    await db.commit()
    await db.refresh(board)
    today = datetime.utcnow().date()
    stats = await _today_stats(db, workspace.id, today)
    counts = await _todo_counts(db, board.id)
    return _board_summary(board, counts["todos_count"], counts["done_count"], stats.get(board.id, {}))


@router.delete("/boards/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_board(
    board_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Deleting a board cascades its todos (FK ondelete=CASCADE + relationship)."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)
    await db.delete(board)
    await db.commit()


# ------------------------------------------------------------------------------
# PL5 — read-only share link (enable / disable / rotate + anonymous view)
# ------------------------------------------------------------------------------
def _share_out(board: PlannerBoard) -> Dict[str, Any]:
    return {
        "is_public": bool(board.is_public),
        "share_token": board.share_token if board.is_public else None,
        "share_url": f"/planner/share/{board.share_token}" if (board.is_public and board.share_token) else None,
        "expires_at": board.expires_at,
    }


@router.post("/boards/{board_id}/share", response_model=PlannerShareOut)
async def enable_share(
    board_id: str,
    payload: PlannerShareEnable,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)
    if not board.share_token:
        board.share_token = uuid.uuid4().hex
    board.is_public = True
    board.expires_at = payload.expires_at
    await db.commit()
    await db.refresh(board)
    return _share_out(board)


@router.post("/boards/{board_id}/rotate-share-token", response_model=PlannerShareOut)
async def rotate_share_token(
    board_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """SE10: revoke a possibly-leaked link by minting a fresh token; the old URL
    stops resolving immediately (the anonymous view keys on the token)."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)
    board.share_token = uuid.uuid4().hex
    await db.commit()
    await db.refresh(board)
    return _share_out(board)


@router.delete("/boards/{board_id}/share", response_model=PlannerShareOut)
async def disable_share(
    board_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)
    board.is_public = False
    await db.commit()
    await db.refresh(board)
    return _share_out(board)


@router.get("/public/{share_token}", response_model=PublicPlannerBoardOut)
async def view_shared_board(share_token: str, db: AsyncSession = Depends(get_db)):
    """Anonymous, read-only board view (PL5): scene + OPEN todos only. No edit
    route is exposed here, and an un-shared/expired token is a 404."""
    board = (await db.execute(
        select(PlannerBoard).where(PlannerBoard.share_token == share_token)
    )).scalars().first()
    if not board or not board.is_public:
        raise HTTPException(status_code=404, detail="Shared board not found")
    if board.expires_at and board.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="This shared link has expired")

    todos = (await db.execute(
        select(PlannerTodo)
        .where(PlannerTodo.board_id == board.id, PlannerTodo.is_done == False)  # noqa: E712
        .order_by(PlannerTodo.created_at.asc())
    )).scalars().all()
    return {
        "name": board.name,
        "elements": board.elements if isinstance(board.elements, list) else [],
        "todos": todos,
    }


# ------------------------------------------------------------------------------
# PL4 — daily snapshots + time travel
# ------------------------------------------------------------------------------
@router.get("/boards/{board_id}/snapshots", response_model=List[PlannerSnapshotSummary])
async def list_snapshots(
    board_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)
    rows = (await db.execute(
        select(PlannerSnapshot)
        .where(PlannerSnapshot.board_id == board.id)
        .order_by(PlannerSnapshot.captured_on.desc())
    )).scalars().all()
    return [{"captured_on": r.captured_on, "revision": r.revision, "created_at": r.created_at} for r in rows]


@router.get("/boards/{board_id}/snapshots/{captured_on}", response_model=PlannerSnapshotOut)
async def get_snapshot(
    board_id: str,
    captured_on: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)
    snap = (await db.execute(
        select(PlannerSnapshot).where(
            PlannerSnapshot.board_id == board.id,
            PlannerSnapshot.captured_on == captured_on,
        )
    )).scalars().first()
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return {
        "captured_on": snap.captured_on,
        "revision": snap.revision,
        "elements": snap.elements if isinstance(snap.elements, list) else [],
        "files": snap.files if isinstance(snap.files, dict) else {},
    }


@router.post("/boards/{board_id}/snapshots/{captured_on}/restore", response_model=PlannerRevisionOut)
async def restore_snapshot(
    board_id: str,
    captured_on: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Replay a captured day into the live board (bumps revision so every tab
    pulls the restored scene)."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)
    snap = (await db.execute(
        select(PlannerSnapshot).where(
            PlannerSnapshot.board_id == board.id,
            PlannerSnapshot.captured_on == captured_on,
        )
    )).scalars().first()
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    board.elements = snap.elements if isinstance(snap.elements, list) else []
    board.files = snap.files if isinstance(snap.files, dict) else {}
    board.revision = (board.revision or 0) + 1
    await db.commit()
    await db.refresh(board)
    return {"revision": board.revision}


# ------------------------------------------------------------------------------
# Todos (scoped to a board; every mutation re-checks workspace ownership)
# ------------------------------------------------------------------------------
@router.post("/boards/{board_id}/todos", response_model=PlannerTodoOut, status_code=status.HTTP_201_CREATED)
async def create_todo(
    board_id: str,
    payload: PlannerTodoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)

    total = (
        await db.execute(
            select(func.count(PlannerTodo.id)).where(PlannerTodo.board_id == board.id)
        )
    ).scalar_one()
    if total >= _MAX_TODOS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Todo limit reached ({_MAX_TODOS}). Clear the board first.",
        )

    if payload.project_id:
        await _validate_project(db, workspace.id, payload.project_id)

    todo = PlannerTodo(
        board_id=board.id,
        workspace_id=workspace.id,
        text=payload.text,
        is_done=False,
        due_date=payload.due_date,
        priority=payload.priority,
        project_id=payload.project_id,
        recurrence=payload.recurrence,
        date=payload.date,
        start_minute=payload.start_minute,
        duration_minutes=payload.duration_minutes,
    )
    db.add(todo)
    await _bump(db, board)
    await db.commit()
    await db.refresh(todo)
    return todo


async def _owned_todo(db: AsyncSession, workspace_id: str, todo_id: str) -> PlannerTodo:
    res = await db.execute(
        select(PlannerTodo).where(
            PlannerTodo.id == todo_id,
            PlannerTodo.workspace_id == workspace_id,
        )
    )
    todo = res.scalars().first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo


@router.patch("/todos/{todo_id}", response_model=PlannerTodoOut)
async def update_todo(
    todo_id: str,
    payload: PlannerTodoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Tick/untick/rename or (re)plan — workspace-scoped, so another tenant's id
    is a 404. Completing a recurring todo generates the next occurrence (PL3)."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    todo = await _owned_todo(db, workspace.id, todo_id)

    was_done = todo.is_done
    fields = payload.model_dump(exclude_unset=True)
    if "project_id" in fields and fields["project_id"]:
        await _validate_project(db, workspace.id, fields["project_id"])
    for key, value in fields.items():
        setattr(todo, key, value)

    board = await _owned_board(db, workspace.id, todo.board_id)

    # PL3: the first tick of a recurring todo rolls forward a fresh instance.
    created_next = payload.is_done is True and not was_done and todo.recurrence in ("daily", "weekly")
    if created_next:
        step = timedelta(days=1) if todo.recurrence == "daily" else timedelta(days=7)
        db.add(PlannerTodo(
            board_id=todo.board_id,
            workspace_id=workspace.id,
            text=todo.text,
            is_done=False,
            due_date=(todo.due_date + step) if todo.due_date else None,
            priority=todo.priority,
            project_id=todo.project_id,
            recurrence=todo.recurrence,
            date=(todo.date + step) if todo.date else None,
            start_minute=todo.start_minute,
            duration_minutes=todo.duration_minutes,
        ))

    await _bump(db, board)
    await db.commit()
    await db.refresh(todo)
    return todo


@router.delete("/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_todo(
    todo_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    todo = await _owned_todo(db, workspace.id, todo_id)
    board = await _owned_board(db, workspace.id, todo.board_id)
    await db.delete(todo)
    await _bump(db, board)
    await db.commit()
