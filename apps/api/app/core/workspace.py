from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import case, select
from sqlalchemy.exc import IntegrityError
from typing import Dict, Any, Optional, Tuple
import asyncio
import re
import secrets
import time
from app.models.workspace import User, Workspace, Membership

# ------------------------------------------------------------------------------
# Per-user workspace cache
# ------------------------------------------------------------------------------
# get_or_create_user_workspace runs on EVERY authenticated request. Before this
# cache it did 3-4 SELECTs plus an unconditional COMMIT each time, which with
# remote Neon latency (80-200ms per round trip) added ~0.5-1s to every page
# load. Identity/profile data changes rarely, so a short-TTL cache keyed by
# clerk_id collapses the steady-state path to a single lightweight re-fetch.
_WS_CACHE_TTL_SEC = 300.0
_WS_CACHE_MAX_ENTRIES = 1_000
_WS_CACHE: Dict[str, Tuple[float, User, Workspace, str, Optional[str]]] = {}
# clerk_id -> (expires_at, user, workspace, synced_name, synced_avatar)
_WS_CACHE_LOCK = asyncio.Lock()


async def _ws_cache_get(clerk_id: str, name: str, avatar: Optional[str]) -> Optional[Tuple[User, Workspace]]:
    """Return (user, workspace) in-memory when the entry is fresh AND the Clerk
    profile fields match, otherwise None (stale claims must hit the DB)."""
    async with _WS_CACHE_LOCK:
        entry = _WS_CACHE.get(clerk_id)
        if not entry:
            return None
        expires_at, user, workspace, synced_name, synced_avatar = entry
        if expires_at < time.monotonic():
            _WS_CACHE.pop(clerk_id, None)
            return None
        if synced_name != name or (synced_avatar or "") != (avatar or ""):
            return None
        return user, workspace


async def _ws_cache_put(clerk_id: str, user: User, workspace: Workspace, name: str, avatar: Optional[str]) -> None:
    async with _WS_CACHE_LOCK:
        if len(_WS_CACHE) >= _WS_CACHE_MAX_ENTRIES and clerk_id not in _WS_CACHE:
            now = time.monotonic()
            for key in [k for k, (exp, *_) in _WS_CACHE.items() if exp < now]:
                _WS_CACHE.pop(key, None)
            if len(_WS_CACHE) >= _WS_CACHE_MAX_ENTRIES:
                _WS_CACHE.clear()
        
        # Detached in-memory copies safe to reuse across requests without
        # session binding. All mapped columns are copied (not a hand-picked
        # subset) so workspace settings read through a cache hit — currency,
        # default rate, invoice prefix — are exactly the saved values.
        cached_user = User(**{
            c.key: getattr(user, c.key) for c in user.__table__.columns
        })
        cached_workspace = Workspace(**{
            c.key: getattr(workspace, c.key) for c in workspace.__table__.columns
        })
        _WS_CACHE[clerk_id] = (time.monotonic() + _WS_CACHE_TTL_SEC, cached_user, cached_workspace, name, avatar)


def _ws_cache_clear() -> None:
    """Test hook: drop all cached workspace identities."""
    _WS_CACHE.clear()


async def get_or_create_user_workspace(db: AsyncSession, current_user: Dict[str, Any]) -> Tuple[User, Workspace]:
    """
    Retrieves the User and their active Workspace from Neon PostgreSQL.
    If this is the user's first login, automatically provisions their User,
    Personal Workspace, and Owner Membership records in Neon DB.

    Concurrency-safe: on a first login the dashboard fires several requests
    in parallel, so provisioning is wrapped in savepoints and any unique-key
    race is resolved by re-fetching the row the winning request committed.

    Steady-state requests (workspace already provisioned, profile unchanged)
    return from the memory cache instantly with 0 remote database round-trips.
    """
    clerk_id = current_user.get("user_id") or current_user.get("sub") or "user_demo"
    email = current_user.get("email") or f"{clerk_id}@freelancebook.com"
    full_name = current_user.get("name") or email.split("@")[0].capitalize()
    clerk_avatar = current_user.get("avatar_url")

    cached = await _ws_cache_get(clerk_id, full_name, clerk_avatar)
    if cached is not None:
        return cached

    user, workspace = await _get_or_create_user_and_workspace(db, clerk_id, email, full_name)

    # Keep the identity shown on public surfaces (report card) in sync with the
    # live Clerk profile, but only WRITE when something actually changed —
    # an unconditional flush/commit made every authenticated request a DB write.
    dirty = False
    if current_user.get("name") and user.full_name != full_name:
        user.full_name = full_name
        dirty = True
    if clerk_avatar and (user.avatar_url or "") != clerk_avatar:
        user.avatar_url = clerk_avatar
        dirty = True
    if dirty:
        await db.flush()
        await db.commit()

    await _ws_cache_put(clerk_id, user, workspace, full_name, clerk_avatar)
    return user, workspace


