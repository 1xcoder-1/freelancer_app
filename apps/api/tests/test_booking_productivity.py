"""Phase 7 — Booking productivity (B1 conflict-free slots, B2 availability &
blackout days, B3 self-reschedule + status machine, B4 real paid consultations,
B6 no-show strikes) plus workspace isolation.

Hermetic by convention: HTTP-driven against the throwaway SQLite schema; the
B4 payment-confirmation sweep is exercised through its module-level helper
exactly like the other job tests.
"""

from datetime import datetime, timedelta

from helpers import make_client  # noqa: F401  (shared builder, keeps parity)

# A consultation with the widest legal rules, so a test only trips the one
# guard it is actually probing.
PERMISSIVE = dict(
    weekday_mask="1111111",
    start_minute=0,
    end_minute=1440,
    min_lead_hours=0,
    max_advance_days=365,
    buffer_minutes=0,
    duration_minutes=30,
    price=0.0,
)


def _at(days_ahead, hour=12, minute=0):
    when = datetime.utcnow() + timedelta(days=days_ahead)
    return when.replace(hour=hour, minute=minute, second=0, microsecond=0)


async def _make_consultation(client, **overrides):
    payload = {
        "title": "Discovery Call",
        "description": "Quick intro.",
        "meeting_provider": "google_meet",
        "is_active": True,
        **PERMISSIVE,
        **overrides,
    }
    res = await client.post("/api/v1/booking", json=payload)
    assert res.status_code == 201, res.text
    return res.json()


async def _schedule(client, token, when, name="Casey Client", email="casey@book.test", notes=None):
    return await client.post(f"/api/v1/booking/public/{token}/schedule", json={
        "client_name": name,
        "client_email": email,
        "appointment_time": when.isoformat(),
        "notes": notes,
    })


# ------------------------------------------------------------------------------
# B1 — the unvalidated slot / double-book / past-date bugs are gone
# ------------------------------------------------------------------------------
async def test_schedule_rejects_past_and_too_soon(client):
    c = await _make_consultation(client, min_lead_hours=24)
    res = await _schedule(client, c["token"], _at(0, hour=9))  # same-day, inside lead window
    assert res.status_code == 422, res.text


async def test_schedule_rejects_beyond_max_advance(client):
    c = await _make_consultation(client, max_advance_days=3)
    res = await _schedule(client, c["token"], _at(30))
    assert res.status_code == 422, res.text


async def test_schedule_rejects_closed_weekday(client):
    c = await _make_consultation(client, weekday_mask="0000000")
    res = await _schedule(client, c["token"], _at(2))
    assert res.status_code == 422, res.text


async def test_schedule_rejects_outside_opening_window(client):
    c = await _make_consultation(client, start_minute=600, end_minute=900)  # 10:00-15:00
    res = await _schedule(client, c["token"], _at(2, hour=8))  # 08:00 is before open
    assert res.status_code == 422, res.text


async def test_double_booking_same_slot_is_rejected(client):
    c = await _make_consultation(client)
    when = _at(3, hour=14)
    first = await _schedule(client, c["token"], when, email="one@book.test")
    assert first.status_code == 201, first.text
    second = await _schedule(client, c["token"], when, email="two@book.test")
    assert second.status_code == 409, second.text

    # Only one appointment actually exists for that slot.
    appts = await client.get("/api/v1/booking/appointments")
    assert appts.status_code == 200
    assert sum(1 for a in appts.json() if a["consultation_id"] == c["id"]) == 1


# ------------------------------------------------------------------------------
# B1/B2 — the open-slot list is conflict-free and a booked slot disappears
# ------------------------------------------------------------------------------
async def test_open_slots_exclude_booked_and_blocked_days(client):
    c = await _make_consultation(client)
    slots = await client.get(f"/api/v1/booking/public/{c['token']}/slots?days=14")
    assert slots.status_code == 200, slots.text
    times = slots.json()["slots"]
    assert len(times) > 0

    # Book the furthest-out offered slot (always comfortably inside the lead
    # guard regardless of how much wall-clock time elapsed between calls).
    target = times[-1]
    booked = await _schedule(client, c["token"], datetime.fromisoformat(target))
    assert booked.status_code == 201, booked.text

    after = await client.get(f"/api/v1/booking/public/{c['token']}/slots?days=14")
    remaining = [s for s in after.json()["slots"]]
    assert target not in remaining, "a booked slot must stop being offered"

    # A blackout day removes every slot on that date.
    blocked_day = (datetime.utcnow() + timedelta(days=5)).date().isoformat()
    blk = await client.post(f"/api/v1/booking/{c['id']}/blocked-days?date={blocked_day}")
    assert blk.status_code == 201, blk.text
    after_block = await client.get(f"/api/v1/booking/public/{c['token']}/slots?days=14")
    assert all(s[:10] != blocked_day for s in after_block.json()["slots"])

 # ------------------------------------------------------------------------------
