from typing import Dict, Any

class AuthService:
    @staticmethod
    def format_user_profile(user_claims: Dict[str, Any]) -> Dict[str, Any]:
        """
        Formats raw Clerk claims into standardized application user profile.
        """
        return {
            "user_id": user_claims.get("user_id") or user_claims.get("sub"),
            "email": user_claims.get("email"),
            "role": user_claims.get("role", "owner"),
            "dev_mode": user_claims.get("dev_mode", False),
        }