async def _get_or_create_user_and_workspace(db: AsyncSession, clerk_id: str, email: str, full_name: str) -> Tuple[User, Workspace]:
    """Full DB path: resolve/create the user, then their owner workspace.
    Commits only when new rows were actually created — savepoint flushes do not
    persist on their own, but a steady-state (already-provisioned) call stays a
    read-only transaction so we never write on every request."""
    user, user_created = await _get_or_create_user(db, clerk_id, email, full_name)
    workspace, workspace_created = await _get_or_create_workspace(db, user, email, full_name)

    if user_created or workspace_created:
        await db.commit()
    return user, workspace


async def _get_or_create_user(db: AsyncSession, clerk_id: str, email: str, full_name: str) -> Tuple[User, bool]:
    """Look up the user by clerk_id, creating it if missing (race-tolerant).
    Returns (user, created) so the caller knows whether a COMMIT is required."""
    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()
    if user:
        return user, False

    try:
        async with db.begin_nested():
            user = User(clerk_id=clerk_id, email=email, full_name=full_name)
            db.add(user)
            await db.flush()
        return user, True
    except IntegrityError:
        # A concurrent request won the race and committed the row; the savepoint
        # was rolled back by the context manager, so just re-fetch it.
        result = await db.execute(select(User).where(User.clerk_id == clerk_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise
        return user, False


async def _get_or_create_workspace(db: AsyncSession, user: User, email: str, full_name: str) -> Tuple[Workspace, bool]:
    """Return the user's workspace (via owner membership), creating it if
    missing. Returns (workspace, created) to drive the commit decision."""
    workspace = await _find_workspace_for_user(db, user)
    if workspace:
        return workspace, False

    # Slug is derived from the email local-part, which is NOT unique across
    # domains (ada@x.com vs ada@y.com) — a collision on the unique index would
    # surface as MultipleResultsFound/IntegrityError and a hard 500 on first
    # login, so de-duplicate with a random suffix before inserting.
    base_slug = re.sub(r'[^a-zA-Z0-9]', '-', email.split('@')[0].lower()) + "-workspace"
    slug = base_slug
    while await _workspace_slug_taken(db, slug):
        slug = f"{base_slug}-{secrets.token_hex(3)}"
    try:
        async with db.begin_nested():
            workspace = Workspace(
                name=f"{full_name}'s Workspace",
                slug=slug,
                currency="USD"
            )
            db.add(workspace)
            await db.flush()

            db.add(Membership(
                user_id=user.id,
                workspace_id=workspace.id,
                role="owner"
            ))
            await db.flush()
        return workspace, True
    except IntegrityError:
        # Another request provisioned the workspace/membership concurrently.
        db.expire_all()
        workspace = await _find_workspace_for_user(db, user)
        if workspace is None:
            raise
        return workspace, False


async def _workspace_slug_taken(db: AsyncSession, slug: str) -> bool:
    result = await db.execute(select(Workspace.id).where(Workspace.slug == slug).limit(1))
    return result.scalars().first() is not None


async def _find_workspace_for_user(db: AsyncSession, user: User) -> Workspace | None:
    # A user can hold several memberships (owner workspace + teams joined later).
    # scalar_one_or_none() would raise MultipleResultsFound and 500 every
    # authenticated endpoint, so deterministically prefer the owner workspace.
    result = await db.execute(
        select(Workspace)
        .join(Membership, Membership.workspace_id == Workspace.id)
        .where(Membership.user_id == user.id)
        .order_by(
            case((Membership.role == "owner", 0), else_=1),
            Workspace.created_at.asc(),
        )
        .limit(1)
    )
    return result.scalars().first()
