"""Rate limiting: the bucket math, the plan-aware ceilings, and the headers a
client needs to back off instead of retry-storming.

Split from test_security_hardening.py on purpose: that file proves anonymous
brute-force ceilings hold; this one proves the *paid* budgets are the ones in
config/pricing.json and that exhausting one tenant's budget cannot touch another
tenant's.
"""

import time

import pytest

from app.core import rate_limit
from app.core.config import settings
from app.core.plans import rate_for
from app.core.rate_limit import take


@pytest.fixture(autouse=True)
def _free_tier_by_default(monkeypatch):
    """Same reasoning as the enforcement suite: a dev session otherwise lands on
    the top plan, where every ceiling here is too high to reach."""
    monkeypatch.setattr(settings, "DEV_TIER", "free")
    rate_limit._BUCKETS.clear()


def _denial(response):
    assert response.status_code == 429, response.text
    return response.json()["detail"]


# ---------------------------------------------------------------------------
# The bucket itself
# ---------------------------------------------------------------------------
def test_burst_then_steady_state():
    """A token bucket allows one spike to ``burst`` and then holds the client to
    the sustained rate — the fixed-window bug where 2x the quota fits across a
    boundary must not be reachable."""
    rate_limit._BUCKETS.clear()
    start = time.monotonic()
    allowed = [take("unit::burst", per_min=60, burst=5, now=start)[0] for _ in range(8)]
    assert allowed == [True] * 5 + [False] * 3

    # 60/min is one token per second: after two seconds, two more fit.
    later = [take("unit::burst", per_min=60, burst=5, now=start + 2.0)[0] for _ in range(3)]
    assert later == [True, True, False]


def test_refill_never_exceeds_capacity():
    rate_limit._BUCKETS.clear()
    start = time.monotonic()
    take("unit::cap", per_min=600, burst=3, now=start)
    # Two hours idle: still only 3 tokens, not 3 + 72000.
    assert [take("unit::cap", per_min=600, burst=3, now=start + 7200)[0] for _ in range(4)] == [
        True, True, True, False
    ]


def test_retry_after_and_reset_are_reported_to_the_client():
    rate_limit._BUCKETS.clear()
    start = time.monotonic()
    for _ in range(2):
        take("unit::headers", per_min=30, burst=2, now=start)
    allowed, remaining, retry, reset_at = take("unit::headers", per_min=30, burst=2, now=start)
    assert allowed is False and remaining == 0
    # 30/min = one token every 2s, and the bucket is empty.
    assert retry == 2 and reset_at > int(time.time())


# ---------------------------------------------------------------------------
# Headers on every response, throttled or not
# ---------------------------------------------------------------------------
async def test_successful_requests_carry_the_budget(client):
    first = await client.get("/api/v1/clients")
    second = await client.get("/api/v1/clients")
    assert first.status_code == 200 and second.status_code == 200

    limit = rate_for("free").reads_per_min
    for res in (first, second):
        assert int(res.headers["X-RateLimit-Limit"]) == limit
        assert res.headers["X-RateLimit-Plan"] == "free"
        assert int(res.headers["X-RateLimit-Reset"]) > time.time()
    # The bucket spends down, so the client can schedule its next call.
    assert int(second.headers["X-RateLimit-Remaining"]) < int(first.headers["X-RateLimit-Remaining"])


# ---------------------------------------------------------------------------
# The plan's ceiling, not a global one
# ---------------------------------------------------------------------------
async def test_free_write_ceiling_matches_the_plan(client):
    ceiling = rate_for("free").writes_per_min
    statuses = []
    for i in range(ceiling + 3):
        res = await client.post(
            "/api/v1/clients", json={"name": f"flood {i}", "email": f"flood{i}@example.com"}
        )
        statuses.append(res.status_code)
        if res.status_code == 429:
            break

    assert 429 in statuses, statuses
    body = _denial(res)
    assert body["code"] == "rate_limited" and body["kind"] == "writes"
    assert body["limit"] == ceiling and body["tier"] == "free"
    assert res.headers["Retry-After"].isdigit()
    # 402 (client cap) fires long before 429, and both are legitimate refusals.
    assert set(statuses) <= {201, 402, 429}


async def test_a_paid_plan_gets_more_headroom(client, monkeypatch):
    """Identical traffic, different plan: if the ceiling came from a constant in
    the middleware rather than the pricing matrix, this test would fail."""
    monkeypatch.setattr(settings, "DEV_TIER", "pro")
    for i in range(rate_for("free").writes_per_min + 5):
        res = await client.post(
            "/api/v1/clients", json={"name": f"pro {i}", "email": f"pro{i}@example.com"}
        )
        assert res.status_code != 429, f"Pro tenant throttled at the Free ceiling: {res.text}"
    assert res.headers["X-RateLimit-Plan"] == "pro"


async def test_one_tenant_cannot_spending_another_s_budget(client, client_b, monkeypatch):
    monkeypatch.setattr(settings, "DEV_TIER", "free")
    for i in range(rate_for("free").writes_per_min + 3):
        res = await client.post(
            "/api/v1/clients", json={"name": f"a {i}", "email": f"a{i}@example.com"}
        )
    assert res.status_code == 429, res.text

    # Tenant B shares the process (and, in tests, the IP) but not the budget.
    other = await client_b.post(
        "/api/v1/clients", json={"name": "B client", "email": "b@example.com"}
    )
    assert other.status_code == 201, other.text
    assert other.headers["X-RateLimit-Remaining"] != "0"


# ---------------------------------------------------------------------------
# Scarce resources get their own bucket
# ---------------------------------------------------------------------------
async def test_ai_routes_use_the_ai_bucket_not_the_write_bucket(client):
    ai_ceiling = rate_for("free").ai_per_min
    res = None
    for i in range(ai_ceiling + 1):
        res = await client.post("/api/v1/book-ai/ask", json={"question": f"question {i}?"})
        if res.status_code == 429:
            break

    body = _denial(res)
    assert body["kind"] == "ai" and body["limit"] == ai_ceiling

    # The write budget was untouched by the AI flood, which is why the AI route
    # is charged one bucket rather than two.
    write = await client.post(
        "/api/v1/clients", json={"name": "after flood", "email": "after@example.com"}
    )
    assert write.status_code == 201, write.text


async def test_public_token_routes_skip_the_plan_layer(client):
    """Anonymous share pages have no plan to bill; layer 1 owns them. A request
    carrying a bearer token still gets the tenant budget on private routes, so
    this asserts the public route answers without a plan header."""
    res = await client.get("/api/v1/link-pages/public/does-not-exist")
    assert res.status_code in (404, 405, 200)
    assert "X-RateLimit-Plan" not in res.headers or res.headers["X-RateLimit-Plan"] != "free"


def test_ai_ceiling_is_never_the_binding_limit_for_a_human():
    """The per-minute ceiling protects the model from a script; the monthly meter
    is what sells AI. 10 questions a minute is past anything a person types, so
    a paying customer should never hit the rate limit for legitimate work — and
    the ceiling has to rise with the price."""
    from app.core.plans import PLANS

    ceilings = [plan.rate.ai_per_min for plan in PLANS]
    assert min(ceilings) >= 10
    assert ceilings == sorted(ceilings)
