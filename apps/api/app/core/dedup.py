"""Duplicate-person detection shared by the Clients and Leads routers.

Email is the strict identity key: one workspace + one email = one person, so
invoices/projects never split across two rows for the same human. A shared
phone is a strong-but-not-proof signal, so it raises an overridable suggestion
the UI can bypass with ``allow_duplicate`` — an email hit can never be
overridden. A bare same-name is NOT a conflict here (two contacts at one
"Acme Studio" are normal); name similarity only powers the convert-preview
question, never a blocked write.

Matching is done in Python after normalizing both sides (casefold + trim,
digits-only for phones) because phone formats vary wildly as typed; the
per-workspace row counts here are small, same reasoning as the rollup passes
in clients.py.
"""

from typing import Any, Dict, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _norm(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _digits(value: Optional[str]) -> str:
    return "".join(c for c in (value or "") if c.isdigit())


def _as_conflict(dup: Dict[str, Any], kind: str) -> HTTPException:
    """409 with a machine-readable body — the web form branches on
    ``match``/``strict`` instead of parsing text (see api.ts error wrapper,
    which preserves the response body on the thrown Error)."""
    return HTTPException(status_code=409, detail={
        "code": "duplicate_person",
        "kind": kind,
        "match": dup["match"],
        "strict": dup["match"] == "email",
        "person": dup["person"],
    })


async def find_duplicate(
    db: AsyncSession,
    model: Any,  # Client or Lead — both carry workspace_id/name/email/phone
    workspace_id: str,
    *,
    name: Optional[str],
    email: Optional[str],
    phone: Optional[str],
    exclude_id: Optional[str] = None,
    match_name: bool = True,
) -> Optional[Dict[str, Any]]:
    """Return the closest existing row, email match winning over phone/name.

    ``None`` means no duplicate. The returned dict is the same shape the 409
    body consumes, so convert-preview can reuse this lookup directly.
    ``match_name`` is off on write paths (same-name is not a conflict) and on
    for the convert preview, where a namesake client is worth a question.
    """
    stmt = select(model).where(model.workspace_id == workspace_id)
    if exclude_id:
        stmt = stmt.where(model.id != exclude_id)
    rows = (await db.execute(stmt)).scalars().all()

    email_q, name_q = _norm(email), _norm(name)
    phone_q = _digits(phone)

    for row in rows:
        if email_q and _norm(row.email) == email_q:
            return {"match": "email", "person": _brief(row)}
    for row in rows:
        if phone_q and len(phone_q) >= 6 and _digits(row.phone) == phone_q:
            return {"match": "phone", "person": _brief(row)}
        if match_name and name_q and _norm(row.name) == name_q:
            return {"match": "name", "person": _brief(row)}
    return None


def _brief(row: Any) -> Dict[str, Any]:
    company = getattr(row, "company_name", None) or getattr(row, "company", None)
    return {
        "id": row.id,
        "name": row.name,
        "email": row.email,
        "company": company,
    }


async def ensure_no_duplicate(
    db: AsyncSession,
    model: Any,
    workspace_id: str,
    kind: str,
    *,
    email: Optional[str],
    phone: Optional[str],
    exclude_id: Optional[str] = None,
    allow_duplicate: bool = False,
) -> None:
    """Raise the 409 unless the hit is weak AND the caller opted in.

    ``allow_duplicate`` never bypasses an email match — that is the one rule
    the whole dedup story exists to enforce. Names are not checked here: on
    write paths only email and phone identify a person.
    """
    dup = await find_duplicate(
        db, model, workspace_id, name=None, email=email, phone=phone,
        exclude_id=exclude_id,
    )
    if dup is None:
        return
    if allow_duplicate and dup["match"] != "email":
        return
    raise _as_conflict(dup, kind)


__all__ = [
    "ensure_no_duplicate",
    "find_duplicate",
]
