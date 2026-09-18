from fastapi import APIRouter, Depends
from typing import Dict, Any, Optional
from app.core.auth import get_current_user, require_authenticated_user
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.get("/me")
async def get_my_profile(
    user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    Returns current Clerk authenticated user profile.
    """
    return {
        "status": "authenticated",
        "provider": "Clerk",
        "user": AuthService.format_user_profile(user)
    }

@router.get("/status")
async def get_auth_config_status(
    user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Public auth status check endpoint.
    """
    return {
        "clerk_configured": True,
        "authenticated": user is not None,
        "user": user
    }
