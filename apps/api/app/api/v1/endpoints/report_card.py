import secrets
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.quota import plan_context
from app.core.workspace import get_or_create_user_workspace
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
    icon: str = "zap"          # lucide icon key or brand logo key rendered by the frontend
    color: str = "#ea6311"     # icon chip background
    logo_url: Optional[str] = None  # optional custom logo image URL or SVG identifier

class WritingItem(BaseModel):
    id: str = ""
    title: str = ""
    date: str = ""             # display date, e.g. 24-03-2022
    link: Optional[str] = None

class ProjectItem(BaseModel):
    id: str = ""
    title: str = ""
    description: str = ""
    category: str = "Web Dev"  # Web Dev | App Dev | UI/UX Design | Graphic Design | Branding | AI & Automation
    link: Optional[str] = None
    icon: str = "globe"
    color: str = "#3b82f6"
    logo_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    year: str = ""

class QuoteItem(BaseModel):
    text: str = ""
    author: str = ""
    emoji: str = "✨"

class ExperienceItem(BaseModel):
    id: str = ""
    role: str = ""
    company: str = ""
    period: str = ""           # display string, e.g. "2022 — Present"
    description: str = ""
    link: Optional[str] = None

class CertificateItem(BaseModel):
    id: str = ""
    name: str = ""
    issuer: str = ""
    year: str = ""
    link: Optional[str] = None

class FooterContent(BaseModel):
    signature_name: str = ""
    code_link: str = ""
    video_link: str = ""
    inspired_by_name: str = ""
    inspired_by_link: str = ""

class CardContent(BaseModel):
    name_aka: str = ""                                     # the italic "aka Paaji" part
    bio_paragraphs: List[str] = Field(default_factory=list)
    things_i_do: List[SectionItem] = Field(default_factory=list)
    companies: List[SectionItem] = Field(default_factory=list)
    work_with_me: List[SectionItem] = Field(default_factory=list)
    writings: List[WritingItem] = Field(default_factory=list)
    inspirations: List[SectionItem] = Field(default_factory=list)
    inspiration_intro: List[str] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)
    projects_intro: List[str] = Field(default_factory=list)
    experience: List[ExperienceItem] = Field(default_factory=list)
    certificates: List[CertificateItem] = Field(default_factory=list)
    # False until the owner picked a template on the New Portfolio screen; the
    # dashboard landing uses it to route between picker and roster.
    initialized: bool = False
    quote: Optional[QuoteItem] = None
    footer: Optional[FooterContent] = None

# Profile templates: "classic" is the original card; "folio" is the second
# design. Legacy theme ids saved before the rework collapse into "classic".
_TEMPLATE_IDS = ("classic", "folio")
_LEGACY_TEMPLATE_IDS = ("default", "editorial", "midnight", "warm")

class CardSettings(BaseModel):
    font: str = "geist"        # schibsted | inter | geist
    accent: str = "#f5f5f4"    # dot swatch colour in the settings popover
    theme: str = "classic"

    @field_validator("theme")
    @classmethod
    def _check_theme(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v in _TEMPLATE_IDS:
            return v
        if v in _LEGACY_TEMPLATE_IDS:
            return "classic"
        raise ValueError("theme must be one of: classic, folio")

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

class ReportCardResponse(BaseModel):
    username: str
    full_name: str
    avatar_url: str
    content: CardContent
    settings: CardSettings
    share: ShareStatusResponse

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

async def _get_or_create_card(db: AsyncSession, current_user: Dict[str, Any]) -> tuple[ReportCard, User, str]:
    """Resolve (or lazily provision) the authenticated user's report card row.

    Returns the workspace id too so stats stay scoped to the owner's own data.
    """
    user, workspace = await get_or_create_user_workspace(db, current_user)
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
    return card, user, workspace.id


def _card_payload(card: ReportCard, user: User) -> Dict[str, Any]:
    content = CardContent(**(card.content or {}))
    settings = CardSettings(**(card.settings or {}))
    return {
        "username": card.username,
        "full_name": user.full_name or _safe_username(user.email) or card.username,
        "avatar_url": user.avatar_url or "",
        "content": content,
        "settings": settings,
        "share": _share_response(card),
    }

# ------------------------------------------------------------------------------
# Owner endpoints — everything persists in Neon
# ------------------------------------------------------------------------------
@router.get("/me", response_model=ReportCardResponse)
async def get_my_report_card(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    card, user, _workspace_id = await _get_or_create_card(db, current_user)
    return _card_payload(card, user)


@router.put("/me/content", response_model=ReportCardResponse)
async def save_my_content(
    req: SaveContentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    card, user, workspace_id = await _get_or_create_card(db, current_user)
    # One portfolio per account on every plan: the report_cards row IS the
    # portfolio and is created once by _get_or_create_card, so no second row
    # can ever be written through this API — there is nothing to enforce here
    # (passing used=1 against the limit of 1 would 402 every save).
    card.content = req.content.model_dump()
    await db.commit()
    return _card_payload(card, user)

@router.put("/me/settings", response_model=ReportCardResponse)
async def save_my_settings(
    req: SaveSettingsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    card, user, _workspace_id = await _get_or_create_card(db, current_user)
    card.settings = req.settings.model_dump()
    await db.commit()
    return _card_payload(card, user)

# ------------------------------------------------------------------------------
# Share endpoints — DB-backed so links survive restarts
# ------------------------------------------------------------------------------
@router.get("/share/status", response_model=ShareStatusResponse)
async def get_share_status(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    card, _user, _ws = await _get_or_create_card(db, current_user)
    return _share_response(card)

@router.post("/share", response_model=ShareStatusResponse)
async def create_share_link(
    req: CreateShareRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    card, _user, _ws = await _get_or_create_card(db, current_user)
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
    card, _user, _ws = await _get_or_create_card(db, current_user)
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

    return _card_payload(card, user)