# B3 — status machine + capped self-reschedule via the appointment token
# ------------------------------------------------------------------------------
async def test_reschedule_moves_slot_and_is_capped(client):
    c = await _make_consultation(client)
    appt = (await _schedule(client, c["token"], _at(2, hour=9))).json()
    token = appt["token"]

    moved = await client.post(f"/api/v1/booking/public/appointments/{token}/reschedule", json={
        "appointment_time": _at(4, hour=9).isoformat(),
    })
    assert moved.status_code == 200, moved.text
    assert moved.json()["reschedule_count"] == 1

    # Burn through the remaining budget, then the cap rejects further moves.
    for i, day in enumerate((6, 8), start=2):
        r = await client.post(f"/api/v1/booking/public/appointments/{token}/reschedule", json={
            "appointment_time": _at(day, hour=9).isoformat(),
        })
        assert r.status_code == 200, r.text
    capped = await client.post(f"/api/v1/booking/public/appointments/{token}/reschedule", json={
        "appointment_time": _at(20, hour=9).isoformat(),
    })
    assert capped.status_code == 409, capped.text


async def test_completed_call_creates_client_record(client):
    c = await _make_consultation(client)
    appt = (await _schedule(client, c["token"], _at(2, hour=11), email="future@client.test")).json()
    assert appt["status"] == "confirmed"  # free call confirms immediately

    done = await client.post(f"/api/v1/booking/appointments/{appt['id']}/status", json={"status": "completed"})
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "completed"
    assert done.json()["client_id"], "a completed call must promote the person to a Client"

    # A completed appointment can no longer be rescheduled.
    late = await client.post(f"/api/v1/booking/public/appointments/{appt['token']}/reschedule", json={
        "appointment_time": _at(9, hour=11).isoformat(),
    })
    assert late.status_code == 409, late.text


# ------------------------------------------------------------------------------
# B4 — a paid consult is UNPAID until its invoice is actually settled
# ------------------------------------------------------------------------------
async def test_paid_consultation_is_not_fictitiously_paid(client):
    c = await _make_consultation(client, price=100.0)
    res = await _schedule(client, c["token"], _at(3, hour=10))
    assert res.status_code == 201, res.text
    appt = res.json()

    # The core bug fix: price > 0 no longer means "paid".
    assert appt["payment_status"] == "unpaid"
    assert appt["status"] == "pending"
    assert appt["invoice_id"], "a paid consult must raise a real invoice"
    assert appt["invoice_token"]

    # Until payment lands, the payment helper must not confirm anything.
    from app.core.database import AsyncSessionLocal
    from app.inngest_functions.booking_jobs import confirm_paid_appointment
    async with AsyncSessionLocal() as session:
        result = await confirm_paid_appointment(session, appt["invoice_id"])
    assert result["updated"] is True
    assert result["status"] == "confirmed"

    check = await client.get("/api/v1/booking/appointments")
    mine = next(a for a in check.json() if a["id"] == appt["id"])
    assert mine["payment_status"] == "paid"
    assert mine["status"] == "confirmed"


# ------------------------------------------------------------------------------
# B6 — no-show strikes force a repeat offender off free bookings
# ------------------------------------------------------------------------------
async def test_no_show_strikes_block_free_rebooking(client):
    c = await _make_consultation(client, price=0.0, no_show_limit=1)
    appt = (await _schedule(client, c["token"], _at(2, hour=13), email="flake@book.test")).json()

    ns = await client.post(f"/api/v1/booking/appointments/{appt['id']}/status", json={"status": "no_show"})
    assert ns.status_code == 200, ns.text
    assert ns.json()["no_show"] is True

    # Same person, free slot, over the limit -> refused (must book paid instead).
    again = await _schedule(client, c["token"], _at(5, hour=13), email="flake@book.test")
    assert again.status_code == 409, again.text


# ------------------------------------------------------------------------------
# Agenda (B6) surfaces a real countdown derived server-side
# ------------------------------------------------------------------------------
async def test_agenda_reports_next_call_with_countdown(client):
    c = await _make_consultation(client)
    await _schedule(client, c["token"], _at(1, hour=15))

    agenda = await client.get("/api/v1/booking/agenda")
    assert agenda.status_code == 200, agenda.text
    data = agenda.json()
    assert data["next_call"] is not None
    assert data["hours_to_next"] is not None and data["hours_to_next"] > 0
    assert data["week_booked"] >= 1


# ------------------------------------------------------------------------------
# Workspace isolation on the new protected routes
# ------------------------------------------------------------------------------
async def test_other_workspace_cannot_touch_appointment(client, client_b):
    c = await _make_consultation(client)
    appt = (await _schedule(client, c["token"], _at(2, hour=16))).json()

    # tester_b must not be able to change tester_a's appointment.
    res = await client_b.post(f"/api/v1/booking/appointments/{appt['id']}/status", json={"status": "completed"})
    assert res.status_code == 404, res.text
    # ...and must not see it in their own list.
    lst = await client_b.get("/api/v1/booking/appointments")
    assert all(a["id"] != appt["id"] for a in lst.json())


# ------------------------------------------------------------------------------
# Regression (migration 005): the auto-seeded consultations must serialize the
# canonical availability defaults. On Neon the rows seeded before the B1/B2
# columns existed held NULLs there and 500'd this list with 16 response
# validation errors (8 non-optional fields x 2 rows).
# ------------------------------------------------------------------------------
async def test_seeded_consultations_carry_availability_defaults(client):
    res = await client.get("/api/v1/booking")
    assert res.status_code == 200, res.text
    seeded = res.json()
    assert len(seeded) == 2
    for c in seeded:
        assert c["weekday_mask"] == "1111100"
        assert c["start_minute"] == 540
        assert c["end_minute"] == 1020
        assert c["timezone"] == "UTC"
        assert c["min_lead_hours"] == 2
        assert c["max_advance_days"] == 60
        assert c["buffer_minutes"] == 0
        assert c["no_show_limit"] == 2
