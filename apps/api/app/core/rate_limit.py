import time
import hashlib
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
    # S5: only the ANONYMOUS public profile share ({username}) gets the
    # brute-force ceiling. The owner's authenticated /report-card/me* and
    # /report-card/share* routes fall back to the generous global rule so a
    # rapidly refreshing owner is never 429ed by the public-token bucket.
    ("/api/v1/report-card/public/", (30, 60)),
    # SE1 (V1): the public payment page is addressed by token and can record a
    # payment, so it gets the same brute-force ceiling as the other token routes.
    ("/api/v1/invoices/public/", (30, 60)),
    # PL5: the anonymous read-only board share is token-addressed like the rest.
    ("/api/v1/planner/public/", (30, 60)),
]
DEFAULT_RULE = (240, 60)  # generous ceiling for authenticated dashboard usage

# SE9: authenticated writes get their own per-credential budget so one tenant
# flooding POST/PUT/PATCH/DELETE can never exhaust another tenant's headroom on
# a shared egress IP. Reads keep the softer global (IP) ceiling above.
_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
AUTH_WRITE_RULE = (120, 60)

_BUCKETS: Dict[str, Deque[float]] = defaultdict(deque)
_MAX_BUCKETS = 10_000  # safety valve against unbounded memory growth


def _client_ip(request: Request) -> str:
    # SE9: trust the headers the edge proxy SETS/OVERWRITES first (Cloudflare's
    # cf-connecting-ip, then x-real-ip); only fall back to the client-spoofable
    # x-forwarded-for left-most entry, then the raw socket peer. Reading in this
    # order hardens the public-token brute-force ceiling against header forgery.
    for header in ("cf-connecting-ip", "x-real-ip"):
        value = request.headers.get(header)
        if value:
            return value.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _principal(request: Request) -> Optional[str]:
    # A stable, non-reversible identity for the per-tenant write bucket. Hash the
    # bearer token so we never store the credential itself in the key.
    auth = request.headers.get("authorization") or ""
    if not auth:
        return None
    return hashlib.sha256(auth.encode("utf-8", errors="ignore")).hexdigest()[:16]


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


def _hit(key: str, limit: int, window: float, now: float) -> int:
    """Prune + evaluate one bucket. Returns 0 if allowed (does NOT yet record),
    or the retry-after seconds if the limit is already reached."""
    bucket = _BUCKETS[key]
    while bucket and bucket[0] <= now - window:
        bucket.popleft()
    if len(bucket) >= limit:
        return max(1, int(window - (now - bucket[0])))
    return 0


async def enforce_rate_limit(request: Request) -> None:
    """Raises HTTP 429 when the client exceeds the limit for this path."""
    if request.method == "OPTIONS":  # never throttle CORS preflights
        return

    now = time.monotonic()
    (limit, window), rule = _rule_for(request.url.path)
    ip = _client_ip(request)
    is_public = rule != "global"

    # Primary bucket: per-IP, per-rule (brute-force ceiling on public tokens,
    # generous global ceiling for authenticated reads).
    primary_key = f"{ip}::{rule}"
    retry = _hit(primary_key, limit, window, now)

    # SE9 secondary bucket: authenticated mutations ALSO get a per-credential
    # budget, so writes are isolated per tenant rather than sharing an IP bucket.
    write_key: Optional[str] = None
    if not is_public and request.method in _WRITE_METHODS:
        principal = _principal(request)
        if principal:
            write_key = f"auth-write::{principal}"
            retry = max(retry, _hit(write_key, AUTH_WRITE_RULE[0], AUTH_WRITE_RULE[1], now))

    if retry:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please slow down.",
            headers={"Retry-After": str(retry)},
        )

    _BUCKETS[primary_key].append(now)
    if write_key:
        _BUCKETS[write_key].append(now)
    _cleanup(now, window)
