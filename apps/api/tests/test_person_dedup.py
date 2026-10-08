"""Duplicate-person protection for the CRM (clients + leads) and the
lead -> client convert flow.

Hermetic by convention: pure HTTP against the throwaway SQLite schema, using
only public endpoints — including the two UX contracts the web forms branch
on: the 409 {code:'duplicate_person'} body and convert-preview.
"""


async def _make_client(client, name="Nova Ltd", email="ops@nova.test", **over):
    payload = {"name": name, "email": email}
    payload.update(over)
    res = await client.post("/api/v1/clients", json=payload)
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _make_lead(client, name="Nova Ltd", email="deal@nova.test", **over):
    payload = {"name": name, "email": email, "stage": "new"}
    payload.update(over)
    res = await client.post("/api/v1/leads", json=payload)
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _conflict(res):
    detail = res.json()["detail"]
    assert isinstance(detail, dict), res.text
    assert detail["code"] == "duplicate_person"
    return detail


# ------------------------------------------------------------------------------
# Clients — create conflicts
# ------------------------------------------------------------------------------
async def test_client_email_duplicate_is_strict_409(client):
    await _make_client(client, email="dup@nova.test")
    res = await client.post("/api/v1/clients", json={"name": "Other Name", "email": "DUP@nova.test"})
    assert res.status_code == 409, res.text
    conflict = _conflict(res)
    assert conflict["match"] == "email"
    assert conflict["strict"] is True


async def test_client_email_duplicate_can_never_be_forced(client):
    await _make_client(client, email="dup@nova.test")
    res = await client.post(
        "/api/v1/clients",
        json={"name": "Other Name", "email": "dup@nova.test", "allow_duplicate": True},
    )
    assert res.status_code == 409, res.text
    assert _conflict(res)["strict"] is True


async def test_client_same_name_different_people_is_allowed(client):
    # Two contacts at one company share a name all the time — never a block.
    await _make_client(client, name="Sam Rivera", email="sam1@nova.test")
    res = await client.post("/api/v1/clients", json={"name": "Sam Rivera", "email": "sam2@nova.test"})
    assert res.status_code == 201, res.text


async def test_client_phone_duplicate_overridable_with_allow_duplicate(client):
    await _make_client(client, name="Sam Rivera", email="sam1@nova.test", phone="+1 (555) 010-0100")
    # Same digits, different formatting: still the same phone.
    res = await client.post(
        "/api/v1/clients",
        json={"name": "Guy Other", "email": "sam2@nova.test", "phone": "1-555-010-0100"},
    )
    assert res.status_code == 409, res.text
    conflict = _conflict(res)
    assert conflict["match"] == "phone"
    assert conflict["strict"] is False
    # Confirmed different people: the retry with the flag succeeds.
    ok = await client.post(
        "/api/v1/clients",
        json={"name": "Guy Other", "email": "sam2@nova.test", "phone": "1-555-010-0100", "allow_duplicate": True},
    )
    assert ok.status_code == 201, ok.text


async def test_client_duplicate_checks_are_workspace_scoped(client, client_b):
    await _make_client(client, email="shared@nova.test")
    res = await client_b.post("/api/v1/clients", json={"name": "Nova Ltd", "email": "shared@nova.test"})
    assert res.status_code == 201, res.text


# ------------------------------------------------------------------------------
# Clients — PATCH only enforces the strict email rule
# ------------------------------------------------------------------------------
async def test_client_patch_stealing_another_email_conflicts(client):
    await _make_client(client, name="Ann", email="a@nova.test")
    b_id = await _make_client(client, name="Bob", email="b@nova.test")
    res = await client.patch(f"/api/v1/clients/{b_id}", json={"email": "A@nova.test"})
    assert res.status_code == 409, res.text
    assert _conflict(res)["match"] == "email"


async def test_client_patch_allows_same_email_resave_and_name_edits(client):
    cid = await _make_client(client, name="Sam Rivera", email="sam@nova.test")
    # A namesake on the roster is allowed without any flag (create-side).
    await _make_client(client, name="Sam Rivera", email="other@nova.test")
    # Re-saving the same email (uppercase variant) is not a conflict with self.
    ok = await client.patch(f"/api/v1/clients/{cid}", json={"email": "SAM@nova.test", "phone": "+1 555 0100"})
    assert ok.status_code == 200, ok.text
    # A name edit colliding with another row is never blocked on PATCH.
    ok2 = await client.patch(f"/api/v1/clients/{cid}", json={"name": "Sam Rivera"})
    assert ok2.status_code == 200, ok2.text


# ------------------------------------------------------------------------------
# Leads — same contract inside the pipeline
# ------------------------------------------------------------------------------
async def test_lead_email_duplicate_409_and_phone_override(client):
    await _make_lead(client, email="dup@nova.test")
    res = await client.post("/api/v1/leads", json={"name": "X Other", "email": "DUP@nova.test"})
    assert res.status_code == 409, res.text
    assert _conflict(res)["kind"] == "lead"

    # Namesakes in the pipeline are normal (two contacts at one company).
    name_res = await client.post("/api/v1/leads", json={"name": "Nova Ltd", "email": "x2@nova.test"})
    assert name_res.status_code == 201, name_res.text

    lid = await _make_lead(client, name="Ivy Deal", email="ivy1@nova.test", phone="+1 (555) 011-1")
    dup = await client.post(
        "/api/v1/leads",
        json={"name": "Ivy Other", "email": "ivy2@nova.test", "phone": "1-555-0111"},
    )
    assert dup.status_code == 409, dup.text
    assert _conflict(dup)["match"] == "phone"
    forced = await client.post(
        "/api/v1/leads",
        json={"name": "Ivy Other", "email": "ivy2@nova.test", "phone": "1-555-0111", "allow_duplicate": True},
    )
    assert forced.status_code == 201, forced.text
    assert lid  # first lead still the anchor of the scenario


