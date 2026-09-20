import secrets
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.project import Project
from app.models.finance import TimeEntry
from app.models.workspace import User
from app.models.report_card import ReportCard

router = APIRouter()

# ------------------------------------------------------------------------------
# Schemas — the editable document the owner writes (mirrors the UI sections)
# ------------------------------------------------------------------------------
class SectionItem(BaseModel):
    id: str = ""
    title: str = ""
    description: str = ""
    link: Optional[str] = None
    icon: str = "zap"          # lucide icon key rendered by the frontend
    color: str = "#ea6311"     # icon chip background

class WritingItem(BaseModel):
    id: str = ""
    title: str = ""
    date: str = ""             # display date, e.g. 24-03-2022
    link: Optional[str] = None

class CardContent(BaseModel):
    name_aka: str = ""                                     # the italic "aka Paaji" part
    bio_paragraphs: List[str] = Field(default_factory=list)
    things_i_do: List[SectionItem] = Field(default_factory=list)
    companies: List[SectionItem] = Field(default_factory=list)
    work_with_me: List[SectionItem] = Field(default_factory=list)
    writings: List[WritingItem] = Field(default_factory=list)

class CardSettings(BaseModel):
    font: str = "geist"        # schibsted | inter | geist
    accent: str = "#f5f5f4"    # dot swatch colour in the settings popover

class SaveContentRequest(BaseModel):
    content: CardContent

class SaveSettingsRequest(BaseModel):
    settings: CardSettings

class CreateShareRequest(BaseModel):
    expiration: str = "never"  # never, 1m, 1h, 24h, 7d, 30d
    include_styling: bool = True

class ShareStatusResponse(BaseModel):
    is_shared: bool
    share_token: Optional[str] = None
    include_styling: bool = True
    expiration: str = "never"
    expires_at: Optional[int] = None
    created_at: Optional[int] = None
    share_url: Optional[str] = None
    status: str  # "active", "expired", "revoked"

class ScopeStat(BaseModel):
    solved: int
    total: int

class DeliveryStats(BaseModel):
    total_solved: int
    total_target: int
    completion_rate_pct: float
    easy: ScopeStat
    medium: ScopeStat
    hard: ScopeStat

class HeatmapCell(BaseModel):
    date: str
    count: int
    level: int

class ReportCardResponse(BaseModel):
    username: str
    full_name: str
    avatar_url: str
    content: CardContent
    settings: CardSettings
    share: ShareStatusResponse
    views_count: int
    # Live, DB-computed stats (never dummy data — reflects the owner's real
    # projects / milestones / time entries in Neon)
    current_streak: int
    max_streak: int
    active_days_count: int
    delivery_stats: DeliveryStats
    heatmap: List[HeatmapCell]

# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------
def _safe_username(email: str) -> str:
    local = email.split("@")[0].strip().lower()
    return "".join(ch if (ch.isalnum() or ch in "-_.") else "-" for ch in local).strip("-")

def _now_ms() -> int:
    return int(datetime.utcnow().timestamp() * 1000)

def _share_response(card: ReportCard) -> ShareStatusResponse:
    now = _now_ms()
    is_shared = bool(card.is_shared)
    status_str = "revoked"
    if is_shared and card.expires_at_ms and now > card.expires_at_ms:
        is_shared = False
        status_str = "expired"
    elif is_shared:
        status_str = "active"
    elif card.expires_at_ms and now > card.expires_at_ms:
        status_str = "expired"
    return ShareStatusResponse(
        is_shared=is_shared,
        share_token=card.share_token,
        include_styling=bool(card.include_styling),
        expiration=card.expiration or "never",
        expires_at=card.expires_at_ms,
        created_at=int(card.created_at.replace(tzinfo=None).timestamp() * 1000) if card.created_at else None,
        share_url=f"/u/{card.username}?token={card.share_token}" if card.share_token else None,
        status=status_str,
    )

