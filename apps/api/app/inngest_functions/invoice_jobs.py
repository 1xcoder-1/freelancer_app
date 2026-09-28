"""Inngest durable workflows for invoicing: overdue detection + 4-day reminders.

The cron scan flips 'sent' invoices past their due date to 'overdue' once a
day; the reminder function sleeps until due + grace and emails the client,
re-checking payment status first so paid invoices never get nagged.
"""

from datetime import datetime, timedelta

import inngest
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.inngest_client import inngest_client
from app.models.client import Client
from app.models.finance import Invoice
from app.services.email_service import build_invoice_reminder_email, send_email

# Blueprint: automated follow-up 4 days after an invoice is overdue.
REMINDER_GRACE_DAYS = 4


async def mark_overdue_invoices(session, now: datetime | None = None) -> dict:
    """Flip past-due 'sent' invoices to 'overdue'. Module-level (not inside
    the step closure) so the hermetic test suite can run it directly."""
    marked: list[str] = []
    res = await session.execute(
        select(Invoice).where(
            Invoice.status == "sent",
            Invoice.due_date.is_not(None),
            Invoice.due_date < (now or datetime.utcnow()),
        )
    )
    for inv in res.scalars().all():
        inv.status = "overdue"
        marked.append(inv.invoice_number)
    await session.commit()
    return {"marked_overdue": len(marked), "invoices": marked}


@inngest_client.create_function(
    fn_id="invoice.overdue-scan",
    trigger=inngest.TriggerCron(cron="0 6 * * *"),
)
async def invoice_overdue_scan(ctx: inngest.Context) -> dict:
    """Daily sweep: mark past-due 'sent' invoices as 'overdue'."""

    async def _mark() -> dict:
        async with AsyncSessionLocal() as session:
            return await mark_overdue_invoices(session)

    result = await ctx.step.run("mark-overdue-invoices", _mark)
    ctx.logger.info(f"Overdue scan finished: {result['marked_overdue']} invoice(s) marked")
    return result


@inngest_client.create_function(
    fn_id="invoice.reminder-4d",
    trigger=inngest.TriggerEvent(event="invoice.sent"),
)
async def invoice_reminder_4d(ctx: inngest.Context) -> dict:
    """Sleep until 4 days past the due date, then email a payment reminder."""
    data = dict(ctx.event.data)
    invoice_id = str(data.get("invoice_id", ""))

    due_raw = data.get("due_date")
    if due_raw:
        due = datetime.fromisoformat(str(due_raw))
    else:
        # No explicit due date: treat issue+14 (standard terms) from now.
        due = datetime.utcnow() + timedelta(days=14)
    wake_at = due + timedelta(days=REMINDER_GRACE_DAYS)
    if wake_at > datetime.utcnow():
        await ctx.step.sleep_until("wait-until-4-days-past-due", wake_at)

    async def _check() -> dict:
        async with AsyncSessionLocal() as session:
            inv = await session.get(Invoice, invoice_id)
            if inv is None:
                return {"send": False, "reason": "invoice-deleted"}
            if inv.status not in ("sent", "overdue"):
                return {"send": False, "reason": f"status-{inv.status}"}
            client = await session.get(Client, inv.client_id) if inv.client_id else None
            return {
                "send": bool(client and client.email),
                "reason": "ok" if client and client.email else "no-client-email",
                "client_email": client.email if client else None,
                "client_name": client.name if client else "there",
                "invoice_number": inv.invoice_number,
                "amount": inv.total_amount,
                "due_date": inv.due_date.isoformat() if inv.due_date else None,
            }

    invoice = await ctx.step.run("check-still-unpaid", _check)
    if not invoice.get("send"):
        ctx.logger.info(f"Skipping invoice reminder: {invoice.get('reason')}")
        return {"skipped": True, "reason": invoice.get("reason")}

    async def _send() -> dict:
        due = datetime.fromisoformat(invoice["due_date"]) if invoice.get("due_date") else None
        subject, text, html = build_invoice_reminder_email(
            client_name=invoice["client_name"],
            invoice_number=invoice["invoice_number"],
            amount=float(invoice["amount"]),
            due_date=due,
        )
        return await send_email(to=invoice["client_email"], subject=subject, text=text, html=html)

    result = await ctx.step.run("send-reminder-email", _send)
    return {"sent": True, "provider": result.get("provider")}
