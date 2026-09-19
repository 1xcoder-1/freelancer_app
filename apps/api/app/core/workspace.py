from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any, Tuple
import re
from app.models.workspace import User, Workspace, Membership

async def get_or_create_user_workspace(db: AsyncSession, current_user: Dict[str, Any]) -> Tuple[User, Workspace]:
    """
    Retrieves the User and their active Workspace from Neon PostgreSQL.
    If this is the user's first login, automatically provisions their User,
    Personal Workspace, and Owner Membership records in Neon DB.
    """
    clerk_id = current_user.get("user_id") or current_user.get("sub") or "user_demo"
    email = current_user.get("email") or f"{clerk_id}@freelancebook.com"
    full_name = current_user.get("name") or email.split("@")[0].capitalize()

    # 1. Look up User
    stmt = select(User).where(User.clerk_id == clerk_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        # Create User
        user = User(
            clerk_id=clerk_id,
            email=email,
            full_name=full_name
        )
        db.add(user)
        await db.flush()

        # Create Default Workspace for User
        slug = re.sub(r'[^a-zA-Z0-9]', '-', email.split('@')[0].lower()) + "-workspace"
        workspace = Workspace(
            name=f"{full_name}'s Workspace",
            slug=slug,
            currency="USD"
        )
        db.add(workspace)
        await db.flush()

        # Create Owner Membership
        membership = Membership(
            user_id=user.id,
            workspace_id=workspace.id,
            role="owner"
        )
        db.add(membership)
        await db.commit()
        await db.refresh(user)
        await db.refresh(workspace)
        return user, workspace

    # Look up Workspace from User Membership
    stmt = (
        select(Workspace)
        .join(Membership, Membership.workspace_id == Workspace.id)
        .where(Membership.user_id == user.id)
    )
    result = await db.execute(stmt)
    workspace = result.scalar_one_or_none()

    if not workspace:
        slug = re.sub(r'[^a-zA-Z0-9]', '-', email.split('@')[0].lower()) + "-workspace"
        workspace = Workspace(
            name=f"{full_name}'s Workspace",
            slug=slug,
            currency="USD"
        )
        db.add(workspace)
        await db.flush()

        membership = Membership(
            user_id=user.id,
            workspace_id=workspace.id,
            role="owner"
        )
        db.add(membership)
        await db.commit()
        await db.refresh(workspace)

    return user, workspace
