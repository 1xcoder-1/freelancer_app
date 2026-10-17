"""Live preview channel for link pages.

The editor tab publishes debounced draft snapshots over a WebSocket; preview
tabs (opened at /p/{slug}?preview={token}) subscribe and re-render instantly.
Nothing received here is persisted — saving still goes through the owner REST
endpoints, so the WS layer stays stateless except for the in-memory replay
cache that lets a late-joining preview tab paint without a REST round trip.

Auth model (no tokens ever travel in the URL):
- POST /link-pages/my/{page_id}/preview-token — Clerk-authed owner mints a
  short-lived HS256 token (aud "linkpage-preview", bound to one page_id).
- WS /link-pages/ws/{page_id} — after accept, the client must send
  {"type":"auth","role":"publisher","token":"<Clerk JWT>"} (owner only, DB
  ownership check) or {"type":"auth","role":"viewer","token":"<preview token>"}
  (subscribe-only) within AUTH_TIMEOUT, else the socket is closed.

The HTTP security-header/rate-limit middleware only wraps HTTP requests, so
the WS loop enforces its own caps: origin allowlist, room occupancy, message
rate, and payload size. Preview tokens are signed with LINKPAGE_PREVIEW_SECRET
(derived at startup when unset) so tokens survive a dev --reload restart.
"""

import asyncio
import hashlib
import json
import secrets
import time
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Any, Deque, Dict, List, Optional, Set

import jwt
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user, verify_clerk_token
from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.link_page import LinkPage

router = APIRouter(prefix="/link-pages", tags=["Link Page Preview"])

_PREVIEW_AUD = "linkpage-preview"
_PREVIEW_TTL = timedelta(hours=1)
_MAX_ROOM_PUBLISHERS = 2
_MAX_ROOM_VIEWERS = 5
_AUTH_TIMEOUT = 10.0
_MSG_RATE_LIMIT = 20       # messages per connection...
_MSG_RATE_WINDOW = 10.0    # ...per 10 seconds
_MAX_RATE_VIOLATIONS = 5
_MAX_STATE_BYTES = 128 * 1024


def _preview_secret() -> str:
    configured = (settings.LINKPAGE_PREVIEW_SECRET or "").strip()
    if configured:
        return configured
    seed = f"linkpage-preview:{settings.CLERK_SECRET_KEY or settings.DATABASE_URL}"
    return hashlib.sha256(seed.encode()).hexdigest()


# ------------------------------------------------------------------------------
# Draft snapshot schemas — validated before anything is broadcast
# ------------------------------------------------------------------------------
class PreviewItemState(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    label: str = Field(..., min_length=1, max_length=200)
    url: str = Field("", max_length=500)
    item_type: str = Field("link", max_length=16)
    icon: Optional[str] = Field(None, max_length=40)
    description: Optional[str] = Field(None, max_length=300)
    image_url: Optional[str] = Field(None, max_length=500)
    active: bool = True

    @field_validator("item_type")
    @classmethod
    def _check_item_type(cls, v: str) -> str:
        v = (v or "link").strip().lower()
        return v if v in ("link", "header", "divider") else "link"


class PreviewPageState(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=200)
    headline: Optional[str] = Field(None, max_length=200)
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = Field(None, max_length=500)
    template: str = Field("paper", max_length=32)
    background_image_url: Optional[str] = Field(None, max_length=500)
    background_overlay: Optional[float] = Field(None, ge=0.0, le=1.0)
    items: List[PreviewItemState] = Field(default_factory=list, max_length=100)


# ------------------------------------------------------------------------------
# Preview token minting (owner only)
# ------------------------------------------------------------------------------
@router.post("/my/{page_id}/preview-token")
async def create_preview_token(
    page_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Short-lived token letting THIS browser tab watch/publish the draft of
    one owned page. Bound to the page id and the owner identity; 404 for
    foreign page ids, same as every other owner route."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(
        select(LinkPage.id).where(LinkPage.id == page_id, LinkPage.workspace_id == workspace.id)
    )
    if res.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This link page does not exist.")

    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "aud": _PREVIEW_AUD,
            "sub": current_user.get("user_id") or "",
            "page_id": page_id,
            "ws": workspace.id,
            "iat": now,
            "exp": now + _PREVIEW_TTL,
            "jti": secrets.token_hex(8),
        },
        _preview_secret(),
        algorithm="HS256",
    )
    return {"token": token, "expires_in": int(_PREVIEW_TTL.total_seconds())}


# ------------------------------------------------------------------------------
# WebSocket rooms
# ------------------------------------------------------------------------------
class _Room:
    __slots__ = ("publishers", "viewers", "last_state")

    def __init__(self) -> None:
        self.publishers: Set[WebSocket] = set()
        self.viewers: Set[WebSocket] = set()
        self.last_state: Optional[Dict[str, Any]] = None


_rooms: Dict[str, _Room] = {}
_rooms_lock = asyncio.Lock()


async def _get_room(page_id: str) -> _Room:
    async with _rooms_lock:
        room = _rooms.get(page_id)
        if room is None:
            room = _rooms[page_id] = _Room()
        return room


async def _drop_room_if_empty(page_id: str, room: _Room) -> None:
    async with _rooms_lock:
        if not room.publishers and not room.viewers and _rooms.get(page_id) is room:
            _rooms.pop(page_id, None)


