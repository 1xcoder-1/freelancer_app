"""Feature flags API — which dashboard features non-owner accounts can see.

The owner (OWNER_EMAILS in config, default the founder's account) always sees
every feature; the Settings → Features tab writes the rows everyone else
follows. Flags are global single rows keyed by feature key — this is a
presentation/demo gate, not per-workspace authorization: every data endpoint
stays Clerk-authenticated and workspace-scoped as before, and the worst case
of a spoofed owner here is flipping app chrome, never data access.

Owner resolution: the verified Clerk JWT email claim OR the `?email=` profile
param the web app sends from its Clerk profile (some Clerk session templates
omit the email claim entirely; without the param the owner could not unlock
the toggles at all).
"""

import re
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.config import settings
from app.core.database import get_db
from app.models.feature_flag import FeatureFlag
from app.schemas.domain import FeatureFlagOut, FeatureFlagsPayload, FeatureFlagUpdate

router = APIRouter(prefix="/feature-flags", tags=["Feature Flags"])

# Must mirror the frontend registry (apps/web/src/lib/features.ts): the web app
# owns labels/icons/routes, the backend only needs the key set to validate
# writes. `home` and `settings` are intentionally absent — always visible.
FEATURE_KEYS = frozenset({
    "booking", "clients", "proposals", "projects", "money", "time",
    "planner", "insights", "profile", "inbox", "calendar",
})

# Sidebar entries beyond the top-level groups (sub-items and command-menu
# shortcuts) rename via composite keys like "clients.leads" or
# "profile.report-card"; the prefix must be a real feature key.
_ENTRY_RE = re.compile(r"^[a-z][a-z0-9-]*(\.[a-z0-9-]+)?$")


def _owner_emails() -> set:    return {e.strip().lower() for e in settings.OWNER_EMAILS.split(",") if e.strip()}


def _dev_session_is_owner() -> bool:
    # Dev-auth sessions never carry the owner's real Clerk email; treat them
    # as owner so local runs can exercise the management UI. Separate function
    # so tests can simulate a real (non-dev) deployment.
    return bool(settings.ALLOW_DEV_AUTH)


def _is_owner(current_user: Dict[str, Any], email_param: Optional[str]) -> bool:
    candidates = {(current_user.get("email") or "").strip().lower()}
    if email_param:
        candidates.add(email_param.strip().lower())
    candidates.discard("")
    if candidates & _owner_emails():
        return True
    return _dev_session_is_owner()


def _validate_key(key: str) -> str:
    if key not in FEATURE_KEYS:
        if not (_ENTRY_RE.match(key) and key.split(".", 1)[0] in FEATURE_KEYS):
            raise HTTPException(status_code=422, detail=f"Unknown feature key: {key}")
    return key


@router.get("", response_model=FeatureFlagsPayload)
async def get_feature_flags(
    email: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    rows = (await db.execute(select(FeatureFlag))).scalars().all()
    return FeatureFlagsPayload(
        is_owner=_is_owner(current_user, email),
        flags=[
            FeatureFlagOut(key=r.key, visible=r.visible, label_override=r.label_override)
            for r in rows
        ],
    )


@router.put("", response_model=FeatureFlagOut)
async def update_feature_flag(
    payload: FeatureFlagUpdate,
    email: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    if not _is_owner(current_user, email):
        raise HTTPException(
            status_code=403,
            detail="Only the app owner can change which features are visible.",
        )

    key = _validate_key(payload.key.strip())

    res = await db.execute(select(FeatureFlag).where(FeatureFlag.key == key))
    row = res.scalar_one_or_none()
    if row is None:
        row = FeatureFlag(key=key, visible=True)
        db.add(row)

    if payload.visible is not None:
        row.visible = payload.visible
    if payload.label_override is not None:
        row.label_override = payload.label_override.strip() or None

    await db.commit()
    await db.refresh(row)
    return row
