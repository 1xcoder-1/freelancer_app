"""Feature flags API — which dashboard features non-owner accounts can see.

The owner (OWNER_EMAILS in config, default the founder's account) always sees
every feature; the Settings → Features tab writes the rows everyone else
follows. Flags are global single rows keyed by feature key — this is a
presentation/demo gate, not per-workspace authorization: every data endpoint
stays Clerk-authenticated and workspace-scoped as before, and the worst case
of a spoofed owner here is flipping app chrome, never data access.

Owner resolution: the verified Clerk JWT email claim OR the `?email=` profile
param the web app sends from its Clerk profile (some Clerk session templates
omit the email claim entirely). A client-supplied email is never trusted on
its own — it only counts after the authenticated user's real Clerk address has
been resolved by their verified `sub` and compared. Dev/mock sessions are the
only ones that bypass this, and only when they were actually issued by the
dev-auth path.
"""

import re
import time
from typing import Any, Dict, Optional, Tuple

import httpx
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


# Clerk profile lookups are cached so the owner fallback costs at most one
# HTTPS round trip per user per TTL instead of one per feature-flags request.
_EMAIL_CACHE: Dict[str, Tuple[float, str]] = {}
_EMAIL_CACHE_TTL = 600.0
_EMAIL_CACHE_MISS_TTL = 60.0
_EMAIL_CACHE_MAX = 512


def _owner_emails() -> set:
    return {e.strip().lower() for e in settings.OWNER_EMAILS.split(",") if e.strip()}


def _is_dev_session(current_user: Dict[str, Any]) -> bool:
    # Only identities actually issued by the dev-auth path (mock tokens) skip
    # the owner check. ALLOW_DEV_AUTH being on must not make real Clerk users
    # — including test/demo accounts — owners of the app.
    return bool(current_user.get("dev_mode"))


async def _clerk_email(user_id: str) -> Optional[str]:
    """Resolve the signed-in user's primary email through Clerk's Backend API.

    Used only when a session token omitted the email claim. The result is tied
    to the verified `sub`, so a client can never become owner by passing an
    owner address in the query string.
    """
    if not settings.CLERK_SECRET_KEY or not user_id:
        return None

    now = time.monotonic()
    cached = _EMAIL_CACHE.get(user_id)
    if cached and cached[0] > now:
        return cached[1] or None

    email = ""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"https://api.clerk.com/v1/users/{user_id}",
                headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
            )
        if response.status_code == 200:
            data = response.json()
            addresses = data.get("email_addresses") or []
            primary_id = data.get("primary_email_address_id")
            email = next(
                (
                    a.get("email_address", "")
                    for a in addresses
                    if a.get("id") == primary_id
                ),
                (addresses[0].get("email_address", "") if addresses else ""),
            )
    except Exception:
        email = ""

    email = (email or "").strip().lower()
    if len(_EMAIL_CACHE) >= _EMAIL_CACHE_MAX:
        _EMAIL_CACHE.clear()
    _EMAIL_CACHE[user_id] = (
        now + (_EMAIL_CACHE_TTL if email else _EMAIL_CACHE_MISS_TTL),
        email,
    )
    return email or None


async def _is_owner(current_user: Dict[str, Any], email_param: Optional[str]) -> bool:
    if _is_dev_session(current_user):
        return True

    owners = _owner_emails()
    claimed = (current_user.get("email") or "").strip().lower()
    # auth.py invents `{user_id}@freelancebook.com` when the token has no email
    # claim; that placeholder is not a real address to compare against.
    if claimed.endswith("@freelancebook.com"):
        claimed = ""
    if claimed and claimed in owners:
        return True

    supplied = (email_param or "").strip().lower()
    if supplied and supplied in owners and supplied != claimed:
        verified = await _clerk_email(current_user.get("user_id") or "")
        return bool(verified and verified in owners)
    return False


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
        is_owner=await _is_owner(current_user, email),
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
    if not await _is_owner(current_user, email):
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
    # An explicit null/empty reset must clear the stored label; omitting the
    # field entirely still leaves it untouched.
    if "label_override" in payload.model_fields_set:
        row.label_override = (payload.label_override or "").strip() or None

    await db.commit()
    await db.refresh(row)
    return row
