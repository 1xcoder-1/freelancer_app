# Freelancer Productivity Features — 6 per page, real-time, secure

## Summary

The audit of `clients`, `leads`, `projects`, `contracts`, `invoices`, `planner` and `booking` found a consistent pattern: each page tracks **status** well but answers none of the three questions a freelancer actually opens it for — *how much money is stuck, where am I bleeding time, and what must I do in the next 10 minutes?* This plan adds exactly 6 features per page that answer those questions with live data, reusing machinery the app already has instead of inventing new infrastructure.

**Real-time model (deliberately unchanged):** `useApiData` already provides deduped polling + `invalidateCache` fan-out + visibility catch-up, and the Planner proves the cross-device pattern with a `revision` counter (`planner.py:181-212`). Every new feature uses `pollMs` (15–20s, matching existing panels) or a revision bump. No websockets, no new sync layer.

**Every feature is anchored to a defect or gap found in code**, not to a feature-list idea. Nothing speculative was added.

---

## Conventions to follow (verified in code)

| Concern | Required pattern | Source |
|---|---|---|
| Auth | `current_user: Dict[str, Any] = Depends(require_authenticated_user)` on every protected route | `core/auth.py:237` |
| Tenant scope | `workspace_id == workspace.id` **inside the WHERE clause**, never a filter after lookup; unknown/guessed id → 404 | `leads.py:37-49`, `planner.py:30-45` |
| Validation | Pydantic `Literal[...]` enums + bounded strings/`_MAX_MONEY`; unknown value → 422, never silent insert | `schemas/domain.py:61-90,287` |
| Background jobs | `await db.commit()` **then** `await emit("x.y", {...})`; `emit` never raises | `inngest_client.py:65-86`, `invoices.py:213-227` |
| New Inngest fn | add module in `inngest_functions/`, register in `functions` list, hermetic test calling the module-level helper directly | `inngest_functions/__init__.py:14-22`, `invoice_jobs.py:23-38` |
| DB | add columns to models + one idempotent `migrations/00N_*.sql`; dev a
[ai-coding: truncated for UI, totalLength=37630]