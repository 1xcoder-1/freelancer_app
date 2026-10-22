"""In-process realtime bus for the notifications inbox.

``push_notification`` publishes a workspace-scoped "changed" ping after the
row lands, and the SSE endpoint (``/notifications/stream``) streams it to any
open dashboard tab — instant inbox/badge updates with no new dependency and no
extra DB load.

Scope note: this bus is single-process, which matches how the API runs
(one uvicorn worker; Inngest functions execute in this same process through
the serve mount). The client keeps a slow poll as a safety net, so even a
future multi-worker deployment only degrades to the old refresh cadence.
"""

import asyncio
from collections import defaultdict

_SUBSCRIBERS: dict[str, set[asyncio.Queue]] = defaultdict(set)
_QUEUE_MAX = 16


def subscribe(workspace_id: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=_QUEUE_MAX)
    _SUBSCRIBERS[workspace_id].add(q)
    return q


def unsubscribe(workspace_id: str, q: asyncio.Queue) -> None:
    _SUBSCRIBERS[workspace_id].discard(q)
    if not _SUBSCRIBERS[workspace_id]:
        _SUBSCRIBERS.pop(workspace_id, None)


def publish_changed(workspace_id: str) -> None:
    """Non-blocking fan-out: a full/slow subscriber just misses this tick —
    its next poll or heartbeat catch-up heals it."""
    for q in list(_SUBSCRIBERS.get(workspace_id, ())):
        try:
            q.put_nowait("changed")
        except asyncio.QueueFull:
            pass
