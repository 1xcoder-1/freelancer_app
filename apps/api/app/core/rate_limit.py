"""Two-layer request throttling.

Layer 1 — the edge (``enforce_rate_limit``, runs before anything else): an
IP-keyed flood ceiling that needs no identity. Public share-token routes get a
strict 30/min budget because they are addressable by a token we do not want
brute-forced; every other route gets a generous per-IP ceiling so a busy
dashboard, a polling analytics tab or a shared office NAT never trips.

Layer 2 — the tenant (``enforce_plan_rate_limit``, a dependency that runs after
the Clerk token is verified): the budget the plan actually sells, read from the
same ``rate`` block of config/pricing.json that the marketing page advertises.
Keyed by Clerk id rather than IP, so one tenant's runaway script cannot drink
another tenant's headroom, and an upgrade takes effect immediately.

Both layers speak the same headers on every response, throttled or not:

    X-RateLimit-Limit      requests allowed in the current window
    X-RateLimit-Remaining  tokens left right now
    X-RateLimit-Reset      unix seconds at which the bucket is full again

and 429s additionally carry ``Retry-After`` (seconds) plus a JSON body with a
``code`` so the web client can show "slow down, retry in 12s" instead of a
generic failure toast.

Algorithm: token bucket, not a fixed window. A fixed window lets a client burn
2x its quota across a boundary (30 requests at 09:99:59 and 30 at 10:00:00
against a 30/min rule) and punishes honest steady traffic with a cliff; a token
bucket refills continuously, so ``burst`` is the only spike allowed and the
ceiling is the sustained rate.

All bucket arithmetic is synchronous with no await inside the critical section,
so it is atomic per event loop and needs no lock. Multi-process deployments
divide each ceiling by worker count if per-process accuracy matters.
"""

import hashlib
import math
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.plans import rate_for

_READ_METHODS = {"GET", "HEAD"}
_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Public token endpoints — lowest limits (brute-force protection).
# Tokens are 122-128 bits, so 30 guesses/min makes guessing infeasible.
_PUBLIC_RULES = [
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
    # Link pages: slug-addressed public profile + its view/click beacon.
    ("/api/v1/link-pages/public/", (30, 60)),
]
_PUBLIC_PREFIXES = tuple(prefix for prefix, _ in _PUBLIC_RULES)

# Flood ceiling for layer 1. Paid tenants are governed by their own plan budget
# (layer 2), so these exist only to cap abuse: they sit far above the top plan
# (Pro = 600 reads / 150 writes per minute), which means one tenant can never
# spend the shared-IP headroom of a second tenant behind the same NAT.
_IP_READ_FLOOR_PER_MIN = 1_800
_IP_WRITE_FLOOR_PER_MIN = 600
_IP_FLOOD_BURST = 300

# Scarce-resource routes. They get the plan's AI budget instead of the generic
# write budget — and are not charged twice, because an AI call is a write whose
# real cost is the model, not the row.
_AI_ROUTES = ("/api/v1/book-ai/ask", "/api/v1/proposals/ai-generate")

# key -> [tokens, last_refill_monotonic]. Named _BUCKETS so the existing test
# fixtures keep clearing it between tests.
_BUCKETS: Dict[str, List[float]] = {}
_MAX_BUCKETS = 20_000
_SWEEP_EVERY = 1_024
_SEEN_REQUESTS = 0


@dataclass(frozen=True)
class RateOutcome:
    """Result of one bucket evaluation, enough to build the response headers."""

    kind: str
    limit: int
    remaining: int
    retry_after: int
    reset_at: int
    tier: Optional[str] = None


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


def _public_rule(path: str) -> Optional[Tuple[int, int]]:
    for prefix, rule in _PUBLIC_RULES:
        if path.startswith(prefix):
            return rule
    return None


def _sweep(now: float) -> None:
    """Bound the store: drop buckets idle long enough to have refilled, i.e.
    ones that carry no state worth keeping. Runs every N requests so the
    cleanup itself stays off the hot path."""
    global _SEEN_REQUESTS
    _SEEN_REQUESTS += 1
    if len(_BUCKETS) <= _MAX_BUCKETS or _SEEN_REQUESTS % _SWEEP_EVERY:
        return
    for key in [k for k, (_, updated) in _BUCKETS.items() if updated <= now - 300.0]:
        _BUCKETS.pop(key, None)


def take(key: str, per_min: int, burst: int, now: Optional[float] = None) -> Tuple[bool, int, int, int]:
    """Consume one token. Returns (allowed, remaining, retry_after, reset_at).

    ``per_min`` is the sustained rate and ``burst`` the bucket capacity, so a
    client can spike to ``burst`` once and is then held to ``per_min``.
    ``retry_after`` is seconds until the next token; ``reset_at`` is the unix
    time the bucket is full again.
    """
    now = time.monotonic() if now is None else now
    capacity = max(1.0, float(burst))
    refill_per_sec = max(1, int(per_min)) / 60.0

    bucket = _BUCKETS.get(key)
    if bucket is None:
        bucket = [capacity, now]
        _BUCKETS[key] = bucket
    else:
        bucket[0] = min(capacity, bucket[0] + (now - bucket[1]) * refill_per_sec)
        bucket[1] = now

    if bucket[0] < 1.0:
        retry_after = max(1, math.ceil((1.0 - bucket[0]) / refill_per_sec))
        reset_in = max(retry_after, math.ceil((capacity - bucket[0]) / refill_per_sec))
        return False, 0, retry_after, int(time.time()) + reset_in

    bucket[0] -= 1.0
    _sweep(now)
    reset_in = math.ceil((capacity - bucket[0]) / refill_per_sec)
    return True, int(bucket[0]), 0, int(time.time()) + max(1, reset_in)


