import time
from collections import defaultdict, deque
from typing import Deque, Dict, Optional, Tuple

from fastapi import HTTPException, Request, status

_RULES = [
    # Public token endpoints — lowest limits (brute-force protection).
    # Tokens are 122-128 bits, so 30 guesses/min makes guessing infeasible.
    ("/api/v1/intake/public/", (30, 60)),
    ("/api/v1/booking/public/", (30, 60)),
    ("/api/v1/contracts/public/", (30, 60)),
    ("/api/v1/projects/portal/", (30, 60)),
    ("/api/v1/report-card/", (30, 60)),
]
DEFAULT_RULE = (240, 60)  # generous ceiling for authenticated dashboard usage

_BUCKETS: Dict[str, Deque[float]] = defaultdict(deque)
_MAX_BUCKETS = 10_000  # safety valve against unbounded memory growth


def _client_ip(request: Request) -> str:
    # Behind a proxy (Vercel/Nginx/Cloudflare) the real client IP arrives in
    # X-Forwarded-For; take the first (original client) entry.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rule_for(path: str) -> Tuple[Tuple[int, int], str]:
    for prefix, rule in _RULES:
        if path.startswith(prefix):
            return rule, prefix
    return DEFAULT_RULE, "global"


def _cleanup(now: float, window: float) -> None:
    # Drop stale buckets when the store grows too large
    if len(_BUCKETS) <= _MAX_BUCKETS:
        return
    stale = [key for key, bucket in _BUCKETS.items() if not bucket or bucket[-1] <= now - window]
    for key in stale:
        _BUCKETS.pop(key, None)


async def enforce_rate_limit(request: Request) -> None:
    """Raises HTTP 429 when the client exceeds the limit for this path."""
    if request.method == "OPTIONS":  # never throttle CORS preflights
        return

    (limit, window), rule = _rule_for(request.url.path)
    key = f"{_client_ip(request)}::{rule}"
    now = time.monotonic()

    bucket = _BUCKETS[key]
    while bucket and bucket[0] <= now - window:
        bucket.popleft()

    if len(bucket) >= limit:
        retry_after = max(1, int(window - (now - bucket[0])))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please slow down.",
            headers={"Retry-After": str(retry_after)},
        )

    bucket.append(now)
    _cleanup(now, window)
