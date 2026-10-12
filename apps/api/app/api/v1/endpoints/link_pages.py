"""Link pages (Linktree-style public profile).

One page per workspace with a short public slug, an ordered list of link
buttons, and an append-only event stream powering the stats endpoint.
Owner routes are workspace-scoped like every other module; public routes
address the page by slug only (404 — never a "this page exists but is
private" hint) and are rate-limited via the /link-pages/public/ rule in
app.core.rate_limit.
"""

import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.link_page import LinkEvent, LinkItem, LinkPage

router = APIRouter(prefix="/link-pages", tags=["Link Pages"])

# Lowercase alnum plus hyphens/dots, 2-64 chars, must start and end alnum.
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9.\-]{0,62}[a-z0-9]$")
_MAX_ITEMS = 100  # a link page with 100 buttons is already unusable


def _validate_slug(value: str) -> str:
    value = (value or "").strip().lower()
    if not _SLUG_RE.match(value):
        raise ValueError(
            "Slug must be 2-64 characters: lowercase letters, numbers, hyphens or dots "
            "(starting and ending with a letter or number)."
        )
    return value


# ------------------------------------------------------------------------------
# Schemas (inline, report-card style)
# ------------------------------------------------------------------------------
class LinkPageUpsert(BaseModel):
    slug: str
    display_name: str = Field(..., min_length=1, max_length=200)
    headline: Optional[str] = Field(None, max_length=200)
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = Field(None, max_length=500)
    theme: str = Field("default", max_length=32)
    template: str = Field("classic", max_length=32)
    published: bool = False

    @field_validator("slug")
    @classmethod
    def _check_slug(cls, v: str) -> str:
        return _validate_slug(v)

    @field_validator("display_name", "headline", "bio", "theme", "template")
    @classmethod
    def _strip(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if isinstance(v, str) else v


class LinkItemIn(BaseModel):
    label: str = Field(..., min_length=1, max_length=200)
    url: str = Field(..., min_length=4, max_length=500)
    icon: Optional[str] = Field(None, max_length=40)
    description: Optional[str] = Field(None, max_length=300)
    sort_order: int = 0
    active: bool = True

    @field_validator("url")
    @classmethod
    def _check_url(cls, v: str) -> str:
        # Only http(s) targets: javascript:/data: URLs in a public button are XSS
        # bait, and a bare "foo" link never resolves.
        v = v.strip()
        if not re.match(r"^https?://", v, re.IGNORECASE):
            raise ValueError("Link URL must start with http:// or https://")
        return v

    @field_validator("label")
    @classmethod
    def _check_label(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Label must not be blank")
        return v


class LinkItemsReplace(BaseModel):
    items: List[LinkItemIn] = Field(..., max_length=_MAX_ITEMS)


class LinkEventCreate(BaseModel):
    event_type: str
    item_id: Optional[str] = Field(None, max_length=36)
    # Length-capped, never parsed at write time — the raw string is fine to
    # store as long as the column width is respected (500).
    referrer: Optional[str] = Field(None, max_length=500)

    @field_validator("event_type")
    @classmethod
    def _check_type(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in ("view", "click"):
            raise ValueError("event_type must be 'view' or 'click'")
        return v

    @field_validator("referrer")
    @classmethod
    def _check_referrer(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 500:
            raise ValueError("referrer is too long")
        return v or None


# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------
def _page_payload(page: LinkPage, items: List[LinkItem]) -> Dict[str, Any]:
    return {
        "id": page.id,
        "workspace_id": page.workspace_id,
        "slug": page.slug,
        "display_name": page.display_name,
        "headline": page.headline,
        "bio": page.bio,
        "avatar_url": page.avatar_url,
        "theme": page.theme,
        "template": page.template,
        "published": bool(page.published),
        "views_count": page.views_count or 0,
        "created_at": page.created_at,
        "updated_at": page.updated_at,
        "items": [_item_payload(i) for i in items],
    }


def _item_payload(item: LinkItem) -> Dict[str, Any]:
    return {
        "id": item.id,
        "page_id": item.page_id,
        "label": item.label,
        "url": item.url,
        "icon": item.icon,
        "description": item.description,
        "sort_order": item.sort_order,
        "active": bool(item.active),
        "clicks_count": item.clicks_count or 0,
    }


def _normalized_referrer(raw: Optional[str]) -> str:
    """Bucket a referrer for the top-referrers table: strip query + fragment,
    fold everything unusable (missing, garbage) into 'direct'."""
    if not raw:
        return "direct"
    value = raw.strip()
    if not value:
        return "direct"
    # '//host/path' and 'host/path' both parse cleanly once we nudge the
    # scheme-less forms through the parser.
    parse_target = value if "//" in value else f"//{value}"
    try:
        parsed = urlparse(parse_target)
    except ValueError:
        return "direct"
    host = (parsed.netloc or "").lower()
    if not host or "." not in host:
        return "direct"
    path = (parsed.path or "").rstrip("/")
    return f"{host}{path}" if path else host


async def _get_my_page(db: AsyncSession, workspace_id: str) -> Optional[LinkPage]:
    res = await db.execute(select(LinkPage).where(LinkPage.workspace_id == workspace_id))
    return res.scalar_one_or_none()


async def _items_of(db: AsyncSession, page_id: str, active_only: bool = False) -> List[LinkItem]:
    stmt = select(LinkItem).where(LinkItem.page_id == page_id)
    if active_only:
        stmt = stmt.where(LinkItem.active == True)  # noqa: E712
    stmt = stmt.order_by(LinkItem.sort_order.asc(), LinkItem.created_at.asc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


# ------------------------------------------------------------------------------
# Owner endpoints
# ------------------------------------------------------------------------------
@router.get("/my")
async def get_my_page(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """The workspace's link page with its items, or null when none exists yet."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    page = await _get_my_page(db, workspace.id)
    if page is None:
        return None
    items = await _items_of(db, page.id)
    return _page_payload(page, items)


@router.post("/my")
async def upsert_my_page(
    payload: LinkPageUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Create or update the workspace's page. Slug uniqueness is checked
    against other workspaces so a taken handle is a clear 409, not a 500."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    page = await _get_my_page(db, workspace.id)

    taken = await db.execute(
        select(LinkPage).where(LinkPage.slug == payload.slug, LinkPage.workspace_id != workspace.id)
    )
    if taken.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This slug is already taken.")

    if page is None:
        page = LinkPage(workspace_id=workspace.id, slug=payload.slug)
        db.add(page)

    page.slug = payload.slug
    page.display_name = payload.display_name
    page.headline = payload.headline or None
    page.bio = payload.bio or None
    page.avatar_url = payload.avatar_url or None
    page.theme = payload.theme or "default"
    page.template = payload.template or "classic"
    page.published = payload.published
    await db.commit()
    await db.refresh(page)

    items = await _items_of(db, page.id)
    return _page_payload(page, items)


@router.put("/my/items")
async def replace_my_items(
    payload: LinkItemsReplace,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Full replace of the ordered button list — the client always sends the
    complete list, so ordering can never drift. Click history lives in
    link_events (item_id SET NULLs), so replacing rows loses no analytics."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    page = await _get_my_page(db, workspace.id)
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Create your link page first.")

    await db.execute(delete(LinkItem).where(LinkItem.page_id == page.id))
    for idx, item_in in enumerate(payload.items):
        db.add(LinkItem(
            page_id=page.id,
            label=item_in.label,
            url=item_in.url,
            icon=item_in.icon or None,
            description=item_in.description or None,
            # The sent order wins — a full replace renumbers sort_order from 0
            # so stored ordering can never drift or collide with stale hints.
            sort_order=idx,
            active=item_in.active,
        ))
    await db.commit()

    items = await _items_of(db, page.id)
    return {"items": [_item_payload(i) for i in items]}


@router.get("/my/stats")
async def get_my_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Windowed analytics from the link_events stream: totals + CTR, a
    zero-filled daily series, per-item click breakdown and top referrers."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    page = await _get_my_page(db, workspace.id)
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Create your link page first.")

    start = datetime.utcnow() - timedelta(days=days - 1)
    start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    res = await db.execute(
        select(LinkEvent).where(LinkEvent.page_id == page.id, LinkEvent.created_at >= start)
    )
    events = list(res.scalars().all())

    views = sum(1 for e in events if e.event_type == "view")
    clicks = sum(1 for e in events if e.event_type == "click")
    ctr = round(clicks / views * 100, 1) if views else 0.0

    # Zero-filled daily series so the frontend chart never has gaps.
    buckets: Dict[str, Dict[str, int]] = {}
    for i in range(days):
        buckets[(start + timedelta(days=i)).strftime("%Y-%m-%d")] = {"views": 0, "clicks": 0}
    for e in events:
        day = e.created_at.strftime("%Y-%m-%d")
        if day in buckets:
            if e.event_type == "view":
                buckets[day]["views"] += 1
            elif e.event_type == "click":
                buckets[day]["clicks"] += 1

    # Per-item breakdown over the window; items replaced since are labelled.
    live_items = {i.id: i for i in await _items_of(db, page.id)}
    by_item: Dict[str, int] = {}
    for e in events:
        if e.event_type == "click" and e.item_id:
            by_item[e.item_id] = by_item.get(e.item_id, 0) + 1
    item_rows = []
    for item_id, count in sorted(by_item.items(), key=lambda kv: kv[1], reverse=True):
        item = live_items.get(item_id)
        item_rows.append({
            "id": item_id,
            "label": item.label if item else "(removed item)",
            "url": item.url if item else None,
            "clicks": count,
        })

    referrers: Dict[str, int] = {}
    for e in events:
        if e.event_type == "view":
            key = _normalized_referrer(e.referrer)
            referrers[key] = referrers.get(key, 0) + 1
    top_referrers = [
        {"referrer": k, "views": v}
        for k, v in sorted(referrers.items(), key=lambda kv: kv[1], reverse=True)[:10]
    ]

    return {
        "range_days": days,
        "totals": {"views": views, "clicks": clicks, "ctr": ctr},
        "daily": [{"date": d, "views": b["views"], "clicks": b["clicks"]} for d, b in buckets.items()],
        "items": item_rows,
        "top_referrers": top_referrers,
    }


# ------------------------------------------------------------------------------
# Public endpoints — addressed by slug, unauthenticated, rate-limited
# ------------------------------------------------------------------------------
async def _get_public_page(db: AsyncSession, slug: str) -> LinkPage:
    page_res = await db.execute(select(LinkPage).where(LinkPage.slug == slug.strip().lower()))
    page = page_res.scalar_one_or_none()
    # Unpublished pages answer 404 exactly like missing ones — a public probe
    # must learn nothing about pages the owner chose not to ship.
    if page is None or not page.published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This link page does not exist.")
    return page


@router.get("/public/{slug}")
async def get_public_page(slug: str, db: AsyncSession = Depends(get_db)):
    # Malformed probes are rejected before touching the DB (422, not a 500 —
    # _validate_slug raises ValueError for the pydantic path, so check here).
    if not _SLUG_RE.match((slug or "").strip().lower()):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid slug.")
    page = await _get_public_page(db, slug)
    items = await _items_of(db, page.id, active_only=True)

    return {
        "slug": page.slug,
        "display_name": page.display_name,
        "headline": page.headline,
        "bio": page.bio,
        "avatar_url": page.avatar_url,
        "theme": page.theme,
        "template": page.template,
        "items": [
            {
                "id": i.id,
                "label": i.label,
                "url": i.url,
                "icon": i.icon,
                "description": i.description,
                "sort_order": i.sort_order,
            }
            for i in items
        ],
    }


@router.post("/public/{slug}/event")
async def record_public_event(
    slug: str,
    payload: LinkEventCreate,
    db: AsyncSession = Depends(get_db),
):
    """Record one view/click from the public page and bump the matching
    lifetime counter. Clicks must name an item that belongs to this page."""
    page = await _get_public_page(db, slug)

    item: Optional[LinkItem] = None
    if payload.event_type == "click":
        if not payload.item_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A click event must include item_id.",
            )
        item_res = await db.execute(
            select(LinkItem).where(LinkItem.id == payload.item_id, LinkItem.page_id == page.id)
        )
        item = item_res.scalar_one_or_none()
        if item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This link does not exist on that page.")

    db.add(LinkEvent(
        page_id=page.id,
        item_id=item.id if item else None,
        event_type=payload.event_type,
        referrer=payload.referrer,
    ))
    if item is not None:
        item.clicks_count = (item.clicks_count or 0) + 1
    else:
        page.views_count = (page.views_count or 0) + 1
    await db.commit()

    return {"recorded": True, "event_type": payload.event_type}
