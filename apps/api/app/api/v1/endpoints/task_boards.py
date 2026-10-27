import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db, AsyncSessionLocal
from app.core.workspace import get_or_create_user_workspace
from app.models.project import Project
from app.models.task_management import TaskAttachment, TaskBoard, TaskCard, TaskList, TaskSubtask
from app.schemas.domain import (
    DEFAULT_TASK_BOARD_NAME,
    ProjectTaskCardOut,
    TaskAttachmentCreate,
    TaskAttachmentFileOut,
    TaskAttachmentOut,
    TaskBoardCreate,
    TaskBoardFullOut,
    TaskBoardHeadOut,
    TaskBoardPatch,
    TaskBoardSummary,
    TaskCardCreate,
    TaskCardOut,
    TaskCardPatch,
    TaskListCreate,
    TaskListOut,
    TaskListPatch,
    TaskSubtaskCreate,
    TaskSubtaskOut,
    TaskSubtaskPatch,
)
from app.services.storage_service import storage_service

router = APIRouter(prefix="/tasks", tags=["Task Management"])

# The three lists every new board is seeded with (positions 1, 2, 3).
_DEFAULT_LISTS = ("Pending", "In Progress", "Done")

# The seeded starter board ships with NO background (background_url/kind stay
# NULL → the client renders its clean default surface); users pick a gradient
# or Unsplash image from the board's Background picker.

# When the gap between a card's neighbours is below this the midpoint is no
# longer distinguishable and the destination list is renormalised to 1..n.
_RENORMALIZE_GAP = 0.0001

# Ceiling on subtasks/attachments per card so a rogue client can't grow one
# row unboundedly (same guard the planner applies to todos per board).
_MAX_SUBTASKS = 200
_MAX_ATTACHMENTS = 100


# ------------------------------------------------------------------------------
# Ownership guards (IDOR: filter by workspace_id in the WHERE, never trust ids)
# ------------------------------------------------------------------------------
async def _owned_board(db: AsyncSession, workspace_id: str, board_id: str) -> TaskBoard:
    res = await db.execute(
        select(TaskBoard).where(
            TaskBoard.id == board_id,
            TaskBoard.workspace_id == workspace_id,
        )
    )
    board = res.scalars().first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


async def _owned_list(db: AsyncSession, workspace_id: str, list_id: str) -> TaskList:
    res = await db.execute(
        select(TaskList).where(
            TaskList.id == list_id,
            TaskList.workspace_id == workspace_id,
        )
    )
    lst = res.scalars().first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    return lst


async def _owned_card(db: AsyncSession, workspace_id: str, card_id: str) -> TaskCard:
    res = await db.execute(
        select(TaskCard).where(
            TaskCard.id == card_id,
            TaskCard.workspace_id == workspace_id,
        )
    )
    card = res.scalars().first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


async def _owned_subtask(db: AsyncSession, workspace_id: str, subtask_id: str) -> TaskSubtask:
    res = await db.execute(
        select(TaskSubtask).where(
            TaskSubtask.id == subtask_id,
            TaskSubtask.workspace_id == workspace_id,
        )
    )
    subtask = res.scalars().first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
    return subtask


async def _owned_attachment(db: AsyncSession, workspace_id: str, attachment_id: str) -> TaskAttachment:
    res = await db.execute(
        select(TaskAttachment).where(
            TaskAttachment.id == attachment_id,
            TaskAttachment.workspace_id == workspace_id,
        )
    )
    attachment = res.scalars().first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return attachment


async def _validate_project(db: AsyncSession, workspace_id: str, project_id: str) -> None:
    exists = (await db.execute(
        select(Project.id).where(Project.id == project_id, Project.workspace_id == workspace_id)
    )).scalars().first()
    if not exists:
        raise HTTPException(status_code=400, detail="Specified project does not exist in your workspace")


def _bump(board: TaskBoard) -> None:
    """Every nested mutation moves the revision in the SAME transaction so
    every open tab/device knows to re-pull the full board payload (same
    real-time mechanism the planner canvas uses)."""
    board.revision = (board.revision or 0) + 1
    board.updated_at = datetime.utcnow()


# ------------------------------------------------------------------------------
# Serializers
# ------------------------------------------------------------------------------
def _subtask_out(s: TaskSubtask) -> Dict[str, Any]:
    return {
        "id": s.id,
        "card_id": s.card_id,
        "text": s.text,
        "is_done": bool(s.is_done),
        "position": s.position,
        "created_at": s.created_at,
    }


