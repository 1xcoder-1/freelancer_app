"""Plan enforcement: the numbers in config/pricing.json are the numbers the API
refuses you at, and the numbers /billing reports.

Every test here walks the same path a browser would — public HTTP against the
throwaway schema — because the point of server-side enforcement is that the
response, not the UI, is what says no.
"""

import pytest
from sqlalchemy import select

from app.core import quota
from app.core.config import settings
from app.core.plans import limit_for, meter_for
from app.models.user_plan import PlanUsage, UserPlan

FREE = {"clients": 3, "projects": 3, "services": 2, "link_pages": 1, "portfolios": 1}


@pytest.fixture(autouse=True)
def _free_tier_by_default(monkeypatch):
    """Dev/mock sessions otherwise resolve to the top plan, which would make
    every cap in this file a no-op. Individual tests raise the tier to prove the
    cap moves with the plan."""
    monkeypatch.setattr(settings, "DEV_TIER", "free")
    quota.invalidate_tier_cache()


def _denial(response):
    assert response.status_code == 402, response.text
    return response.json()["detail"]


async def _client_payloads(client, n, prefix="cap"):
    for i in range(n):
        res = await client.post(
            "/api/v1/clients",
            json={"name": f"{prefix} {i}", "email": f"{prefix}{i}@example.com"},
        )
        assert res.status_code == 201, res.text


# ---------------------------------------------------------------------------
# Capacity caps
# ---------------------------------------------------------------------------
async def test_free_clients_cap_denies_with_upgrade_body(client):
    await _client_payloads(client, FREE["clients"])

    body = _denial(await client.post(
        "/api/v1/clients",
        json={"name": "one more", "email": "more@example.com"},
    ))
    assert body["code"] == "plan_limit_reached"
    assert body["kind"] == "clients" and body["used"] == body["limit"] == 3
    assert body["tier"] == "free" and body["upgrade_to"] == "starter"
    assert body["upgrade_href"] == "/pricing"


async def test_cap_is_the_plans_number_not_a_hardcoded_three(client, monkeypatch):
    """Same test shape at a different tier: if the cap came from a literal in
    the endpoint, raising the plan would not move it."""
    await _client_payloads(client, FREE["clients"])
    monkeypatch.setattr(settings, "DEV_TIER", "growth")
    res = await client.post(
        "/api/v1/clients", json={"name": "grown", "email": "grown@example.com"}
    )
    assert res.status_code == 201, res.text
    assert limit_for("growth", "clients") == 20


async def test_deleting_frees_a_slot(client):
    await _client_payloads(client, FREE["clients"])
    listing = (await client.get("/api/v1/clients")).json()
    victim = listing[0]["id"]
    assert (await client.delete(f"/api/v1/clients/{victim}")).status_code == 204
    res = await client.post(
        "/api/v1/clients", json={"name": "replaced", "email": "replaced@example.com"}
    )
    assert res.status_code == 201, res.text


async def test_project_and_service_caps(client):
    for i in range(FREE["projects"]):
        assert (await client.post(
            "/api/v1/projects", json={"title": f"P{i}", "budget": 0, "hourly_rate": 0}
        )).status_code == 201
    body = _denial(await client.post(
        "/api/v1/projects", json={"title": "over", "budget": 0, "hourly_rate": 0}
    ))
    assert body["kind"] == "projects" and body["limit"] == FREE["projects"]

    for i in range(FREE["services"]):
        assert (await client.post(
            "/api/v1/booking",
            json={"title": f"S{i}", "description": "call", "duration_minutes": 30},
        )).status_code == 201, f"service {i}"
    body = _denial(await client.post(
        "/api/v1/booking",
        json={"title": "over", "description": "call", "duration_minutes": 30},
    ))
    assert body["kind"] == "services" and body["limit"] == FREE["services"]


# ---------------------------------------------------------------------------
# Sold features
# ---------------------------------------------------------------------------
PROPOSAL = {
    "title": "Site rebuild",
    "client_scope": "Rebuild the marketing site and CMS",
    "budget": 1200,
    "pitch_content": "Here is the plan, in enough characters to pass validation.",
}