async def test_lead_patch_email_conflict_excludes_self(client):
    await _make_lead(client, name="Ann", email="a@nova.test")
    b_id = await _make_lead(client, name="Bob", email="b@nova.test")
    res = await client.patch(f"/api/v1/leads/{b_id}", json={"email": "a@nova.test"})
    assert res.status_code == 409, res.text
    # Same-email resave (case variant) is clean.
    ok = await client.patch(f"/api/v1/leads/{b_id}", json={"email": "B@nova.test"})
    assert ok.status_code == 200, ok.text


# ------------------------------------------------------------------------------
# Convert flow — preview, idempotency, merge-fill, explicit merge
# ------------------------------------------------------------------------------
async def test_convert_preview_none_then_email(client):
    lid = await _make_lead(client, email="fresh@nova.test")
    preview = (await client.get(f"/api/v1/leads/{lid}/convert-preview")).json()
    assert preview["match"] == "none"

    cid = await _make_client(client, email="fresh@nova.test", name="Renamed Person")
    preview2 = (await client.get(f"/api/v1/leads/{lid}/convert-preview")).json()
    assert preview2["match"] == "email"
    assert preview2["same_person"] is True
    assert preview2["client_id"] == cid


async def test_convert_fills_gaps_never_overwrites(client):
    cid = await _make_client(client, name="Kai Member", email="kai@nova.test")
    lid = await _make_lead(
        client, name="Kai Member", email="kai@nova.test",
        phone="+1 (555) 010-0110", company="Kai Studio",
    )
    res = await client.post(f"/api/v1/leads/{lid}/convert-to-client", json={})
    assert res.status_code == 200, res.text
    out = res.json()
    assert out["id"] == cid  # reused, not duplicated
    assert out["phone"] == "+1 (555) 010-0110"  # empty field filled
    assert out["company_name"] == "Kai Studio"
    roster = (await client.get("/api/v1/clients")).json()
    assert sum(1 for c in roster if c["email"].lower() == "kai@nova.test") == 1

    # A roster value that already exists is never clobbered by re-converting.
    await client.patch(f"/api/v1/clients/{cid}", json={"company_name": "Manual Co"})
    lid2 = await _make_lead(client, name="Zoe New", email="kai2@nova.test")
    # (different email + different name -> new person, clean create)
    forced = await client.post(f"/api/v1/leads/{lid2}/convert-to-client", json={})
    assert forced.status_code == 200, forced.text
    kept = (await client.get(f"/api/v1/clients/{cid}")).json()
    assert kept["company_name"] == "Manual Co"


async def test_convert_merge_into_weak_match_target(client):
    cid = await _make_client(client, name="Lee Dup", email="lee1@nova.test", phone="+15550001111")
    lid = await _make_lead(client, name="Lee Dup", email="lee2@nova.test")
    preview = (await client.get(f"/api/v1/leads/{lid}/convert-preview")).json()
    assert preview["match"] == "weak"
    assert preview["client_id"] == cid

    res = await client.post(
        f"/api/v1/leads/{lid}/convert-to-client",
        json={"merge_into_client_id": cid},
    )
    assert res.status_code == 200, res.text
    assert res.json()["id"] == cid
    lead = (await client.get(f"/api/v1/leads/{lid}")).json()
    assert lead["stage"] == "won"
    # Exactly one roster row for this human, no matter the email drift.
    roster = (await client.get("/api/v1/clients")).json()
    assert sum(1 for c in roster if c["name"] == "Lee Dup") == 1


async def test_convert_merge_into_foreign_or_unknown_id_404(client, client_b):
    lid = await _make_lead(client, email="merge404@nova.test")
    res = await client.post(
        f"/api/v1/leads/{lid}/convert-to-client",
        json={"merge_into_client_id": "nonexistent-id"},
    )
    assert res.status_code == 404, res.text
    # A client from another workspace is invisible, not convertible-into.
    b_cid = await _make_client(client_b, email="bclient@nova.test")
    res2 = await client.post(
        f"/api/v1/leads/{lid}/convert-to-client",
        json={"merge_into_client_id": b_cid},
    )
    assert res2.status_code == 404, res2.text


async def test_close_won_gap_fills_existing_client(client):
    cid = await _make_client(client, name="Ana Won", email="ana@nova.test")
    lid = await _make_lead(client, name="Ana Won", email="ana@nova.test", phone="+1 555 0199")
    res = await client.post(f"/api/v1/leads/{lid}/close", json={"outcome": "won"})
    assert res.status_code == 200, res.text
    kept = (await client.get(f"/api/v1/clients/{cid}")).json()
    assert kept["phone"] == "+1 555 0199"  # merged instead of skipped
    roster = (await client.get("/api/v1/clients")).json()
    assert sum(1 for c in roster if c["email"].lower() == "ana@nova.test") == 1