async def _get_or_create_card(db: AsyncSession, current_user: Dict[str, Any]) -> tuple[ReportCard, User]:
    """Resolve (or lazily provision) the authenticated user's report card row."""
    user, _workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(select(ReportCard).where(ReportCard.user_id == user.id))
    card = res.scalar_one_or_none()
    if card is None:
        username = _safe_username(user.email) or user.clerk_id
        card = ReportCard(user_id=user.id, username=username, content={}, settings={})
        db.add(card)
        try:
            await db.commit()
            await db.refresh(card)
        except Exception:
            await db.rollback()
            db.expire_all()
            res = await db.execute(select(ReportCard).where(ReportCard.user_id == user.id))
            card = res.scalars().first()
            if card is None:
                raise
    return card, user

# ------------------------------------------------------------------------------
# Live stats aggregated from the owner's real Neon data
# ------------------------------------------------------------------------------
async def _compute_live_stats(db: AsyncSession) -> Dict[str, Any]:
    empty = {
        "current_streak": 0, "max_streak": 0, "active_days_count": 0,
        "delivery_stats": DeliveryStats(
            total_solved=0, total_target=0, completion_rate_pct=0.0,
            easy=ScopeStat(solved=0, total=0),
            medium=ScopeStat(solved=0, total=0),
            hard=ScopeStat(solved=0, total=0),
        ),
        "heatmap": [],
    }
    try:
        res_projects = await db.execute(
            select(Project).options(selectinload(Project.milestones)).order_by(Project.created_at.desc())
        )
        all_projects = res_projects.scalars().all()
        res_time = await db.execute(select(TimeEntry).order_by(TimeEntry.start_time.asc()))
        all_time = res_time.scalars().all()
    except Exception as e:
        print(f"Notice aggregating live report card stats: {e}")
        return empty

    all_milestones: List[Any] = []
    for p in all_projects:
        if p.milestones:
            all_milestones.extend(p.milestones)

    easy_solved = easy_total = med_solved = med_total = hard_solved = hard_total = 0
    for p in all_projects:
        b = p.budget or 0.0
        is_done = (p.status == "completed")
        if b <= 1500:
            easy_total += 1
            if is_done: easy_solved += 1
        elif b <= 5000:
            med_total += 1
            if is_done: med_solved += 1
        else:
            hard_total += 1
            if is_done: hard_solved += 1

    total_solved = easy_solved + med_solved + hard_solved
    total_target = easy_total + med_total + hard_total
    completion_rate = round((total_solved / total_target) * 100, 1) if total_target > 0 else 0.0

    activity_by_date: Dict[str, int] = {}
    for entry in all_time:
        if entry.start_time:
            d_str = entry.start_time.strftime("%Y-%m-%d")
            hours = (entry.duration_seconds or 0) / 3600.0
            activity_by_date[d_str] = activity_by_date.get(d_str, 0) + max(1, int(hours * 2))
    for p in all_projects:
        if p.created_at:
            d_str = p.created_at.strftime("%Y-%m-%d")
            activity_by_date[d_str] = activity_by_date.get(d_str, 0) + 2
    for m in all_milestones:
        if m.created_at:
            d_str = m.created_at.strftime("%Y-%m-%d")
            activity_by_date[d_str] = activity_by_date.get(d_str, 0) + 1

    heatmap: List[HeatmapCell] = []
    base_date = datetime.now() - timedelta(days=364)
    active_days_count = 0
    max_streak = 0
    temp_streak = 0
    for i in range(365):
        date_str = (base_date + timedelta(days=i)).strftime("%Y-%m-%d")
        count = activity_by_date.get(date_str, 0)
        if count > 0:
            active_days_count += 1
            temp_streak += 1
            max_streak = max(max_streak, temp_streak)
        else:
            temp_streak = 0
        level = 4 if count >= 6 else 3 if count >= 4 else 2 if count >= 2 else 1 if count >= 1 else 0
        heatmap.append(HeatmapCell(date=date_str, count=count, level=level))

    return {
        "current_streak": temp_streak,
        "max_streak": max_streak,
        "active_days_count": active_days_count,
        "delivery_stats": DeliveryStats(
            total_solved=total_solved,
            total_target=total_target,
            completion_rate_pct=completion_rate,
            easy=ScopeStat(solved=easy_solved, total=easy_total),
            medium=ScopeStat(solved=med_solved, total=med_total),
            hard=ScopeStat(solved=hard_solved, total=hard_total),
        ),
        "heatmap": heatmap,
    }