def _attachment_out(a: TaskAttachment) -> Dict[str, Any]:
    return {
        "id": a.id,
        "card_id": a.card_id,
        "kind": a.kind,
        "url": a.url,
        "file_key": a.file_key,
        "file_name": a.file_name,
        "content_type": a.content_type,
        "size_bytes": a.size_bytes,
        "created_at": a.created_at,
    }


def _card_out(card: TaskCard, subtasks=None, attachments=None) -> Dict[str, Any]:
    return {
        "id": card.id,
        "list_id": card.list_id,
        "board_id": card.board_id,
        "workspace_id": card.workspace_id,
        "title": card.title,
        "description": card.description or "",
        "completed": bool(card.completed),
        "priority": card.priority,
        "due_date": card.due_date,
        "position": float(card.position or 0.0),
        "project_id": card.project_id,
        # Legacy/raw rows can read NULL back from a JSONB column; treat as [].
        "tags": card.tags if isinstance(card.tags, list) else [],
        "subtasks": [_subtask_out(s) for s in (subtasks or [])],
        "attachments": [_attachment_out(a) for a in (attachments or [])],
        "created_at": card.created_at,
        "updated_at": card.updated_at,
    }


def _list_out(lst: TaskList, cards=None) -> Dict[str, Any]:
    return {
        "id": lst.id,
        "board_id": lst.board_id,
        "name": lst.name,
        "position": float(lst.position or 0.0),
        "created_at": lst.created_at,
        "cards": [_card_out(c) for c in (cards or [])],
    }


def _board_summary(board: TaskBoard, list_count: int = 0, card_count: int = 0, done_count: int = 0) -> Dict[str, Any]:
    return {
        "id": board.id,
        "workspace_id": board.workspace_id,
        "name": board.name,
        "background_url": board.background_url,
        "background_kind": board.background_kind,
        "revision": board.revision or 0,
        "list_count": list_count,
        "card_count": card_count,
        "done_count": done_count,
        "created_at": board.created_at,
        "updated_at": board.updated_at,
    }


def _board_full(board: TaskBoard, lists: List[TaskList], cards: List[TaskCard],
                subtasks: List[TaskSubtask], attachments: List[TaskAttachment]) -> Dict[str, Any]:
    """Assemble the nested /full payload in Python from flat row lists."""
    subtasks_by_card: Dict[str, List[TaskSubtask]] = {}
    for s in subtasks:
        subtasks_by_card.setdefault(s.card_id, []).append(s)
    attachments_by_card: Dict[str, List[TaskAttachment]] = {}
    for a in attachments:
        attachments_by_card.setdefault(a.card_id, []).append(a)
    cards_by_list: Dict[str, List[TaskCard]] = {}
    for c in cards:
        cards_by_list.setdefault(c.list_id, []).append(c)

    return {
        "id": board.id,
        "workspace_id": board.workspace_id,
        "name": board.name,
        "background_url": board.background_url,
        "background_kind": board.background_kind,
        "revision": board.revision or 0,
        "created_at": board.created_at,
        "updated_at": board.updated_at,
        "lists": [
            {
                "id": lst.id,
                "board_id": lst.board_id,
                "name": lst.name,
                "position": float(lst.position or 0.0),
                "created_at": lst.created_at,
                "cards": [
                    _card_out(
                        card,
                        sorted(subtasks_by_card.get(card.id, []), key=lambda s: (s.position, s.created_at)),
                        sorted(attachments_by_card.get(card.id, []), key=lambda a: a.created_at),
                    )
                    for card in sorted(cards_by_list.get(lst.id, []), key=lambda c: (c.position, c.created_at))
                ],
            }
            for lst in sorted(lists, key=lambda l: (l.position, l.created_at))
        ],
    }


