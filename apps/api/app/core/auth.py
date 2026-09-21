import asyncio
import base64
import json
from typing import Optional, Dict, Any

import jwt
from jwt import PyJWKClient
from fastapi import Request, HTTPException, Security, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

security_scheme = HTTPBearer(auto_error=False)

# ------------------------------------------------------------------------------
# Clerk JWT Verification (cryptographic, via Clerk public JWKS)
# ------------------------------------------------------------------------------
# Public signing keys are served by the Clerk instance itself at
#   {issuer}/.well-known/jwks.json          (preferred, public)
#   https://{instance-slug}.clerk.accounts.dev/.well-known/jwks.json
#                                           (slug derived from CLERK_PUBLISHABLE_KEY)

def _issuer_from_publishable_key() -> Optional[str]:
    """
    Clerk v2 publishable keys (pk_test_/pk_live_) embed a base64 JSON payload
    containing the instance slug ('i') and/or frontend origins ('url').
    """
    pk = (settings.CLERK_PUBLISHABLE_KEY or "").strip()
    if not pk or "_" not in pk:
        return None
    try:
        payload_b64 = pk.split("_", 2)[2]
        payload_b64 += "=" * (-len(payload_b64) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception:
        return None

    slug = data.get("i")
    if slug:
        return f"https://{slug}.clerk.accounts.dev"
    url = data.get("url")
    if isinstance(url, str) and url.startswith("http"):
        return url.rstrip("/")
    for origin in data.get("origins") or []:
        if isinstance(origin, str) and origin.startswith("http"):
            return origin.rstrip("/")
    return None


def _resolve_jwks_url() -> str:
    issuer = (settings.CLERK_ISSUER or "").strip().rstrip("/")
    if not issuer:
        issuer = _issuer_from_publishable_key() or ""
    if issuer:
        return f"{issuer}/.well-known/jwks.json"
    # Last resort (only used by legacy Clerk projects without instance URL)
    return "https://api.clerk.com/v1/jwks"


_CLERK_ISSUER = (settings.CLERK_ISSUER or "").strip().rstrip("/")
_JWKS_URL = _resolve_jwks_url()

# Lazily created, module-level client (caches the JWKS set across requests)
_jwk_client: Optional[PyJWKClient] = None


def _get_jwk_client() -> PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        _jwk_client = PyJWKClient(_JWKS_URL, cache_jwk_set=True, lifespan=600)
    return _jwk_client


async def warm_jwks() -> None:
    """
    Pre-fetch and cache Clerk's signing keys at startup.

    Without this, the first authenticated request after every (re)start pays a
    blocking HTTPS round trip to the issuer's JWKS endpoint, which shows up as
    a multi-second dashboard open. Never raises — a failed warm-up just leaves
    the lazy per-request fetch as the fallback.
    """
    try:
        await asyncio.to_thread(_get_jwk_client().get_signing_keys)
    except Exception as exc:  # non-fatal by design
        print(f"JWKS warm-up notice (will retry lazily per request): {exc}")


def dev_auth_enabled() -> bool:
    """
    Dev/sandbox auth (mock tokens, keyless fallback) is ONLY allowed when BOTH:
    - APP_ENV is a development value
    - ALLOW_DEV_AUTH=true is explicitly set in the environment
    In production this is always False; there is no way to accidentally
    enable auth bypass.
    """
    return (
        settings.APP_ENV.strip().lower() in ("development", "dev", "local")
        and bool(settings.ALLOW_DEV_AUTH)
    )


def _extract_profile(claims: Dict[str, Any]) -> Dict[str, Any]:
    user_id = claims.get("sub")
    email = (
        claims.get("email")
        or claims.get("primary_email_address")
        or (claims.get("user") or {}).get("email")
        or f"{user_id}@freelancebook.com"
    )
    name = claims.get("name") or (claims.get("user") or {}).get("name")
    # Clerk puts the profile picture in the `picture` claim; keeping it here lets
    # the report card show the real avatar (owner view and public share view).
    avatar_url = claims.get("picture") or (claims.get("user") or {}).get("avatar_url")
    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "avatar_url": avatar_url,
        "raw_claims": claims,
    }


async def verify_clerk_token(token: str) -> Dict[str, Any]:
    """
    [SECURE] Validates Clerk JWT tokens and extracts user claims.

    Verification order:
    1. Real Clerk session tokens are verified cryptographically against
       Clerk's public JWKS (RS256 signature + strict exp validation).
       Unsigned / forged / expired tokens are ALWAYS rejected — no fallback.
    2. Sandbox/mock identities — only when dev_auth_enabled() is True.
    """
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization Bearer token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    clean_token = token.strip()
    if clean_token.startswith("Bearer "):
        clean_token = clean_token[7:].strip()

    # --- 1. Cryptographic verification of real Clerk JWTs ---------------------
    if clean_token.count(".") == 2:
        try:
            # PyJWKClient performs a blocking HTTPS fetch on cache miss/cold
            # start, so run it off the event loop.
            signing_key = await asyncio.to_thread(
                _get_jwk_client().get_signing_key_from_jwt, clean_token
            )
            claims = jwt.decode(
                clean_token,
                signing_key.key,
                algorithms=["RS256"],
                leeway=60,  # 60s clock skew grace period
                options={"require": ["exp", "sub"]},
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication token has expired. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        except jwt.PyJWTError:
            # Bad signature, malformed claims, unknown kid, etc. — hard reject.
            # NOTE: we intentionally do NOT fall back to unverified decoding.
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or unauthorized authentication token.",
                headers={"WWW-Authenticate": "Bearer"}
            )

        user_id = claims.get("sub")
        # Clerk user ids are shaped like "user_2abc..."; reject anything else
        # so a token forged for another purpose can't map onto our identity.
        if not user_id or not str(user_id).startswith("user_"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or unauthorized authentication token.",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Optional second layer: enforce expected issuer when configured
        if _CLERK_ISSUER:
            issuer = (claims.get("iss") or "").rstrip("/")
            if issuer and issuer != _CLERK_ISSUER:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication token issuer is not trusted.",
                    headers={"WWW-Authenticate": "Bearer"}
                )

        return _extract_profile(claims)

    # --- 2. Dev/Sandbox mock identities (explicitly opt-in, dev only) ---------
    if dev_auth_enabled():
        if clean_token.startswith("mock_token_") or clean_token.startswith("test_"):
            dev_user_id = clean_token
            return {
                "user_id": dev_user_id,
                "email": f"{dev_user_id}@freelancebook.com",
                "role": "admin",
                "dev_mode": True
            }

        # Developer fallback when Clerk keys aren't configured locally
        if clean_token == "mock_token" and not settings.CLERK_SECRET_KEY:
            return {
                "user_id": "user_dev_clerk_demo",
                "email": "developer@freelancebook.com",
                "role": "admin",
                "dev_mode": True
            }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or unauthorized authentication token.",
        headers={"WWW-Authenticate": "Bearer"}
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme)
) -> Optional[Dict[str, Any]]:
    """
    FastAPI dependency for optional or soft user authentication.
    """
    if not credentials or not credentials.credentials:
        return None
    try:
        return await verify_clerk_token(credentials.credentials)
    except HTTPException:
        return None


async def require_authenticated_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme)
) -> Dict[str, Any]:
    """
    FastAPI dependency enforcing strict authentication requirement.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return await verify_clerk_token(credentials.credentials)