async def test_proposals_are_locked_on_free(client):
    body = _denial(await client.post("/api/v1/proposals", json=PROPOSAL))
    assert body["code"] == "plan_feature_locked" and body["kind"] == "proposals"


async def test_proposals_are_metered_not_capped_on_starter(client, monkeypatch):
    monkeypatch.setattr(settings, "DEV_TIER", "starter")
    allowance = meter_for("starter", "proposals")
    for i in range(allowance):
        res = await client.post("/api/v1/proposals", json={**PROPOSAL, "title": f"P{i}"})
        assert res.status_code == 201, res.text

    body = _denial(await client.post("/api/v1/proposals", json={**PROPOSAL, "title": "over"}))
    assert body["code"] == "plan_meter_exhausted" and body["kind"] == "proposals"
    assert body["used"] == body["limit"] == allowance
    assert body["upgrade_to"] == "growth"


async def test_insights_modules_unlock_by_tier(client, monkeypatch):
    """Free sees nothing; Starter buys Reports only; Growth opens the rest."""
    assert (await client.get("/api/v1/reports/summary")).status_code == 402
    assert (await client.get("/api/v1/testimonials")).status_code == 402
    assert (await client.get("/api/v1/share-links")).status_code == 402

    monkeypatch.setattr(settings, "DEV_TIER", "starter")
    assert (await client.get("/api/v1/reports/summary")).status_code == 200
    assert (await client.get("/api/v1/testimonials")).status_code == 402

    monkeypatch.setattr(settings, "DEV_TIER", "growth")
    assert (await client.get("/api/v1/testimonials")).status_code == 200
    assert (await client.get("/api/v1/share-links")).status_code == 200