async def _send_json(ws: WebSocket, payload: Dict[str, Any]) -> None:
    await ws.send_text(json.dumps(payload, separators=(",", ":")))


async def _broadcast_state(room: _Room, state: Dict[str, Any]) -> None:
    targets = list(room.viewers)
    if not targets:
        return
    results = await asyncio.gather(
        *(_send_json(ws, {"type": "state", "state": state}) for ws in targets),
        return_exceptions=True,
    )
    for ws, result in zip(targets, results):
        if isinstance(result, Exception):
            room.viewers.discard(ws)


def _origin_allowed(origin: Optional[str]) -> bool:
    """Browsers always send Origin on WS upgrades, so a present-but-foreign
    Origin is a cross-site socket and gets rejected. A missing Origin is a
    non-browser client (CLI, test harness); it cannot ride on browser
    credentials and still must pass token auth below, so it is allowed."""
    if not origin:
        return True
    candidate = origin.strip().rstrip("/")
    allowed = {o.strip().rstrip("/") for o in [*settings.CORS_ORIGINS, settings.WEB_APP_URL] if o}
    return candidate in allowed


async def _authorize(role: str, token: str, page_id: str) -> str:
    if role == "publisher":
        user = await verify_clerk_token(token)
        async with AsyncSessionLocal() as db:
            _, workspace = await get_or_create_user_workspace(db, user)
            res = await db.execute(
                select(LinkPage.id).where(
                    LinkPage.id == page_id, LinkPage.workspace_id == workspace.id
                )
            )
            if res.scalar_one_or_none() is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This link page does not exist.")
        return "publisher"

    claims = jwt.decode(token, _preview_secret(), algorithms=["HS256"], audience=_PREVIEW_AUD)
    if claims.get("page_id") != page_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Preview token is for a different page.")
    return "viewer"


@router.websocket("/ws/{page_id}")
async def link_page_preview_ws(websocket: WebSocket, page_id: str) -> None:
    if not _origin_allowed(websocket.headers.get("origin")):
        await websocket.close(code=4403, reason="Origin not allowed.")
        return

    await websocket.accept()

    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=_AUTH_TIMEOUT)
        msg = json.loads(raw)
        role = msg.get("role")
        token = (msg.get("token") or "").strip()
        if role not in ("publisher", "viewer") or not token:
            await websocket.close(code=4401, reason="Expected an auth message with role and token.")
            return
        role = await _authorize(role, token, page_id)
    except asyncio.TimeoutError:
        await websocket.close(code=4408, reason="Timed out waiting for auth.")
        return
    except WebSocketDisconnect:
        return
    except json.JSONDecodeError:
        await websocket.close(code=1003, reason="Malformed auth message.")
        return
    except jwt.PyJWTError:
        await websocket.close(code=4401, reason="Token is invalid or expired.")
        return
    except HTTPException as exc:
        code = 4403 if exc.status_code == status.HTTP_404_NOT_FOUND else 4401
        reason = exc.detail if isinstance(exc.detail, str) else "Unauthorized."
        await websocket.close(code=code, reason=reason)
        return

    room = await _get_room(page_id)
    bucket = room.publishers if role == "publisher" else room.viewers
    cap = _MAX_ROOM_PUBLISHERS if role == "publisher" else _MAX_ROOM_VIEWERS
    if len(bucket) >= cap:
        await websocket.close(code=4429, reason="Too many connections for this page.")
        await _drop_room_if_empty(page_id, room)
        return

    bucket.add(websocket)
    try:
        await _send_json(websocket, {"type": "ready", "role": role})
        # Late joiner: replay the newest draft so the tab paints without an
        # extra REST round trip.
        if role == "viewer" and room.last_state is not None:
            await _send_json(websocket, {"type": "state", "state": room.last_state})

        sent_times: Deque[float] = deque()
        violations = 0
        while True:
            raw = await websocket.receive_text()

            now = time.monotonic()
            while sent_times and now - sent_times[0] > _MSG_RATE_WINDOW:
                sent_times.popleft()
            if len(sent_times) >= _MSG_RATE_LIMIT:
                violations += 1
                if violations > _MAX_RATE_VIOLATIONS:
                    await websocket.close(code=4429, reason="Sending updates too fast.")
                    return
                await _send_json(websocket, {"type": "error", "detail": "Sending updates too fast — slowing down."})
                continue
            sent_times.append(now)

            if len(raw) > _MAX_STATE_BYTES:
                await _send_json(websocket, {"type": "error", "detail": "Update payload is too large."})
                continue
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            mtype = msg.get("type")
            if mtype == "ping":
                await _send_json(websocket, {"type": "pong"})
                continue
            if mtype == "state" and role == "publisher":
                try:
                    state = PreviewPageState.model_validate(msg.get("state") or {})
                except ValidationError:
                    await _send_json(websocket, {"type": "error", "detail": "That update didn't look like a valid page."})
                    continue
                state_dict = state.model_dump(mode="json")
                room.last_state = state_dict
                await _broadcast_state(room, state_dict)
    except WebSocketDisconnect:
        pass
    finally:
        bucket.discard(websocket)
        await _drop_room_if_empty(page_id, room)
