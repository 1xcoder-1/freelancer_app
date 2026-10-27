from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import List, Dict, Any

from app.core.auth import require_authenticated_user
from app.core.database import get_db
from app.core.workspace import get_or_create_user_workspace
from app.models.user_profile import UserProfile

router = APIRouter()

# ------------------------------------------------------------------------------
# Schemas — the tabbed profile document (mirrors the settings editor sections).
# The whole document is validated on the way in; unknown junk can never reach
# the DB column, and profiles saved before a field existed still parse because
# every field defaults.
# ------------------------------------------------------------------------------

class PersonalInfo(BaseModel):
    username: str = Field("", max_length=64)
    bio: str = Field("", max_length=1000)
    company: str = Field("", max_length=255)
    job_title: str = Field("", max_length=255)
    location: str = Field("", max_length=255)
    institution: str = Field("", max_length=255)
    website: str = Field("", max_length=500)
    github: str = Field("", max_length=500)
    linkedin: str = Field("", max_length=500)
    twitter: str = Field("", max_length=500)

class ProfessionalInfo(BaseModel):
    about_me: str = Field("", max_length=2000)
    current_job_role: str = Field("", max_length=255)
    current_company: str = Field("", max_length=255)
    experience_level: str = Field("", max_length=64)
    years_of_experience: int = Field(0, ge=0, le=60)
    current_location: str = Field("", max_length=255)
    preferred_roles: List[str] = Field(default_factory=list)
    preferred_locations: List[str] = Field(default_factory=list)
    min_salary_lpa: float = Field(0, ge=0, le=1000)
    max_salary_lpa: float = Field(0, ge=0, le=1000)
    preferred_work_type: str = Field("", max_length=64)
    notice_period_days: int = Field(0, ge=0, le=365)
    immediate_joiner: bool = False
    ready_to_relocate: bool = False
    technical_skills: List[str] = Field(default_factory=list)

class ExperienceItem(BaseModel):
    id: str = ""
    role: str = Field("", max_length=255)
    company: str = Field("", max_length=255)
    employment_type: str = Field("", max_length=64)
    location: str = Field("", max_length=255)
    location_type: str = Field("ONSITE", max_length=64)
    start_date: str = Field("", max_length=32)
    end_date: str = Field("", max_length=32)  # empty while `current` is set
    current: bool = False
    description: str = Field("", max_length=2000)
    skills: List[str] = Field(default_factory=list)
    attachments: List[str] = Field(default_factory=list)

class CertificationItem(BaseModel):
    id: str = ""
    name: str = Field("", max_length=255)
    issuer: str = Field("", max_length=255)
    issue_date: str = Field("", max_length=32)
    expiry_date: str = Field("", max_length=32)
    credential_id: str = Field("", max_length=255)
    credential_url: str = Field("", max_length=500)
    does_not_expire: bool = False
    attachments: List[str] = Field(default_factory=list)

class EducationItem(BaseModel):
    id: str = ""
    institution: str = Field("", max_length=255)
    education_level: str = Field("BACHELORS", max_length=64)
    degree: str = Field("", max_length=255)
    field_of_study: str = Field("", max_length=255)
    grading_system: str = Field("CGPA", max_length=64)
    grade: str = Field("", max_length=64)
    current: bool = False
    start_year: str = Field("", max_length=32)
    end_year: str = Field("", max_length=32)
    start_date: str = Field("", max_length=32)
    end_date: str = Field("", max_length=32)
    description: str = Field("", max_length=2000)
    attachments: List[str] = Field(default_factory=list)

class ProfileProjectItem(BaseModel):
    id: str = ""
    name: str = Field("", max_length=255)
    project_type: str = Field("PERSONAL", max_length=64)
    description: str = Field("", max_length=2000)
    tech_stack: List[str] = Field(default_factory=list)
    github_url: str = Field("", max_length=500)
    live_url: str = Field("", max_length=500)
    link: str = Field("", max_length=500)
    current: bool = False
    start_date: str = Field("", max_length=32)
    end_date: str = Field("", max_length=32)
    year: str = Field("", max_length=32)
    attachments: List[str] = Field(default_factory=list)

class ProfileContent(BaseModel):
    personal: PersonalInfo = PersonalInfo()
    professional: ProfessionalInfo = ProfessionalInfo()
    experiences: List[ExperienceItem] = Field(default_factory=list)
    certifications: List[CertificationItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    projects: List[ProfileProjectItem] = Field(default_factory=list)

class SaveProfileRequest(BaseModel):
    content: ProfileContent

class ProfileResponse(BaseModel):
    content: ProfileContent

async def _get_or_create_profile(db: AsyncSession, current_user: Dict[str, Any]) -> UserProfile:
    """Resolve (or lazily provision) the authenticated user's profile row."""
    user, _workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = res.scalar_one_or_none()
    if profile is None:
        profile = UserProfile(user_id=user.id, content={})
        db.add(profile)
        try:
            await db.commit()
            await db.refresh(profile)
        except Exception:
            await db.rollback()
            db.expire_all()
            res = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
            profile = res.scalars().first()
            if profile is None:
                raise
    return profile

@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    profile = await _get_or_create_profile(db, current_user)
    # Parse through the Pydantic defaults so an empty/legacy row returns a
    # complete document instead of a sparse one.
    return ProfileResponse(content=ProfileContent(**(profile.content or {})))

@router.put("/me", response_model=ProfileResponse)
async def save_my_profile(
    req: SaveProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
):
    profile = await _get_or_create_profile(db, current_user)
    profile.content = req.content.model_dump()
    await db.commit()
    return ProfileResponse(content=req.content)
