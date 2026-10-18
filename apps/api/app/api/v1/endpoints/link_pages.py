"""Link pages (Linktree-style public profile).

Up to 3 pages per workspace, each with a short public slug, an ordered list
of link buttons, and an append-only event stream powering the stats endpoints.
Owner routes are workspace-scoped like every other module (a page_id that
belongs to another workspace is a plain 404); public routes address the page
by slug only (404 — never a "this page exists but is private" hint) and are
rate-limited via the /link-pages/public/ rule in app.core.rate_limit.
"""

import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.link_page import LinkEvent, LinkItem, LinkPage

router = APIRouter(prefix="/link-pages", tags=["Link Pages"])

# Lowercase alnum plus hyphens/dots, 2-64 chars, must start and end alnum.
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9.\-]{0,62}[a-z0-9]$")
_MAX_ITEMS = 100  # a link page with 100 buttons is already unusable
_MAX_PAGES = 3  # per workspace — the dashboard card grid is designed for 3


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
class LinkPageCreate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    slug: str
    display_name: str = Field(..., min_length=1, max_length=200)
    headline: Optional[str] = Field(None, max_length=200)
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = Field(None, max_length=500)
    theme: str = Field("default", max_length=32)
    template: str = Field("paper", max_length=32)
    background_image_url: Optional[str] = Field(None, max_length=500)
    background_overlay: Optional[float] = Field(None, ge=0.0, le=1.0)
    published: bool = False

    @field_validator("slug")
    @classmethod
    def _check_slug(cls, v: str) -> str:
        return _validate_slug(v)

    @field_validator("name", "display_name", "headline", "bio", "theme", "template", "background_image_url")
    @classmethod
    def _strip(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if isinstance(v, str) else v


class LinkPageUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    slug: Optional[str] = Field(None, max_length=64)
    display_name: Optional[str] = Field(None, min_length=1, max_length=200)
    headline: Optional[str] = Field(None, max_length=200)
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = Field(None, max_length=500)
    theme: Optional[str] = Field(None, max_length=32)
    template: Optional[str] = Field(None, max_length=32)
    background_image_url: Optional[str] = Field(None, max_length=500)
    background_overlay: Optional[float] = Field(None, ge=0.0, le=1.0)
    published: Optional[bool] = None

    @field_validator("slug")
    @classmethod
    def _check_slug(cls, v: Optional[str]) -> Optional[str]:
        return _validate_slug(v) if v is not None else None

    @field_validator("name", "display_name", "headline", "bio", "theme", "template", "background_image_url")
    @classmethod
    def _strip(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if isinstance(v, str) else v


_ITEM_TYPES = ("link", "header", "divider")


class LinkItemIn(BaseModel):
    label: str = Field("", max_length=200)
    url: str = Field("", max_length=500)
    item_type: str = Field("link", max_length=16)
    icon: Optional[str] = Field(None, max_length=40)
    description: Optional[str] = Field(None, max_length=300)
    image_url: Optional[str] = Field(None, max_length=500)
    sort_order: int = 0
    active: bool = True

    @field_validator("item_type")
    @classmethod
    def _check_item_type(cls, v: str) -> str:
        v = (v or "link").strip().lower()
        if v not in _ITEM_TYPES:
            raise ValueError("item_type must be 'link', 'header' or 'divider'")
        return v

    @field_validator("label", "url", "image_url")
    @classmethod
    def _strip(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if isinstance(v, str) else v

    @model_validator(mode="after")
    def _check_shape(self) -> "LinkItemIn":
        if self.item_type == "link":
            # Only http(s) targets: javascript:/data: URLs in a public button
            # are XSS bait, and a bare "foo" link never resolves.
            if not re.match(r"^https?://", self.url or "", re.IGNORECASE):
                raise ValueError("Link URL must start with http:// or https://")
            if not self.label:
                raise ValueError("Label must not be blank")
        else:
            # Headings/dividers carry no target — blank whatever arrived so a
            # crafted url can't hide behind a non-link item.
            self.url = ""
            if self.item_type == "header" and not self.label:
                raise ValueError("Heading text must not be blank")
            self.label = self.label or ""
        return self


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
        "name": page.name or page.display_name,
        "slug": page.slug,
        "display_name": page.display_name,
        "headline": page.headline,
        "bio": page.bio,
        "avatar_url": page.avatar_url,
        "theme": page.theme,
        "template": page.template,
        "background_image_url": page.background_image_url,
        "background_overlay": page.background_overlay,
        "published": bool(page.published),
        "views_count": page.views_count or 0,
        "clicks_count": sum((i.clicks_count or 0) for i in items),
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
        "item_type": item.item_type or "link",
        "icon": item.icon,
        "description": item.description,
        "image_url": item.image_url,
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


def _clean_name(name: Optional[str], display_name: str) -> str:
    """Card title falls back to the public display name when unnamed."""
    return (name or "").strip() or display_name.strip()


async def _get_owned_page(db: AsyncSession, workspace_id: str, page_id: str) -> LinkPage:
    """404 — never a workspace mismatch hint — for foreign or missing ids."""
    res = await db.execute(
        select(LinkPage).where(LinkPage.id == page_id, LinkPage.workspace_id == workspace_id)
    )
    page = res.scalar_one_or_none()
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This link page does not exist.")
    return page


async def _items_of(db: AsyncSession, page_id: str, active_only: bool = False) -> List[LinkItem]:
    res = await db.execute(_items_stmt([page_id], active_only))
    return list(res.scalars().all())


async def _items_by_page(
    db: AsyncSession, page_ids: List[str], active_only: bool = False
) -> Dict[str, List[LinkItem]]:
    """Items for many pages in ONE round trip, keyed by page id."""
    if not page_ids:
        return {}
    res = await db.execute(_items_stmt(page_ids, active_only))
    grouped: Dict[str, List[LinkItem]] = {pid: [] for pid in page_ids}
    for item in res.scalars().all():
        grouped[item.page_id].append(item)
    return grouped


def _items_stmt(page_ids: List[str], active_only: bool):
    stmt = select(LinkItem).where(LinkItem.page_id.in_(page_ids))
    if active_only:
        stmt = stmt.where(LinkItem.active == True)  # noqa: E712
    return stmt.order_by(LinkItem.sort_order.asc(), LinkItem.created_at.asc())


async def _pages_of(db: AsyncSession, workspace_id: str) -> List[LinkPage]:
    res = await db.execute(
        select(LinkPage)
        .where(LinkPage.workspace_id == workspace_id)
        .order_by(LinkPage.created_at.asc())
    )
    return list(res.scalars().all())


async def _stats_payload(db: AsyncSession, pages: List[LinkPage], days: int) -> Dict[str, Any]:
    """Windowed analytics over the given pages (one page or the workspace
    aggregate): totals + CTR, a zero-filled daily series, per-item click
    breakdown and top referrers."""
    start = datetime.utcnow() - timedelta(days=days - 1)
    start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    # Column tuples, not ORM entities — a 90-day window can carry thousands of
    # events and only these four fields are ever read below.
    res = await db.execute(
        select(
            LinkEvent.event_type,
            LinkEvent.created_at,
            LinkEvent.item_id,
            LinkEvent.referrer,
        ).where(
            LinkEvent.page_id.in_([p.id for p in pages]),
            LinkEvent.created_at >= start,
        )
    )
    events = res.all()

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
    live_items: Dict[str, LinkItem] = {}
    for items in (await _items_by_page(db, [p.id for p in pages])).values():
        for i in items:
            live_items[i.id] = i
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
# Owner endpoints
# ------------------------------------------------------------------------------
@router.get("/my")
async def list_my_pages(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """All of the workspace's link pages (0-3), oldest first, items included."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    pages = await _pages_of(db, workspace.id)
    items_by_page = await _items_by_page(db, [p.id for p in pages])
    return [_page_payload(p, items_by_page[p.id]) for p in pages]


@router.post("/my")
async def create_my_page(
    payload: LinkPageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Create one of the workspace's pages (max 3). Slug uniqueness is
    checked globally so a taken handle is a clear 409, not a 500."""
    _, workspace = await get_or_create_user_workspace(db, current_user)

    count_res = await db.execute(
        select(func.count()).select_from(LinkPage).where(LinkPage.workspace_id == workspace.id)
    )
    if (count_res.scalar_one() or 0) >= _MAX_PAGES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You can have up to 3 link pages — delete one to add another.",
        )

    taken = await db.execute(select(LinkPage).where(LinkPage.slug == payload.slug))
    if taken.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This slug is already taken.")

    page = LinkPage(
        workspace_id=workspace.id,
        name=_clean_name(payload.name, payload.display_name),
        slug=payload.slug,
        display_name=payload.display_name,
        headline=payload.headline or None,
        bio=payload.bio or None,
        avatar_url=payload.avatar_url or None,
        theme=payload.theme or "default",
        template=payload.template or "paper",
        background_image_url=payload.background_image_url or None,
        background_overlay=payload.background_overlay,
        published=payload.published,
    )
    db.add(page)
    await db.commit()
    await db.refresh(page)
    return _page_payload(page, [])


@router.put("/my/{page_id}")
async def update_my_page(
    page_id: str,
    payload: LinkPageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Update the editable fields of one owned page; omitted fields stay."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    page = await _get_owned_page(db, workspace.id, page_id)

    if payload.slug is not None and payload.slug != page.slug:
        taken = await db.execute(
            select(LinkPage).where(LinkPage.slug == payload.slug, LinkPage.id != page.id)
        )
        if taken.scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This slug is already taken.")
        page.slug = payload.slug

    if payload.name is not None:
        page.name = _clean_name(payload.name, payload.display_name or page.display_name)
    if payload.display_name is not None:
        page.display_name = payload.display_name
    if "headline" in payload.model_fields_set:
        page.headline = payload.headline or None
    if "bio" in payload.model_fields_set:
        page.bio = payload.bio or None
    if "avatar_url" in payload.model_fields_set:
        page.avatar_url = payload.avatar_url or None
    if payload.theme is not None:
        page.theme = payload.theme
    if payload.template is not None:
        page.template = payload.template
    if "background_image_url" in payload.model_fields_set:
        page.background_image_url = payload.background_image_url or None
    if "background_overlay" in payload.model_fields_set:
        page.background_overlay = payload.background_overlay
    if payload.published is not None:
        page.published = payload.published
    await db.commit()
    await db.refresh(page)

    return _page_payload(page, await _items_of(db, page.id))


@router.delete("/my/{page_id}")
async def delete_my_page(
    page_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Remove one of the workspace's pages; items and events cascade, which
    also frees a slot under the 3-page limit."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    page = await _get_owned_page(db, workspace.id, page_id)
    await db.delete(page)
    await db.commit()
    return {"deleted": True}


@router.put("/my/{page_id}/items")
async def replace_my_items(
    page_id: str,
    payload: LinkItemsReplace,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Full replace of the ordered button list — the client always sends the
    complete list, so ordering can never drift. Click history lives in
    link_events (item_id SET NULLs), so replacing rows loses no analytics."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    page = await _get_owned_page(db, workspace.id, page_id)

    # Fetch existing items for this page to preserve click counts and IDs where possible
    existing_items = await _items_of(db, page.id)
    existing_by_key = {
        (i.label.strip().lower(), i.url.strip(), i.item_type or "link"): i for i in existing_items
    }

    await db.execute(delete(LinkItem).where(LinkItem.page_id == page.id))
    for idx, item_in in enumerate(payload.items):
        old = existing_by_key.get((item_in.label.strip().lower(), item_in.url.strip(), item_in.item_type))
        preserved_id = old.id if old else None
        preserved_clicks = (old.clicks_count or 0) if old else 0

        item_kwargs: Dict[str, Any] = {
            "page_id": page.id,
            "label": item_in.label,
            "url": item_in.url,
            "item_type": item_in.item_type,
            "icon": item_in.icon or None,
            "description": item_in.description or None,
            "image_url": item_in.image_url or None,
            "sort_order": idx,
            "active": item_in.active,
            "clicks_count": preserved_clicks,
        }
        if preserved_id:
            item_kwargs["id"] = preserved_id

        db.add(LinkItem(**item_kwargs))
    page.updated_at = datetime.utcnow()
    await db.commit()

    return {"items": [_item_payload(i) for i in await _items_of(db, page.id)]}


@router.get("/my/stats")
async def get_my_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Aggregate analytics across every page of the workspace."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    pages = await _pages_of(db, workspace.id)
    if not pages:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Create a link page first.")
    return await _stats_payload(db, pages, days)


@router.get("/my/{page_id}/stats")
async def get_page_stats(
    page_id: str,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Windowed analytics for one owned page."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    page = await _get_owned_page(db, workspace.id, page_id)
    return await _stats_payload(db, [page], days)


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
        "background_image_url": page.background_image_url,
        "background_overlay": page.background_overlay,
        "items": [
            {
                "id": i.id,
                "label": i.label,
                "url": i.url,
                "item_type": i.item_type or "link",
                "icon": i.icon,
                "description": i.description,
                "image_url": i.image_url,
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