def _card_payload(card: ReportCard, user: User, stats: Dict[str, Any]) -> Dict[str, Any]:
    content = CardContent(**(card.content or {}))
    settings = CardSettings(**(card.settings or {}))
    return {
        "username": card.username,
        "full_name": user.full_name or _safe_username(user.email) or card.username,
        "avatar_url": user.avatar_url or "",
        "content": content,
        "settings": settings,
        "share": _share_response(card),
        "views_count": card.views_count or 0,
        **stats,
    }

# ------------------------------------------------------------------------------
# Owner endpoints — everything persists in Neon
# ------------------------------------------------------------------------------
@router.get("/me", response_model=ReportCardResponse)
async def get_my_report_card(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    card, user = await _get_or_create_card(db, current_user)
    stats = await _compute_live_stats(db)
    return _card_payload(card, user, stats)

@router.put("/me/content", response_model=ReportCardResponse)
async def save_my_content(
    req: SaveContentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    card, user = await _get_or_create_card(db, current_user)
    card.content = req.content.model_dump()
    await db.commit()
    stats = await _compute_live_stats(db)
    return _card_payload(card, user, stats)

@router.put("/me/settings", response_model=ReportCardResponse)
async def save_my_settings(
    req: SaveSettingsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    card, user = await _get_or_create_card(db, current_user)
    card.settings = req.settings.model_dump()
    await db.commit()
    stats = await _compute_live_stats(db)
    return _card_payload(card, user, stats)

# ------------------------------------------------------------------------------
# Share endpoints — DB-backed so links survive restarts
# ------------------------------------------------------------------------------
@router.get("/share/status", response_model=ShareStatusResponse)
async def get_share_status(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    card, _user = await _get_or_create_card(db, current_user)
    return _share_response(card)

@router.post("/share", response_model=ShareStatusResponse)
async def create_share_link(
    req: CreateShareRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    card, _user = await _get_or_create_card(db, current_user)
    now_ms = _now_ms()
    expires_at = None
    if req.expiration == "1m":
        expires_at = now_ms + 60 * 1000
    elif req.expiration == "1h":
        expires_at = now_ms + 3600 * 1000
    elif req.expiration == "24h":
        expires_at = now_ms + 24 * 3600 * 1000
    elif req.expiration == "7d":
        expires_at = now_ms + 7 * 24 * 3600 * 1000
    elif req.expiration == "30d":
        expires_at = now_ms + 30 * 24 * 3600 * 1000

    card.share_token = secrets.token_urlsafe(16)
    card.is_shared = 1
    card.expiration = req.expiration
    card.expires_at_ms = expires_at
    card.include_styling = 1 if req.include_styling else 0
    await db.commit()
    return _share_response(card)

@router.delete("/share")
async def revoke_share_link(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    card, _user = await _get_or_create_card(db, current_user)
    card.is_shared = 0
    card.expires_at_ms = None
    # Destroy the token itself, not just the flag: an old link must never become
    # live again if sharing is re-enabled without minting a fresh token.
    card.share_token = None
    await db.commit()
    return {"success": True, "message": "Share link revoked securely"}

# ------------------------------------------------------------------------------
# Public view — served only with a valid, unexpired share token
# ------------------------------------------------------------------------------
@router.get("/public/{username}", response_model=ReportCardResponse)
async def get_public_report_card(username: str, token: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ReportCard).where(ReportCard.username == username.lower()))
    card = res.scalar_one_or_none()
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This report card does not exist.")

    now = _now_ms()
    if not card.is_shared:
        if card.expires_at_ms and now > card.expires_at_ms:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="This share link has expired.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This report card is currently private or share link revoked.",
        )
    if card.expires_at_ms and now > card.expires_at_ms:
        card.is_shared = 0
        await db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="This share link has expired.")
    if not token or token != card.share_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or missing share token.")

    user_res = await db.execute(select(User).where(User.id == card.user_id))
    user = user_res.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Owner of this report card was not found.")

    # Real-time view counter for the shared card
    card.views_count = (card.views_count or 0) + 1
    await db.commit()

    stats = await _compute_live_stats(db)
    return _card_payload(card, user, stats)