# ------------------------------------------------------------------------------
# Boards
# ------------------------------------------------------------------------------
async def _ensure_default_board(db: AsyncSession, workspace_id: str) -> None:
    """Create the starter board ("My Tasks", no background,
    + "Pending"/"In Progress"/"Done") for a workspace with ZERO
    boards — the same "ensure on read" precedent as get_or_create_user_workspace,
    so a brand-new user opens Planner → Task Management on a ready board
    without clicking create.

    Race-safe: pg_advisory_xact_lock keyed on the workspace UUID serialises
    concurrent first GETs (the second request blocks until the first commits),
    and the zero-count is RE-CHECKED after acquiring the lock, so the loser of
    the race sees the winner's committed board and inserts nothing. Lock +
    re-check + insert share ONE transaction; the lock itself is released by the
    commit. Postgres-only (Neon): SQLite dev databases skip the lock
    (single-process dev, and the function doesn't exist)."""
    if db.get_bind().dialect.name == "postgresql":
        await db.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:workspace_id, 0))"),
            {"workspace_id": workspace_id},
        )
    existing = (await db.execute(
        select(func.count(TaskBoard.id)).where(TaskBoard.workspace_id == workspace_id)
    )).scalar_one()
    if existing:
        return  # a concurrent request seeded it while we waited on the lock
    board = TaskBoard(
        workspace_id=workspace_id,
        name=DEFAULT_TASK_BOARD_NAME,
        revision=0,
    )
    db.add(board)
    await db.flush()  # assign board.id before the lists FK onto it
    for position, name in enumerate(_DEFAULT_LISTS, start=1):
        db.add(TaskList(
            board_id=board.id,
            workspace_id=workspace_id,
            name=name,
            position=float(position),
        ))
    await db.commit()


