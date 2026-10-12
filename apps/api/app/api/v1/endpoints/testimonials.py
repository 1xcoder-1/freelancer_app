"""Testimonial collection (M2) — request, submit, approve.

The freelancer creates a request row (optionally tied to a client) and shares
its token URL; the client submits the quote with no account. Submissions land
as ``pending`` and only reach the public surface once approved. The public
endpoints authenticate by token alone and only ever touch one row — same
posture as every other share-token route in the app.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.client import Client
from app.models.testimonial import Testimonial
from app.services.notify import push_notification

router = APIRouter(prefix="/testimonials", tags=["Testimonials"])


class TestimonialCreate(BaseModel):
    client_id: Optional[str] = None
    author_name: str = Field(min_length=1, max_length=255)
    author_role: Optional[str] = Field(default=None, max_length=255)
    context_label: Optional[str] = Field(default=None, max_length=255)

    @field_validator("author_name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        # A whitespace-only name would render an unattributed quote once approved.
        if not v.strip():
            raise ValueError("author_name must not be blank")
        return v.strip()


class TestimonialUpdate(BaseModel):
    """Owner-side edits: approve/reject, or fix a typo before sharing."""

    author_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    author_role: Optional[str] = Field(default=None, max_length=255)
    context_label: Optional[str] = Field(default=None, max_length=255)
    quote: Optional[str] = Field(default=None, max_length=4000)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def _status_allowed(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("pending", "approved", "rejected"):
            raise ValueError("status must be pending, approved or rejected")
        return v


class TestimonialSubmit(BaseModel):
    """What the anonymous client sends from the public link."""

    quote: str = Field(min_length=1, max_length=4000)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    author_name: Optional[str] = Field(default=None, max_length=255)
    author_role: Optional[str] = Field(default=None, max_length=255)


def _serialize(t: Testimonial, include_token: bool = True) -> Dict[str, Any]:
    data = {
        "id": t.id,
        "client_id": t.client_id,
        "author_name": t.author_name,
        "author_role": t.author_role,
        "context_label": t.context_label,
        "quote": t.quote,
        "rating": t.rating,
        "status": t.status,
        "submitted_at": t.submitted_at,
        "created_at": t.created_at,
    }
    if include_token:
        data["token"] = t.token
        data["submit_url"] = f"/testimonial/{t.token}"
    return data


async def _get_owned(
    db: AsyncSession, workspace_id: str, testimonial_id: str
) -> Testimonial:
    res = await db.execute(
        select(Testimonial).where(
            Testimonial.id == testimonial_id,
            Testimonial.workspace_id == workspace_id,
        )
    )
    testimonial = res.scalar_one_or_none()
    if testimonial is None:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    return testimonial


@router.get("", response_model=List[Dict[str, Any]])
async def list_testimonials(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    conditions = [Testimonial.workspace_id == workspace.id]
    if status_filter in ("pending", "approved", "rejected"):
        conditions.append(Testimonial.status == status_filter)
    res = await db.execute(
        select(Testimonial)
        .where(*conditions)
        .order_by(Testimonial.created_at.desc())
    )
    return [_serialize(t) for t in res.scalars().all()]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any])
async def create_testimonial_request(
    payload: TestimonialCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)

    if payload.client_id is not None:
        client = (await db.execute(
            select(Client.id).where(
                Client.id == payload.client_id, Client.workspace_id == workspace.id
            )
        )).scalar_one_or_none()
        if client is None:
            raise HTTPException(status_code=404, detail="Client not found in current workspace")

    testimonial = Testimonial(
        workspace_id=workspace.id,
        client_id=payload.client_id,
        author_name=payload.author_name,
        author_role=payload.author_role,
        context_label=payload.context_label,
        status="pending",
    )
    db.add(testimonial)
    await db.commit()
    await db.refresh(testimonial)
    return _serialize(testimonial)


@router.patch("/{testimonial_id}", response_model=Dict[str, Any])
async def update_testimonial(
    testimonial_id: str,
    payload: TestimonialUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    testimonial = await _get_owned(db, workspace.id, testimonial_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(testimonial, field, value)
    await db.commit()
    await db.refresh(testimonial)
    return _serialize(testimonial)


@router.delete("/{testimonial_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_testimonial(
    testimonial_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Deleting the row also kills the submit link — the token lives here."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    testimonial = await _get_owned(db, workspace.id, testimonial_id)
    await db.delete(testimonial)
    await db.commit()
    return None


# --- public (token-authenticated, no account) -------------------------------


async def _resolve_public(db: AsyncSession, token: str) -> Testimonial:
    res = await db.execute(select(Testimonial).where(Testimonial.token == token))
    testimonial = res.scalar_one_or_none()
    # Same 404 for unknown / deleted tokens — a revoked link just "doesn't exist".
    if testimonial is None:
        raise HTTPException(status_code=404, detail="Testimonial request not found")
    return testimonial


@router.get("/public/{token}", response_model=Dict[str, Any])
async def get_public_request(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """What the client sees before typing: who it's for, prefilled name."""
    testimonial = await _resolve_public(db, token)
    if testimonial.submitted_at is not None:
        raise HTTPException(status_code=409, detail="This testimonial was already submitted")
    return {
        "author_name": testimonial.author_name,
        "author_role": testimonial.author_role,
        "context_label": testimonial.context_label,
        "submitted": False,
    }


@router.post("/public/{token}", response_model=Dict[str, Any])
async def submit_public_testimonial(
    token: str,
    payload: TestimonialSubmit,
    db: AsyncSession = Depends(get_db),
):
    testimonial = await _resolve_public(db, token)
    if testimonial.submitted_at is not None:
        raise HTTPException(status_code=409, detail="This testimonial was already submitted")
    testimonial.quote = payload.quote.strip()
    testimonial.rating = payload.rating
    if payload.author_name and payload.author_name.strip():
        testimonial.author_name = payload.author_name.strip()
    if payload.author_role is not None:
        testimonial.author_role = payload.author_role.strip() or None
    testimonial.submitted_at = datetime.utcnow()
    testimonial.status = "pending"
    await push_notification(
        db, testimonial.workspace_id, "testimonial.submitted",
        f"New testimonial from {testimonial.author_name}",
        body="A client submitted a quote for your approval.",
        link="/dashboard/testimonials",
    )
    await db.commit()
    await db.refresh(testimonial)
    return {"status": "received", "submitted_at": testimonial.submitted_at}