# ---------------------------------------------------------------------------
# Plan state written by the server, read by /billing/me
# ---------------------------------------------------------------------------
async def test_sync_requires_the_shared_secret(client, monkeypatch):
    # The suite must not inherit a real BILLING_SYNC_SECRET from .env — the
    # 503 branch only exists while the secret is unset.
    monkeypatch.setattr(settings, "BILLING_SYNC_SECRET", "")
    res = await client.put(
        "/api/v1/billing/sync", json={"clerk_id": "user_abc", "tier": "pro"}
    )
    # Unset secret = disabled, not open (see _require_sync_secret).
    assert res.status_code == 503, res.text

    monkeypatch.setattr(settings, "BILLING_SYNC_SECRET", "probe-secret")
    bad = await client.put(
        "/api/v1/billing/sync", json={"clerk_id": "user_abc", "tier": "pro"}
    )
    assert bad.status_code == 403, bad.text
    ok = await client.put(
        "/api/v1/billing/sync",
        json={"clerk_id": "user_abc", "tier": "pro"},
        headers={"x-billing-sync-secret": "probe-secret"},
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["tier"] == "pro"


async def test_sync_by_fee_when_tier_is_absent(client, monkeypatch):
    """Clerk renames plans; the fee it charged is the stable key."""
    monkeypatch.setattr(settings, "BILLING_SYNC_SECRET", "probe-secret")
    res = await client.put(
        "/api/v1/billing/sync",
        json={"clerk_id": "user_fee", "amount_cents": 500, "currency": "usd"},
        headers={"x-billing-sync-secret": "probe-secret"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["tier"] == "growth"


async def test_webhook_maps_a_clerk_event_to_a_tier(client, monkeypatch):
    monkeypatch.setattr(settings, "BILLING_SYNC_SECRET", "probe-secret")
    res = await client.post(
        "/api/v1/billing/webhook",
        headers={"x-billing-sync-secret": "probe-secret"},
        json={
            "type": "subscription.created",
            "data": {
                "payer_type": "user",
                "payer_id": "user_hook",
                "status": "active",
                "plan": {"name": "Growth", "fee": {"amount": 500, "currency_amount": "usd"}},
            },
        },
    )
    assert res.status_code == 200, res.text
    assert res.json()["tier"] == "growth"

    canceled = await client.post(
        "/api/v1/billing/webhook",
        headers={"x-billing-sync-secret": "probe-secret"},
        json={
            "type": "subscription.canceled",
            "data": {"payer_type": "user", "payer_id": "user_hook", "plan": {"fee": {"amount": 500}}},
        },
    )
    assert canceled.json()["status"] == "canceled"

    # An unknown event is acknowledged, never 400'd (Clerk would retry it
    # forever and the delivery would look broken).
    unknown = await client.post(
        "/api/v1/billing/webhook",
        headers={"x-billing-sync-secret": "probe-secret"},
        json={"type": "something.new.in.a.future.release", "data": {}},
    )
    assert unknown.status_code == 200, unknown.text


async def test_me_reports_usage_against_the_plan(client, monkeypatch):
    monkeypatch.setattr(settings, "DEV_TIER", "starter")
    monkeypatch.setattr(settings, "BILLING_SYNC_SECRET", "")
    await _client_payloads(client, 2)

    snapshot = (await client.get("/api/v1/billing/me")).json()
    assert snapshot["tier"] == "starter" and snapshot["is_owner"] is False
    clients = snapshot["capacities"]["clients"]
    assert clients["used"] == 2 and clients["limit"] == 10
    assert clients["unlimited"] is False
    assert clients["label"] and clients["href"]
    assert snapshot["meters"]["proposals"]["limit"] == 10
    assert snapshot["rate"]["writes_per_min"] == 40
    assert snapshot["sync_configured"] is False


async def test_ai_meter_burns_per_question(client, monkeypatch):
    from app.core.database import AsyncSessionLocal

    monkeypatch.setattr(settings, "DEV_TIER", "free")
    allowance = meter_for("free", "ai_asks")
    assert allowance > 0

    for i in range(allowance):
        res = await client.post("/api/v1/book-ai/ask", json={"question": f"what is {i}?"})
        assert res.status_code == 200, res.text

    body = _denial(await client.post("/api/v1/book-ai/ask", json={"question": "one too many"}))
    assert body["kind"] == "ai_asks" and body["used"] == body["limit"] == allowance

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(PlanUsage).where(PlanUsage.kind == "ai_asks")
        )).scalars().all()
    assert rows and rows[0].count == allowance


async def test_meter_resets_in_a_new_period(client):
    """The meter is keyed by calendar month, so last month's exhausted
    allowance must not still be exhausted today."""
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        db.add(PlanUsage(clerk_id="mock_token_tester_a", kind="ai_asks", period="2020-01", count=999))
        await db.commit()

    res = await client.post("/api/v1/book-ai/ask", json={"question": "still works?"})
    assert res.status_code == 200, res.text


async def test_stored_plan_drives_enforcement():
    """The path a real subscription takes: a user_plans row, no dev bypass, and
    the cap moves to that plan's number. Uses a session directly because a mock
    token is a dev session by definition and never reads the stored tier."""
    from app.core.database import AsyncSessionLocal
    from app.core.quota import enforce_capacity, plan_context

    try:
        async with AsyncSessionLocal() as db:
            db.add(UserPlan(clerk_id="user_paid_test", tier="growth", status="active"))
            await db.commit()

            ctx = await plan_context(db, {"user_id": "user_paid_test", "email": "paid@example.com"})
            assert ctx.tier == "growth" and ctx.is_owner is False
            # Growth holds 20, so five rows is not a denial...
            assert await enforce_capacity(db, ctx, "clients", workspace_id="ws", used=5) == 5
            # ...while the same count against Free is.
            free = await plan_context(db, {"user_id": "user_free_test", "email": "f@example.com"})
            assert free.tier == "free"
            with pytest.raises(Exception) as denied:
                await enforce_capacity(db, free, "clients", workspace_id="ws", used=5)
            assert denied.value.status_code == 402
    finally:
        quota.invalidate_tier_cache()


async def test_webhook_tier_is_the_tier_enforcement_uses(client, monkeypatch):
    """Clerk event -> user_plans -> plan_context, with no dev bypass in between:
    this is the whole paid path a subscriber actually travels."""
    from app.core.database import AsyncSessionLocal
    from app.core.quota import plan_context

    monkeypatch.setattr(settings, "BILLING_SYNC_SECRET", "probe-secret")
    res = await client.post(
        "/api/v1/billing/webhook",
        headers={"x-billing-sync-secret": "probe-secret"},
        json={
            "type": "subscription.updated",
            "data": {
                "payer_type": "user",
                "payer_id": "user_hook",
                "status": "active",
                "plan": {"name": "Starter", "fee": {"amount": 100, "currency_amount": "usd"}},
            },
        },
    )
    assert res.status_code == 200, res.text

    async with AsyncSessionLocal() as db:
        ctx = await plan_context(db, {"user_id": "user_hook", "email": "hook@example.com"})
    quota.invalidate_tier_cache()
    assert ctx.tier == "starter"


# ---------------------------------------------------------------------------
# The plan table itself
# ---------------------------------------------------------------------------
async def test_owner_is_exempt_from_capacity_not_from_meters(client, monkeypatch):
    """Recognition by Clerk id has to keep the founder's own workspace usable:
    111 real clients against a 50-client plan would otherwise freeze the demo."""
    monkeypatch.setattr(settings, "DEV_TIER", "free")
    monkeypatch.setattr(settings, "OWNER_CLERK_IDS", "mock_token_tester_a")

    for i in range(5):
        res = await client.post(
            "/api/v1/clients", json={"name": f"owner {i}", "email": f"owner{i}@example.com"}
        )
        assert res.status_code == 201, res.text

    snapshot = (await client.get("/api/v1/billing/me")).json()
    assert snapshot["is_owner"] is True and snapshot["tier"] == "pro"
    clients = snapshot["capacities"]["clients"]
    assert clients["used"] == 5 and clients["unlimited"] is True and clients["limit"] is None


def test_owner_account_resolves_to_the_top_plan_without_paying():
    """The admin's own account is Pro by config, not by invoice — matched on the
    email and, since the email claim is a Clerk template choice, on the id."""
    from app.core.plans import TOP_TIER, plan_for, resolve_tier

    owner_email = settings.OWNER_EMAILS.split(",")[0].strip()
    owner_id = settings.OWNER_CLERK_IDS.split(",")[0].strip()
    assert resolve_tier(owner_email, "free") == TOP_TIER
    # Case and stray spaces come from a JWT claim, not a form field.
    assert resolve_tier(f"  {owner_email.upper()}  ", None) == TOP_TIER
    # A token minted without the email claim still reads as the owner.
    assert resolve_tier(None, "free", owner_id) == TOP_TIER
    # ...and the plan the founder gets is the one being sold.
    assert plan_for(TOP_TIER).limits["clients"] == 50
    # Everyone else is bound by the record, and a bad tier string is Free.
    assert resolve_tier("someone@example.com", "garbage-tier") == "free"
    assert resolve_tier("someone@example.com", "pro", "user_someone_else") == "pro"


def test_pricing_json_is_fully_loaded():
    """A key missing from pricing.json would silently mean 'no cap' — the one
    pricing bug that lets free accounts mint unlimited rows, so it is a load
    failure instead."""
    from app.core.plans import DIMENSIONS, METERS, PLANS

    for plan in PLANS:
        assert set(plan.limits) == set(DIMENSIONS), plan.key
        assert set(plan.meters) == set(METERS), plan.key
        for ceiling in (plan.rate.reads_per_min, plan.rate.writes_per_min, plan.rate.ai_per_min):
            assert ceiling > 0
    # Every paid plan must actually be worth buying.
    for a, b in zip(PLANS, PLANS[1:]):
        assert b.limits["clients"] > a.limits["clients"]
        assert b.price > a.price