@router.get("/boards", response_model=List[TaskBoardSummary])
async def list_boards(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Every kanban board in this workspace, newest activity first, with its
    list/card/done rollup computed in ONE SQL statement (three correlated
    scalar subqueries — no N+1 across boards).

    Before listing, a workspace with ZERO boards is lazily seeded with the
    default "My Tasks" board (see _ensure_default_board), so the freshly
    created board comes back in this same response — with counts — and the
    response shape never changes."""
    _, workspace = await get_or_create_user_workspace(db, current_user)

    board_count = (await db.execute(
        select(func.count(TaskBoard.id)).where(TaskBoard.workspace_id == workspace.id)
    )).scalar_one()
    if not board_count:
        await _ensure_default_board(db, workspace.id)

    list_count_sq = (
        select(func.count(TaskList.id))
        .where(TaskList.board_id == TaskBoard.id)
        .correlate(TaskBoard)
        .scalar_subquery()
    )
    card_count_sq = (
        select(func.count(TaskCard.id))
        .where(TaskCard.board_id == TaskBoard.id)
        .correlate(TaskBoard)
        .scalar_subquery()
    )
    done_count_sq = (
        select(func.count(TaskCard.id))
        .where(TaskCard.board_id == TaskBoard.id, TaskCard.completed == True)  # noqa: E712
        .correlate(TaskBoard)
        .scalar_subquery()
    )
    rows = (await db.execute(
        select(TaskBoard, list_count_sq, card_count_sq, done_count_sq)
        .where(TaskBoard.workspace_id == workspace.id)
        .order_by(TaskBoard.updated_at.desc())
    )).all()

    return [
        _board_summary(board, int(lists or 0), int(cards or 0), int(done or 0))
        for board, lists, cards, done in rows
    ]


@router.post("/boards", response_model=TaskBoardFullOut, status_code=status.HTTP_201_CREATED)
async def create_board(
    payload: TaskBoardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Create a board AND its three default lists ("Pending", "In Progress",
    "Done") in one transaction; the client navigates straight into the full
    board payload."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = TaskBoard(
        workspace_id=workspace.id,
        name=payload.name,
        background_url=payload.background_url,
        background_kind=payload.background_kind,
        revision=0,
    )
    db.add(board)
    await db.flush()  # assign board.id before the lists FK onto it
    for position, name in enumerate(_DEFAULT_LISTS, start=1):
        db.add(TaskList(
            board_id=board.id,
            workspace_id=workspace.id,
            name=name,
            position=float(position),
        ))
    await db.commit()
    await db.refresh(board)

    return _board_full(board, [], [], [], [])


@router.get("/boards/{board_id}/full", response_model=TaskBoardFullOut)
async def get_board_full(
    board_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Full board: board + lists + cards + subtasks + attachments — the payload
    the board UI opens with.

    Neon sits ~300 ms away per round trip, so the five INDEPENDENT selects run
    CONCURRENTLY (asyncio.gather, each on its own short-lived session — a
    single AsyncSession cannot execute queries in parallel, the same pattern
    the dashboard uses). Wall-clock ≈ one roundtrip instead of five. Every
    query carries the workspace_id guard, so probing another tenant's board id
    yields a 404 and no rows. Subtasks/attachments have no board_id column;
    they reach their board through a join on task_cards instead."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    workspace_id = workspace.id

    async def _fetch_all(stmt: Any) -> List[Any]:
        async with AsyncSessionLocal() as s:
            return (await s.execute(stmt)).scalars().all()

    board_rows, lists, cards, subtasks, attachments = await asyncio.gather(
        _fetch_all(
            select(TaskBoard).where(
                TaskBoard.id == board_id, TaskBoard.workspace_id == workspace_id,
            )
        ),
        _fetch_all(
            select(TaskList).where(
                TaskList.board_id == board_id, TaskList.workspace_id == workspace_id,
            ).order_by(TaskList.position.asc(), TaskList.created_at.asc())
        ),
        _fetch_all(
            select(TaskCard).where(
                TaskCard.board_id == board_id, TaskCard.workspace_id == workspace_id,
            ).order_by(TaskCard.position.asc(), TaskCard.created_at.asc())
        ),
        _fetch_all(
            select(TaskSubtask)
            .join(TaskCard, TaskSubtask.card_id == TaskCard.id)
            .where(TaskCard.board_id == board_id, TaskCard.workspace_id == workspace_id)
        ),
        _fetch_all(
            select(TaskAttachment)
            .join(TaskCard, TaskAttachment.card_id == TaskCard.id)
            .where(TaskCard.board_id == board_id, TaskCard.workspace_id == workspace_id)
        ),
    )

    board = board_rows[0] if board_rows else None
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    return _board_full(board, lists, cards, subtasks, attachments)


@router.get("/boards/{board_id}/head", response_model=TaskBoardHeadOut)
async def get_board_head(
    board_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Cheap poll target: {revision} only. A changed revision tells the tab to
    re-fetch /full; unchanged polls never move board bytes."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)
    return {"revision": board.revision or 0}


@router.patch("/boards/{board_id}", response_model=TaskBoardSummary)
async def update_board(
    board_id: str,
    payload: TaskBoardPatch,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Rename a board and/or change its background (send null to clear the
    background fields). Bumps the revision so open tabs re-pull the payload."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)

    fields = payload.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(board, key, value)
    _bump(board)
    await db.commit()
    await db.refresh(board)

    counts = (await db.execute(
        select(
            select(func.count(TaskList.id)).where(TaskList.board_id == board.id).scalar_subquery(),
            select(func.count(TaskCard.id)).where(TaskCard.board_id == board.id).scalar_subquery(),
            select(func.count(TaskCard.id)).where(
                TaskCard.board_id == board.id, TaskCard.completed == True  # noqa: E712
            ).scalar_subquery(),
        )
    )).one()
    return _board_summary(board, int(counts[0] or 0), int(counts[1] or 0), int(counts[2] or 0))


@router.delete("/boards/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_board(
    board_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Deleting a board cascades its lists, cards, subtasks and attachments
    (FK ondelete=CASCADE + relationships, so SQLite dev cascades too)."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)
    await db.delete(board)
    await db.commit()


# ------------------------------------------------------------------------------
# Lists
# ------------------------------------------------------------------------------
@router.post("/boards/{board_id}/lists", response_model=TaskListOut, status_code=status.HTTP_201_CREATED)
async def create_list(
    board_id: str,
    payload: TaskListCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Add a column to the board; it lands at the end (max position + 1)."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    board = await _owned_board(db, workspace.id, board_id)

    max_pos = (await db.execute(
        select(func.coalesce(func.max(TaskList.position), 0.0)).where(TaskList.board_id == board.id)
    )).scalar_one()

    lst = TaskList(
        board_id=board.id,
        workspace_id=workspace.id,
        name=payload.name,
        position=float(max_pos) + 1.0,
    )
    db.add(lst)
    _bump(board)
    await db.commit()
    await db.refresh(lst)
    return _list_out(lst, [])


async def _bump_list_board(db: AsyncSession, workspace_id: str, lst: TaskList) -> TaskBoard:
    """Load + own the parent board of a list and bump its revision."""
    board = await _owned_board(db, workspace_id, lst.board_id)
    _bump(board)
    return board


@router.patch("/lists/{list_id}", response_model=TaskListOut)
async def update_list(
    list_id: str,
    payload: TaskListPatch,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Rename a list and/or move it to a new float position among its
    board's lists."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    lst = await _owned_list(db, workspace.id, list_id)

    fields = payload.model_dump(exclude_unset=True)
    # A null position is meaningless for a NOT NULL column — treat it as
    # "not provided" (only a real number re-orders the list).
    if fields.get("position") is None:
        fields.pop("position", None)
    for key, value in fields.items():
        setattr(lst, key, value)

    await _bump_list_board(db, workspace.id, lst)
    await db.commit()
    await db.refresh(lst)
    return _list_out(lst, [])


@router.delete("/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_list(
    list_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Delete a column and every card on it (cascade)."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    lst = await _owned_list(db, workspace.id, list_id)
    await _bump_list_board(db, workspace.id, lst)
    await db.delete(lst)
    await db.commit()


# ------------------------------------------------------------------------------
# Cards
# ------------------------------------------------------------------------------
async def _next_card_position(db: AsyncSession, list_id: str, exclude_card_id: Optional[str] = None) -> float:
    stmt = select(func.coalesce(func.max(TaskCard.position), 0.0)).where(TaskCard.list_id == list_id)
    if exclude_card_id:
        stmt = stmt.where(TaskCard.id != exclude_card_id)
    return float((await db.execute(stmt)).scalar_one()) + 1.0


@router.post("/lists/{list_id}/cards", response_model=TaskCardOut, status_code=status.HTTP_201_CREATED)
async def create_card(
    list_id: str,
    payload: TaskCardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Add a card at the end of a list. The project link is validated against
    the workspace (another tenant's project id is a 400, like the planner)."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    lst = await _owned_list(db, workspace.id, list_id)
    board = await _owned_board(db, workspace.id, lst.board_id)

    if payload.project_id:
        await _validate_project(db, workspace.id, payload.project_id)

    card = TaskCard(
        board_id=lst.board_id,
        list_id=lst.id,
        workspace_id=workspace.id,
        title=payload.title,
        description=payload.description or "",
        completed=False,
        priority=payload.priority,
        due_date=payload.due_date,
        position=await _next_card_position(db, lst.id),
        project_id=payload.project_id,
        tags=payload.tags or [],
    )
    db.add(card)
    _bump(board)
    await db.commit()
    await db.refresh(card)
    return _card_out(card)


def _renormalized_position(siblings: List[TaskCard], card_id: str, prev_id: Optional[str]) -> float:
    """The neighbour gap is too small to split: re-space the destination list
    to 1..n in the same transaction and return the moved card's new slot.
    `siblings` are the list's other cards in position order."""
    ids = [c.id for c in siblings]
    idx = ids.index(prev_id) + 1 if prev_id else 0
    for i, sibling in enumerate(siblings):
        sibling.position = float(i + 1)
    return float(idx + 1)


async def _compute_move_position(
    db: AsyncSession, workspace_id: str, target_list: TaskList,
    card: TaskCard, before_card_id: Optional[str], after_card_id: Optional[str],
) -> float:
    """Move contract (see TaskCardPatch): anchors are the neighbour cards at
    the target slot. Midpoint math keeps insertions O(1); a too-small gap
    renormalises the list instead of drifting positions to float-precision
    death after thousands of inserts."""
    before_card_id = before_card_id or None
    after_card_id = after_card_id or None
    if card.id in (before_card_id, after_card_id):
        raise HTTPException(status_code=400, detail="A card cannot be its own neighbour")

    if not before_card_id and not after_card_id:
        # No anchors: append at the end of the destination list.
        return await _next_card_position(db, target_list.id, exclude_card_id=card.id)

    siblings = (await db.execute(
        select(TaskCard)
        .where(
            TaskCard.list_id == target_list.id,
            TaskCard.workspace_id == workspace_id,
            TaskCard.id != card.id,
        )
        .order_by(TaskCard.position, TaskCard.created_at)
    )).scalars().all()
    positions = {c.id: float(c.position) for c in siblings}

    if before_card_id and before_card_id not in positions:
        raise HTTPException(status_code=400, detail="before_card_id is not in the target list")
    if after_card_id and after_card_id not in positions:
        raise HTTPException(status_code=400, detail="after_card_id is not in the target list")

    if before_card_id and after_card_id:
        prev_pos, next_pos = positions[before_card_id], positions[after_card_id]
        if abs(next_pos - prev_pos) < _RENORMALIZE_GAP:
            return _renormalized_position(siblings, card.id, before_card_id)
        return (prev_pos + next_pos) / 2.0
    if before_card_id:
        # Anchor above only: drop just below it (bottom edge).
        return positions[before_card_id] + 1.0
    # Anchor below only: float just above it (top edge).
    next_pos = positions[after_card_id]
    if next_pos <= 0:
        return _renormalized_position(siblings, card.id, None)
    return next_pos / 2.0


@router.patch("/cards/{card_id}", response_model=TaskCardOut)
async def update_card(
    card_id: str,
    payload: TaskCardPatch,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Partial update (rename, description, completed, priority, due date,
    tags, project) and/or kanban MOVE — see TaskCardPatch for the neighbour
    contract. A move within the same board keeps board_id consistent; moves to
    a list on a DIFFERENT board are rejected. The response's subtasks/
    attachments arrays are empty — mutations bump the board revision and open
    tabs re-pull /full."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    card = await _owned_card(db, workspace.id, card_id)
    board = await _owned_board(db, workspace.id, card.board_id)

    fields = payload.model_dump(exclude_unset=True)
    list_id = fields.pop("list_id", None)
    before_card_id = fields.pop("before_card_id", None)
    after_card_id = fields.pop("after_card_id", None)

    if "project_id" in fields and fields["project_id"]:
        await _validate_project(db, workspace.id, fields["project_id"])
    if "tags" in fields:
        fields["tags"] = fields["tags"] or []
    if "description" in fields and fields["description"] is None:
        fields["description"] = ""

    if list_id and list_id != card.list_id:
        target_list = await _owned_list(db, workspace.id, list_id)
        if target_list.board_id != card.board_id:
            raise HTTPException(status_code=400, detail="Cards can only move to a list on the same board")
        card.position = await _compute_move_position(db, workspace.id, target_list, card, before_card_id, after_card_id)
        card.list_id = target_list.id

    for key, value in fields.items():
        setattr(card, key, value)

    _bump(board)
    await db.commit()
    await db.refresh(card)
    return _card_out(card)


@router.delete("/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    card_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Delete a card and its subtasks/attachments (cascade)."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    card = await _owned_card(db, workspace.id, card_id)
    board = await _owned_board(db, workspace.id, card.board_id)
    await db.delete(card)
    _bump(board)
    await db.commit()


# ------------------------------------------------------------------------------
# Subtasks
# ------------------------------------------------------------------------------
@router.post("/cards/{card_id}/subtasks", response_model=TaskSubtaskOut, status_code=status.HTTP_201_CREATED)
async def create_subtask(
    card_id: str,
    payload: TaskSubtaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Append a checklist line to a card (max position + 1)."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    card = await _owned_card(db, workspace.id, card_id)
    board = await _owned_board(db, workspace.id, card.board_id)

    total = (await db.execute(
        select(func.count(TaskSubtask.id)).where(TaskSubtask.card_id == card.id)
    )).scalar_one()
    if total >= _MAX_SUBTASKS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Subtask limit reached ({_MAX_SUBTASKS}).",
        )

    max_pos = (await db.execute(
        select(func.coalesce(func.max(TaskSubtask.position), 0.0)).where(TaskSubtask.card_id == card.id)
    )).scalar_one()
    subtask = TaskSubtask(
        card_id=card.id,
        workspace_id=workspace.id,
        text=payload.text,
        is_done=False,
        position=float(max_pos) + 1.0,
    )
    db.add(subtask)
    _bump(board)
    await db.commit()
    await db.refresh(subtask)
    return _subtask_out(subtask)


@router.patch("/subtasks/{subtask_id}", response_model=TaskSubtaskOut)
async def update_subtask(
    subtask_id: str,
    payload: TaskSubtaskPatch,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Tick/untick or rename one checklist line."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    subtask = await _owned_subtask(db, workspace.id, subtask_id)
    card = await _owned_card(db, workspace.id, subtask.card_id)
    board = await _owned_board(db, workspace.id, card.board_id)

    fields = payload.model_dump(exclude_unset=True)
    for key, value in fields.items():
        setattr(subtask, key, value)

    _bump(board)
    await db.commit()
    await db.refresh(subtask)
    return _subtask_out(subtask)


@router.delete("/subtasks/{subtask_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subtask(
    subtask_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    subtask = await _owned_subtask(db, workspace.id, subtask_id)
    card = await _owned_card(db, workspace.id, subtask.card_id)
    board = await _owned_board(db, workspace.id, card.board_id)
    await db.delete(subtask)
    _bump(board)
    await db.commit()


# ------------------------------------------------------------------------------
# Attachments (metadata only; binaries live in Cloudinary via /storage)
# ------------------------------------------------------------------------------
@router.post("/cards/{card_id}/attachments", response_model=TaskAttachmentOut, status_code=status.HTTP_201_CREATED)
async def create_attachment(
    card_id: str,
    payload: TaskAttachmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Pin a link or an uploaded file's metadata to a card. The client uploads
    binaries through the existing /storage endpoints FIRST and passes the
    returned public id as file_key; this endpoint records metadata only.
    kind='link' requires url; kind='image'/'document' require file_key."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    card = await _owned_card(db, workspace.id, card_id)
    board = await _owned_board(db, workspace.id, card.board_id)

    total = (await db.execute(
        select(func.count(TaskAttachment.id)).where(TaskAttachment.card_id == card.id)
    )).scalar_one()
    if total >= _MAX_ATTACHMENTS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Attachment limit reached ({_MAX_ATTACHMENTS}).",
        )

    attachment = TaskAttachment(
        card_id=card.id,
        workspace_id=workspace.id,
        kind=payload.kind,
        url=payload.url,
        file_key=payload.file_key,
        file_name=payload.file_name,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
    )
    db.add(attachment)
    _bump(board)
    await db.commit()
    await db.refresh(attachment)
    return _attachment_out(attachment)


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    attachment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    attachment = await _owned_attachment(db, workspace.id, attachment_id)
    card = await _owned_card(db, workspace.id, attachment.card_id)
    board = await _owned_board(db, workspace.id, card.board_id)
    await db.delete(attachment)
    _bump(board)
    await db.commit()


@router.get("/attachments/{attachment_id}/file", response_model=TaskAttachmentFileOut)
async def get_attachment_file(
    attachment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Resolvable URLs for an attachment's file. Images get CDN delivery URLs
    with an auto-format/quality transformation (w_1600 view, w_400 thumb);
    documents get the presigned download URL; links pass their stored URL
    through."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    attachment = await _owned_attachment(db, workspace.id, attachment_id)

    url: Optional[str] = None
    thumb_url: Optional[str] = None
    if attachment.kind == "image" and attachment.file_key:
        url = storage_service.build_delivery_url(attachment.file_key, "f_auto,q_auto,w_1600")
        thumb_url = storage_service.build_delivery_url(attachment.file_key, "f_auto,q_auto,w_400")
    elif attachment.url:
        url = attachment.url
    elif attachment.file_key:
        url = storage_service.generate_presigned_download_url(attachment.file_key)

    if not url:
        raise HTTPException(status_code=404, detail="This attachment has no accessible file")
    return {"url": url, "thumb_url": thumb_url}


# ------------------------------------------------------------------------------
# Cross-feature: cards linked to a project (project detail page)
# ------------------------------------------------------------------------------
@router.get("/project/{project_id}/cards", response_model=List[ProjectTaskCardOut])
async def list_project_cards(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Every task card in this workspace linked to a project, enriched with
    board_name/list_name from ONE joined query — the project detail page's
    "where is this tracked" view."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    await _validate_project(db, workspace.id, project_id)

    rows = (await db.execute(
        select(TaskCard, TaskBoard.name, TaskList.name)
        .join(TaskBoard, TaskCard.board_id == TaskBoard.id)
        .join(TaskList, TaskCard.list_id == TaskList.id)
        .where(TaskCard.workspace_id == workspace.id, TaskCard.project_id == project_id)
        .order_by(TaskBoard.updated_at.desc(), TaskList.position, TaskCard.position)
    )).all()

    result: List[Dict[str, Any]] = []
    for card, board_name, list_name in rows:
        dto = _card_out(card)
        dto["board_name"] = board_name or ""
        dto["list_name"] = list_name or ""
        result.append(dto)
    return result
