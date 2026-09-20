from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import case, select
from sqlalchemy.exc import IntegrityError
from typing import Dict, Any, Tuple
import re
import secrets
from app.models.workspace import User, Workspace, Membership


async def get_or_create_user_workspace(db: AsyncSession, current_user: Dict[str, Any]) -> Tuple[User, Workspace]:
    """
    Retrieves the User and their active Workspace from Neon PostgreSQL.
    If this is the user's first login, automatically provisions their User,
    Personal Workspace, and Owner Membership records in Neon DB.

    Concurrency-safe: on a first login the dashboard fires several requests
    in parallel, so provisioning is wrapped in savepoints and any unique-key
    race is resolved by re-fetching the row the winning request committed.
    """
    clerk_id = current_user.get("user_id") or current_user.get("sub") or "user_demo"
    email = current_user.get("email") or f"{clerk_id}@freelancebook.com"
    full_name = current_user.get("name") or email.split("@")[0].capitalize()

    user = await _get_or_create_user(db, clerk_id, email, full_name)
    workspace = await _get_or_create_workspace(db, user, email, full_name)

    # Keep the identity shown on public surfaces (report card) in sync with the
    # live Clerk profile on every authenticated request.
    clerk_avatar = current_user.get("avatar_url")
    changed = False
    if current_user.get("name") and user.full_name != full_name:
        user.full_name = full_name
        changed = True
    if clerk_avatar and (user.avatar_url or "") != clerk_avatar:
        user.avatar_url = clerk_avatar
        changed = True
    if changed:
        await db.flush()

    await db.commit()
    return user, workspace


async def _get_or_create_user(db: AsyncSession, clerk_id: str, email: str, full_name: str) -> User:
    """Look up the user by clerk_id, creating it if missing (race-tolerant)."""
    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()
    if user:
        return user

    try:
        async with db.begin_nested():
            user = User(clerk_id=clerk_id, email=email, full_name=full_name)
            db.add(user)
            await db.flush()
        return user
    except IntegrityError:
        # A concurrent request won the race and committed the row; the savepoint
        # was rolled back by the context manager, so just re-fetch it.
        result = await db.execute(select(User).where(User.clerk_id == clerk_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise
        return user


async def _get_or_create_workspace(db: AsyncSession, user: User, email: str, full_name: str) -> Workspace:
    """Return the user's workspace (via owner membership), creating it if missing."""
    workspace = await _find_workspace_for_user(db, user)
    if workspace:
        return workspace

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
    except IntegrityError:
        # Another request provisioned the workspace/membership concurrently.
        db.expire_all()
        workspace = await _find_workspace_for_user(db, user)
        if workspace is None:
            raise
    return workspace


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
