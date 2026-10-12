"""One write path for in-app notifications.

Every producer (invoice status moves, public contract view/sign/decline,
testimonial submissions) calls :func:`push_notification` instead of building
``Notification`` rows by hand. It never raises: a notification is a side
effect, and losing one must not fail the business transaction it rode along
with — the caller's commit matters more.
"""

import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification

logger = logging.getLogger(__name__)


async def push_notification(
    db: AsyncSession,
    workspace_id: str,
    kind: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
    occurred_at: Optional[datetime] = None,
) -> None:
    """Append one inbox row inside a SAVEPOINT so a notification glitch rolls
    back only itself — never the business write it rode along with."""
    try:
        async with db.begin_nested():
            db.add(
                Notification(
                    workspace_id=workspace_id,
                    kind=kind,
                    title=title,
                    body=body,
                    link=link,
                    occurred_at=occurred_at or datetime.utcnow(),
                )
            )
    except Exception:  # noqa: BLE001 — a failed side effect must not sink the request
        logger.exception("push_notification failed for workspace %s", workspace_id)
