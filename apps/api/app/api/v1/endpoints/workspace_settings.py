"""Workspace settings API — the single source of truth for billing defaults.

The Settings page used to keep everything in browser localStorage while
promising that rates and currency apply to newly generated invoices. They live
on the workspace row now, so every device, the invoice pipeline and reminder
emails read the same values.

Caching note: `get_or_create_user_workspace` may hand back a detached identity
copy holding only id/name/slug/currency, so both handlers re-read the row from
the DB — the cache must never be the source for the settings fields.
"""

import re
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import _ws_cache_put, get_or_create_user_workspace
from app.models.workspace import Workspace
from app.schemas.domain import WorkspaceOut, WorkspaceUpdate

router = APIRouter(prefix="/workspace", tags=["Workspace Settings"])


@router.get("", response_model=WorkspaceOut)
async def get_workspace(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    fresh = await db.execute(select(Workspace).where(Workspace.id == workspace.id))
    return fresh.scalar_one()


@router.put("", response_model=WorkspaceOut)
async def update_workspace(
    payload: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    user, workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(select(Workspace).where(Workspace.id == workspace.id))
    row = res.scalar_one()

    changes = payload.model_dump(exclude_unset=True)
    if changes.get("name") and changes["name"] != row.name:
        row.name = changes.pop("name")
        # Slug is unique and derived from the name; keep it in the same shape
        # provisioning uses so public/legacy slug readers never see a stale id.
        base_slug = re.sub(r"[^a-zA-Z0-9]", "-", row.name.lower()) + "-workspace"
        slug = base_slug
        n = 1
        while True:
            taken = await db.execute(
                select(Workspace.id).where(Workspace.slug == slug, Workspace.id != row.id)
            )
            if taken.scalars().first() is None:
                break
            n += 1
            slug = f"{base_slug}-{n}"
        row.slug = slug
    else:
        changes.pop("name", None)

    for key, value in changes.items():
        setattr(row, key, value)

    # Cash Runway: an explicit null clears the balance back to 0 instead of
    # crashing on the NOT NULL column, and any write stamps the freshness
    # timestamp the dashboard shows next to the figure.
    if "bank_balance" in changes:
        if row.bank_balance is None:
            row.bank_balance = 0.0
        row.bank_balance_updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(row)

    # Re-publish the identity cache so later requests inside the cache window
    # read the saved values instead of the pre-edit copy.
    await _ws_cache_put(
        current_user.get("user_id") or current_user.get("sub") or "user_demo",
        user,
        row,
        current_user.get("name") or user.full_name or row.name,
        current_user.get("avatar_url"),
    )
    return row