def _record(request: Request, outcome: RateOutcome) -> None:
    """Keep the most restrictive outcome so the response headers tell the client
    the truth about the budget it just spent."""
    seen: List[RateOutcome] = getattr(request.state, "rate_outcomes", None) or []
    seen.append(outcome)
    request.state.rate_outcomes = seen


def rate_headers(request: Request) -> Dict[str, str]:
    """Headers for the tightest budget this request touched (empty if none)."""
    seen: List[RateOutcome] = getattr(request.state, "rate_outcomes", None) or []
    if not seen:
        return {}
    tight = min(seen, key=lambda o: o.remaining)
    headers = {
        "X-RateLimit-Limit": str(tight.limit),
        "X-RateLimit-Remaining": str(tight.remaining),
        "X-RateLimit-Reset": str(tight.reset_at),
    }
    # Which plan the ceiling came from — reported even when the flood bucket is
    # the tighter of the two, so a client can tell a plan limit from abuse
    # protection without correlating two header sets.
    planned = next((o.tier for o in seen if o.tier), None)
    if planned:
        headers["X-RateLimit-Plan"] = planned
    return headers


async def enforce_rate_limit(request: Request) -> None:
    """Layer 1. Raises HTTP 429 before any auth, DB or model work happens."""
    if request.method == "OPTIONS":  # never throttle CORS preflights
        return

    now = time.monotonic()
    path = request.url.path
    ip = _client_ip(request)

    public = _public_rule(path)
    if public is not None:
        limit, _window = public
        allowed, remaining, retry, reset_at = take(
            f"edge::public::{ip}", limit, max(5, limit // 2), now
        )
        outcome = RateOutcome("public", limit, remaining, retry, reset_at)
        _record(request, outcome)
        if not allowed:
            raise _too_many(outcome)
        return

    # Shared-IP flood ceiling. Deliberately far above any single plan so it only
    # ever fires on abuse, never on a legitimate paying tenant.
    is_write = path in _AI_ROUTES or request.method in _WRITE_METHODS
    floor = _IP_WRITE_FLOOR_PER_MIN if is_write else _IP_READ_FLOOR_PER_MIN
    allowed, remaining, retry, reset_at = take(
        f"edge::ip::{ip}::{'writes' if is_write else 'reads'}", floor, _IP_FLOOD_BURST, now
    )
    outcome = RateOutcome("flood", floor, remaining, retry, reset_at)
    _record(request, outcome)
    if not allowed:
        raise _too_many(outcome)


def _too_many(outcome: RateOutcome) -> HTTPException:
    headers = {
        "Retry-After": str(outcome.retry_after),
        "X-RateLimit-Limit": str(outcome.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": str(outcome.reset_at),
    }
    if outcome.tier:
        headers["X-RateLimit-Plan"] = outcome.tier
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "code": "rate_limited",
            "kind": outcome.kind,
            "limit": outcome.limit,
            "retry_after": outcome.retry_after,
            "tier": outcome.tier,
        },
        headers=headers,
    )


# ---------------------------------------------------------------------------
# Layer 2 — the tenant's own plan budget
# ---------------------------------------------------------------------------
async def enforce_plan_rate_limit(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
) -> None:
    """Per-tenant budget from the plan's ``rate`` block, applied after the
    identity behind the bearer token is verified.

    Runs as a router-level dependency (see app/main.py) so no endpoint has to
    remember it. Public token routes are skipped — layer 1 owns them, and an
    anonymous visitor has no plan to bill.
    """
    if request.method == "OPTIONS":
        return
    path = request.url.path
    if _public_rule(path) is not None:
        return

    # Imported here rather than at module scope: quota pulls in the ORM identity
    # graph, and the edge layer above must stay importable on its own.
    from app.core.quota import plan_context

    if current_user:
        ctx = await plan_context(db, current_user)
        tier, identity = ctx.tier, f"tenant::{ctx.clerk_id}"
    else:
        # No verified identity: bill the Free ceiling against the IP, so an
        # unauthenticated caller can never pick its own budget.
        tier, identity = "free", f"anon::{_client_ip(request)}"

    if path in _AI_ROUTES:
        kind, per_min = "ai", rate_for(tier).ai_per_min
    elif request.method in _WRITE_METHODS:
        kind, per_min = "writes", rate_for(tier).writes_per_min
    else:
        kind, per_min = "reads", rate_for(tier).reads_per_min

    # An AI call is the expensive one, so it gets the plan's AI ceiling as both
    # its sustained rate and its bucket capacity — the monthly meter (not this
    # bucket) is what sells AI, so the burst must never be the binding limit.
    ceiling = rate_for(tier)
    if kind == "ai":
        burst = ceiling.ai_per_min
    else:
        burst = ceiling.burst
    now = time.monotonic()
    allowed, remaining, retry, reset_at = take(f"plan::{identity}::{kind}", per_min, burst, now)
    outcome = RateOutcome(kind, per_min, remaining, retry, reset_at, tier)
    _record(request, outcome)
    if not allowed:
        raise _too_many(outcome)
