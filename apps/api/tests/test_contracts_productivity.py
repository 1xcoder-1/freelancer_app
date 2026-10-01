"""Phase 6 — Contracts productivity (N1 audit trail, N2 expiry, N4 templates,
N5 versions, N6 full execution) plus the SE5 signature-body guard.

Hermetic by convention: HTTP-driven against the throwaway SQLite schema; the N2
expiry sweep is exercised through its module-level helper exactly like the other
job tests.
"""

from datetime import datetime, timedelta

from helpers import make_client, make_project


async def _make_contract(client, project_id, title="MSA", content="Engagement terms and conditions apply here.", expire_days=30):
    res = await client.post("/api/v1/contracts", json={
        "project_id": project_id,
        "title": title,
        "content": content,
        "recipient_name": "Sam Client",
        "recipient_email": "sam@client.test",
        "sender_signature": "Jane Freelancer",
        "expire_days": expire_days,
    })
    assert res.status_code == 201, res.text
    return res.json()


async def _events(client, contract_id):
    res = await client.get(f"/api/v1/contracts/{contract_id}/events")
    assert res.status_code == 200, res.text
    return [e["event"] for e in res.json()]


# ------------------------------------------------------------------------------
# N1 — every transition is written to the audit trail (and IP is surfaced)
# ------------------------------------------------------------------------------
async def test_audit_events_written_for_every_transition(client):
    cid = await make_client(client, name="Audit Co", email="a@audit.test")
    pid = await make_project(client, client_id=cid)
    c = await _make_contract(client, pid)

    assert "sent" in await _events(client, c["id"])

    # Client opens the public link -> "opened" row recorded.
    viewed = await client.get(f"/api/v1/contracts/public/{c['token']}")
    assert viewed.status_code == 200, viewed.text
    assert "opened" in await _events(client, c["id"])

    # Client signs -> "signed" row recorded.
    signed = await client.post(
        f"/api/v1/contracts/public/{c['token']}/sign",
        json={"client_signature": "data:image/png;base64,AAAA"},
    )
    assert signed.status_code == 200, signed.text
    assert "signed" in await _events(client, c["id"])


# ------------------------------------------------------------------------------
# N2 — an expired sign link cannot be executed (public route -> 410)
# ------------------------------------------------------------------------------
async def test_expired_contract_cannot_be_signed(client):
    cid = await make_client(client, name="Stale Co", email="s@stale.test")
    pid = await make_project(client, client_id=cid)
    c = await _make_contract(client, pid, expire_days=1)

    # Drive the daily scan with a clock well past the one-day window.
    from app.core.database import AsyncSessionLocal
    from app.inngest_functions.contract_jobs import expire_stale_contracts
    async with AsyncSessionLocal() as session:
        result = await expire_stale_contracts(session, now=datetime.utcnow() + timedelta(days=5))
    assert result["expired"] == 1

    refused = await client.post(
        f"/api/v1/contracts/public/{c['token']}/sign",
        json={"client_signature": "data:image/png;base64,AAAA"},
    )
    assert refused.status_code == 410, refused.text
    assert "expired" in await _events(client, c["id"])


# ------------------------------------------------------------------------------
# N4 — templates are workspace-scoped; save-a-contract-as-template works
# ------------------------------------------------------------------------------
async def test_template_crud_workspace_scoping(client, client_b):
    res = await client.post("/api/v1/contracts/templates", json={
        "title": "My MSA", "content": "Reusable master services terms.", "category": "msa",
    })
    assert res.status_code == 201, res.text
    tpl_id = res.json()["id"]

    mine = (await client.get("/api/v1/contracts/templates")).json()
    assert any(t["id"] == tpl_id for t in mine)

    # A second workspace must never see it.
    other = (await client_b.get("/api/v1/contracts/templates")).json()
    assert all(t["id"] != tpl_id for t in other)
    assert (await client_b.delete(f"/api/v1/contracts/templates/{tpl_id}")).status_code == 404

    assert (await client.delete(f"/api/v1/contracts/templates/{tpl_id}")).status_code == 204
    after = (await client.get("/api/v1/contracts/templates")).json()
    assert all(t["id"] != tpl_id for t in after)


async def test_save_contract_as_template(client):
    cid = await make_client(client, name="Promote Co", email="p@promote.test")
    pid = await make_project(client, client_id=cid)
    c = await _make_contract(client, pid, title="Keeper", content="These clauses are worth reusing.")

    res = await client.post(f"/api/v1/contracts/{c['id']}/save-as-template", json={
        "title": "Keeper template", "content": c["content"], "category": "general",
    })
    assert res.status_code == 201, res.text
    listed = (await client.get("/api/v1/contracts/templates")).json()
    assert any(t["id"] == res.json()["id"] for t in listed)


