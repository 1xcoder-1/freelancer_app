"""One write path for in-app notifications.

Every producer (invoice status moves, public contract view/sign/decline,
testimonial submissions) calls :func:`push_notification` instead of building
``Notification`` rows by hand. It never raises: a notification is a side
effect, and losing one must not fail the business transaction it rode along
with — the caller's commit matters more.
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.services.realtime import publish_changed

logger = logging.getLogger(__name__)


async def push_notification(
    db: AsyncSession,
    workspace_id: str,
    kind: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
    occurred_at: Optional[datetime] = None,
    dedupe_key: Optional[str] = None,
) -> None:
    """Append one inbox row inside a SAVEPOINT so a notification glitch rolls
    back only itself — never the business write it rode along with.

    ``dedupe_key`` marks a row as idempotent for state-driven producers (the
    hourly task scan): the unique partial index on it makes a concurrent or
    repeated write for the same key a no-op instead of a duplicate alert.
    Transition-driven producers (invoice paid/overdue, contract signed) leave
    it NULL — their trigger only fires once by construction."""
    try:
        async with db.begin_nested():
            db.add(
                Notification(
                    workspace_id=workspace_id,
                    kind=kind,
                    title=title,
                    body=body,
                    link=link,
                    dedupe_key=dedupe_key,
                    occurred_at=occurred_at or datetime.utcnow(),
                )
            )
        # Ping open inbox streams shortly after — delayed so the caller's outer
        # commit (which usually follows within the same request) lands first and
        # the client's refetch actually sees the row. A spurious ping after a
        # rollback is harmless: the refetch just finds nothing new.
        try:
            asyncio.get_running_loop().call_later(1.0, publish_changed, workspace_id)
        except RuntimeError:
            pass  # no running loop (sync context) — polling still covers it
    except Exception:  # noqa: BLE001 — a failed side effect must not sink the request
        logger.exception("push_notification failed for workspace %s", workspace_id)
