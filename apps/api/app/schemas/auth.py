from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr

class UserProfileSchema(BaseModel):
    user_id: str
    email: EmailStr
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str = "owner"

class AuthStatusResponseSchema(BaseModel):
    status: str = "authenticated"
    provider: str = "Clerk"
    user: Dict[str, Any]
