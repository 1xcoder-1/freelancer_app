from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from typing import Any, Dict, List

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.planner import PlannerBoard, PlannerTodo
from app.schemas.domain import (
    PlannerBoardCreate,
    PlannerBoardFullOut,
    PlannerBoardHeadOut,
    PlannerBoardRename,
    PlannerBoardSave,
    PlannerBoardSummary,
    PlannerRevisionOut,
    PlannerTodoCreate,
    PlannerTodoOut,
    PlannerTodoUpdate,
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


# ------------------------------------------------------------------------------
# Boards ("files"): list, create, open, rename, delete
# ------------------------------------------------------------------------------
@router.get("/boards", response_model=List[PlannerBoardSummary])
async def list_boards(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Every board in this workspace, newest first — no scenes, just metadata."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    boards = (
        await db.execute(
            select(PlannerBoard)
            .where(PlannerBoard.workspace_id == workspace.id)
            .order_by(PlannerBoard.updated_at.desc())
        )
    ).scalars().all()

    # One grouped query for all todo counts avoids an N+1 across boards.
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

    out: List[Dict[str, Any]] = []
    for board in boards:
        total, done = by_board.get(board.id, (0, 0))
        out.append({
            "id": board.id,
            "name": board.name,
            "revision": board.revision or 0,
            "todos_count": total,
            "done_count": done,
            "created_at": board.created_at,
            "updated_at": board.updated_at,
        })
    return out


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
    return {
        "id": board.id,
        "name": board.name,
        "revision": board.revision,
        "todos_count": 0,
        "done_count": 0,
        "created_at": board.created_at,
        "updated_at": board.updated_at,
    }


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
    tab to re-fetch the scene; unchanged polls never move scene bytes."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)
    todos = (
        await db.execute(
            select(PlannerTodo)
            .where(PlannerTodo.board_id == board.id)
            .order_by(PlannerTodo.created_at.asc())
        )
    ).scalars().all()
    return {"revision": board.revision or 0, "todos": todos}


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
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)
    board.name = payload.name
    await db.commit()
    await db.refresh(board)
    return {
        "id": board.id,
        "name": board.name,
        "revision": board.revision or 0,
        **await _todo_counts(db, board.id),
        "created_at": board.created_at,
        "updated_at": board.updated_at,
    }


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

    todo = PlannerTodo(board_id=board.id, workspace_id=workspace.id, text=payload.text, is_done=False)
    db.add(todo)
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
    """Tick/untick or rename — workspace-scoped, so another tenant's id is a 404."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    todo = await _owned_todo(db, workspace.id, todo_id)
    if payload.text is not None:
        todo.text = payload.text
    if payload.is_done is not None:
        todo.is_done = payload.is_done
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
    await db.delete(todo)
    await db.commit()
