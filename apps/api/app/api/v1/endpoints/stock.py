"""Unsplash stock photo proxy for link-page backgrounds.

The Unsplash access key lives server-side only; the browser never sees it.
Responses are cached in-process per (query, page) for a few minutes so
typing in the picker doesn't burn the API quota. Without a key configured
the endpoint returns 501 and the frontend falls back to uploads only.
"""

import time
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import require_authenticated_user
from app.core.config import settings

router = APIRouter(prefix="/stock", tags=["Stock Media"])

_CACHE_TTL_SECONDS = 300
_CACHE_MAX_ENTRIES = 120
_cache: Dict[str, tuple[float, Any]] = {}

# Only response URLs from these hosts are ever returned to clients.
_ALLOWED_IMAGE_HOSTS = ("images.unsplash.com",)


def _cache_get(key: str) -> Optional[Any]:
    entry = _cache.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if time.monotonic() > expires_at:
        _cache.pop(key, None)
        return None
    return value


def _cache_put(key: str, value: Any) -> None:
    if len(_cache) >= _CACHE_MAX_ENTRIES:
        # Drop the oldest entries; exact eviction policy doesn't matter.
        for stale in list(_cache)[: len(_cache) - _CACHE_MAX_ENTRIES + 1]:
            _cache.pop(stale, None)
    _cache[key] = (time.monotonic() + _CACHE_TTL_SECONDS, value)


@router.get("/images", summary="Search stock photos (Unsplash proxy)")
async def search_stock_images(
    q: str = Query("nature", min_length=1, max_length=80),
    page: int = Query(1, ge=1, le=10),
    per_page: int = Query(12, ge=1, le=30),
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
) -> Dict[str, Any]:
    access_key = (settings.UNSPLASH_ACCESS_KEY or "").strip()
    if not access_key:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Stock photo search is not configured on this server.",
        )

    cache_key = f"{q.strip().lower()}|{page}|{per_page}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.unsplash.com/search/photos",
                params={"query": q, "page": page, "per_page": per_page, "orientation": "portrait"},
                headers={"Authorization": f"Client-ID {access_key}"},
            )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the stock photo service. Please try again.",
        )

    if resp.status_code == 401 or resp.status_code == 403:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The stock photo service rejected the configured key.",
        )
    if resp.status_code == 429:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Stock photo search is rate limited right now. Please try again in a minute.",
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stock photo search failed. Please try again.",
        )

    results = resp.json().get("results", [])
    images = []
    for r in results:
        urls = r.get("urls", {}) or {}
        regular = urls.get("regular") or ""
        thumb = urls.get("small") or urls.get("thumb") or ""
        if not regular.startswith("https://"):
            continue
        # Defense in depth: never echo arbitrary hostnames back to the client.
        host = httpx.URL(regular).host
        if host not in _ALLOWED_IMAGE_HOSTS:
            continue
        images.append(
            {
                "id": r.get("id"),
                "url": regular,
                "thumb": thumb,
                "description": (r.get("description") or r.get("alt_description") or "")[:140],
                "photographer": r.get("user", {}).get("name", ""),
                "photographer_url": r.get("user", {}).get("links", {}).get("html", ""),
            }
        )

    payload = {"images": images, "total": resp.json().get("total", len(images))}
    _cache_put(cache_key, payload)
    return payload
