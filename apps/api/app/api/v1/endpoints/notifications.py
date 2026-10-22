"""Notifications inbox (M1) — the workspace's event feed.

Producers append rows via ``app.services.notify.push_notification``; this
router is the read/mark-read side. Every query is workspace-scoped (foreign
ids 404, never leak), and the unread-count endpoint is a single indexed
count so the sidebar badge can poll it cheaply.

``GET /stream`` is the realtime half: a Server-Sent-Events channel that
pings the moment a producer writes for the workspace, so the inbox and the
sidebar badge update without polling cadence.
"""

import asyncio
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user, verify_clerk_token
from app.core.database import AsyncSessionLocal, get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.notification import Notification
from app.services.realtime import subscribe, unsubscribe

router = APIRouter(prefix="/notifications", tags=["Notifications (inbox)"])


def _serialize(n: Notification) -> Dict[str, Any]:
    return {
        "id": n.id,
        "kind": n.kind,
        "title": n.title,
        "body": n.body,
        "link": n.link,
        "is_read": n.is_read,
        "occurred_at": n.occurred_at,
        "created_at": n.created_at,
    }


async def _get_owned(
    db: AsyncSession, workspace_id: str, notification_id: str
) -> Notification:
    """Foreign or unknown ids get the same 404 — never reveal which."""
    res = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.workspace_id == workspace_id,
        )
    )
    notification = res.scalar_one_or_none()
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


@router.get("", response_model=List[Dict[str, Any]])
async def list_notifications(
    unread_only: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """The inbox feed, newest first. Bounded scan, never an unbounded fetch."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    conditions = [Notification.workspace_id == workspace.id]
    if unread_only:
        conditions.append(Notification.is_read.is_(False))
    res = await db.execute(
        select(Notification)
        .where(*conditions)
        .order_by(Notification.occurred_at.desc())
        .limit(limit)
    )
    return [_serialize(n) for n in res.scalars().all()]


@router.get("/unread-count", response_model=Dict[str, Any])
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.workspace_id == workspace.id, Notification.is_read.is_(False))
    )
    return {"count": res.scalar_one()}


@router.post("/read-all", response_model=Dict[str, Any])
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(
        update(Notification)
        .where(Notification.workspace_id == workspace.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()
    return {"marked": res.rowcount}


@router.post("/{notification_id}/read", response_model=Dict[str, Any])
async def mark_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    notification = await _get_owned(db, workspace.id, notification_id)
    notification.is_read = True
    await db.commit()
    return {"id": notification.id, "is_read": True}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    notification = await _get_owned(db, workspace.id, notification_id)
    await db.delete(notification)
    await db.commit()
    return None


@router.get("/stream")
async def stream_notifications(token: str = Query(...)):
    """SSE channel: one ``changed`` ping per producer write, ``: ping`` every
    15s to keep intermediaries from idling the connection out.

    EventSource cannot send headers, so the Clerk token rides in the query
    string and is verified with the exact same cryptographic check as every
    other endpoint. The DB session is used only to resolve the workspace and
    closed before streaming — a long-lived connection must not hold a pool
    slot open.
    """
    user = await verify_clerk_token(token)
    async with AsyncSessionLocal() as db:
        _, workspace = await get_or_create_user_workspace(db, user)
        workspace_id = workspace.id

    queue = subscribe(workspace_id)

    async def event_stream():
        try:
            yield "event: ready\ndata: {}\n\n"
            while True:
                try:
                    await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield "event: changed\ndata: {}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            unsubscribe(workspace_id, queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
