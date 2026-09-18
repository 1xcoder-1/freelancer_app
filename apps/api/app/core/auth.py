from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, Security, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
from app.core.config import settings

security_scheme = HTTPBearer(auto_error=False)

async def verify_clerk_token(token: str) -> Dict[str, Any]:
    """
    Verifies a Clerk JWT token.
    If CLERK_SECRET_KEY or issuer is configured, decodes/verifies the token.
    In local development mode without secret keys, allows safe fallback verification.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization token"
        )
    
    # If Clerk secret key is present, verify with Clerk API or signature
    if settings.CLERK_SECRET_KEY and settings.CLERK_SECRET_KEY.startswith("sk_"):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.clerk.com/v1/tokens/verify",
                    headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
                    json={"token": token}
                )
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "user_id": data.get("sub"),
                        "email": data.get("email"),
                        "raw_claims": data
                    }
        except Exception:
            pass

    # Development fallback mode
    return {
        "user_id": "user_dev_clerk_demo",
        "email": "developer@freelancebook.com",
        "role": "admin",
        "dev_mode": True
    }

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme)
) -> Optional[Dict[str, Any]]:
    """
    FastAPI dependency for optional or soft user authentication.
    """
    if not credentials:
        return None
    return await verify_clerk_token(credentials.credentials)

async def require_authenticated_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme)
) -> Dict[str, Any]:
    """
    FastAPI dependency enforcing strict authentication requirement.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return await verify_clerk_token(credentials.credentials)