# ------------------------------------------------------------------------------
# N5 — re-sending creates v2, marks v1 superseded, and the old link is blocked
# ------------------------------------------------------------------------------
async def test_resend_supersedes_and_blocks_old_link(client):
    cid = await make_client(client, name="Version Co", email="v@version.test")
    pid = await make_project(client, client_id=cid)
    v1 = await _make_contract(client, pid, title="SOW v1")

    res = await client.post(f"/api/v1/contracts/{v1['id']}/resend", json={
        "project_id": pid, "title": "SOW v2", "content": "Updated terms of engagement go here.",
    })
    assert res.status_code == 200, res.text
    v2 = res.json()
    assert v2["version"] == 2
    assert v2["supersedes_id"] == v1["id"]

    old = (await client.get(f"/api/v1/contracts/{v1['id']}")).json()
    assert old["status"] == "superseded"

    # Signing the superseded link is refused (410), so v1 can't be executed.
    refused = await client.post(
        f"/api/v1/contracts/public/{v1['token']}/sign",
        json={"client_signature": "data:image/png;base64,AAAA"},
    )
    assert refused.status_code == 410, refused.text


# ------------------------------------------------------------------------------
# N6 — fully_executed_at only after BOTH parties have signed
# ------------------------------------------------------------------------------
async def test_fully_executed_requires_both_signatures(client):
    cid = await make_client(client, name="Exec Co", email="e@exec.test")
    pid = await make_project(client, client_id=cid)
    c = await _make_contract(client, pid)

    # The creation-time lie is gone: sender has NOT auto-signed.
    assert c["sender_signed_at"] is None

    # Client signs first -> client signed, but not fully executed yet.
    signed = await client.post(
        f"/api/v1/contracts/public/{c['token']}/sign",
        json={"client_signature": "data:image/png;base64,AAAA"},
    )
    assert signed.status_code == 200, signed.text
    body = signed.json()
    assert body["client_signed_at"] is not None
    assert body["status"] == "signed"
    assert body["fully_executed_at"] is None

    # Freelancer counter-signs -> now fully executed.
    done = await client.post(f"/api/v1/contracts/{c['id']}/sign-sender", json={
        "sender_signature": "typed:Jane Freelancer",
    })
    assert done.status_code == 200, done.text
    final = done.json()
    assert final["status"] == "fully_executed"
    assert final["sender_signed_at"] is not None
    assert final["fully_executed_at"] is not None


async def test_fully_executed_order_independent(client):
    # Counter-sign first, then the client signs -> still reaches fully_executed.
    cid = await make_client(client, name="Order Co", email="o@order.test")
    pid = await make_project(client, client_id=cid)
    c = await _make_contract(client, pid)

    first = await client.post(f"/api/v1/contracts/{c['id']}/sign-sender", json={
        "sender_signature": "typed:Jane Freelancer",
    })
    assert first.status_code == 200, first.text
    assert first.json()["fully_executed_at"] is None  # client hasn't signed

    second = await client.post(
        f"/api/v1/contracts/public/{c['token']}/sign",
        json={"client_signature": "data:image/png;base64,AAAA"},
    )
    assert second.status_code == 200, second.text
    assert second.json()["fully_executed_at"] is not None


# ------------------------------------------------------------------------------
# SE5 — oversized / non-image signature bodies are rejected at the edge (422)
# ------------------------------------------------------------------------------
async def test_se5_signature_body_is_bounded_and_scheme_checked(client):
    cid = await make_client(client, name="Secure Co", email="sec@secure.test")
    pid = await make_project(client, client_id=cid)
    c = await _make_contract(client, pid)

    js = await client.post(
        f"/api/v1/contracts/public/{c['token']}/sign",
        json={"client_signature": "javascript:alert(1)"},
    )
    assert js.status_code == 422, js.text

    svg = await client.post(
        f"/api/v1/contracts/public/{c['token']}/sign",
        json={"client_signature": "data:image/svg+xml;base64,AAAA"},
    )
    assert svg.status_code == 422, svg.text

    oversized = await client.post(
        f"/api/v1/contracts/public/{c['token']}/sign",
        json={"client_signature": "data:image/png;base64," + ("A" * (300 * 1024))},
    )
    assert oversized.status_code == 422, oversized.text
