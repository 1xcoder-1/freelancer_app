"""Pluggable outbound email for background-job notifications.

Console logging is the default so reminder flows stay visible in dev without
any provider account; set RESEND_API_KEY to deliver real mail through Resend.
Inngest jobs import only this module (never a vendor SDK directly), keeping
provider swaps a one-file change. send_email intentionally propagates
provider errors so Inngest step retries can do their job.
"""

from datetime import datetime

import httpx

from app.core.config import settings

_RESEND_URL = "https://api.resend.com/emails"


def provider_name() -> str:
    return "resend" if settings.RESEND_API_KEY else "console"


async def send_email(to: str, subject: str, text: str, html: str | None = None) -> dict:
    """Deliver via Resend when configured, otherwise log to the console."""
    if settings.RESEND_API_KEY:
        payload: dict = {
            "from": settings.EMAIL_FROM,
            "to": [to],
            "subject": subject,
            "text": text,
        }
        if html:
            payload["html"] = html
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                _RESEND_URL,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json=payload,
            )
            res.raise_for_status()
            return {"provider": "resend", "id": res.json().get("id")}

    # Dev fallback: log the full message so flows are testable end-to-end
    # without credentials. Nothing leaves the machine.
    print(f"[email:console] to={to} subject={subject}\n{text}\n{'-' * 60}")
    return {"provider": "console", "to": to, "subject": subject}


def build_invoice_reminder_email(
    *,
    client_name: str,
    invoice_number: str,
    amount: float,
    due_date: datetime | None,
) -> tuple[str, str, str]:
    """Polite overdue reminder for a sent/past-due invoice (4-day follow-up)."""
    due_label = due_date.strftime("%B %d, %Y") if due_date else "the agreed date"
    subject = f"Reminder: Invoice {invoice_number} was due {due_label}"
    pay_link = settings.WEB_APP_URL
    text = (
        f"Hi {client_name},\n\n"
        f"Just a friendly reminder that invoice {invoice_number} for "
        f"${amount:,.2f} was due on {due_label} and is still outstanding.\n\n"
        f"If payment has already been sent, please disregard this note. "
        f"Otherwise you can settle it online: {pay_link}\n\n"
        f"Thank you,\nFreelance Book"
    )
    html = (
        f"<p>Hi {client_name},</p>"
        f"<p>Just a friendly reminder that invoice <strong>{invoice_number}</strong> "
        f"for <strong>${amount:,.2f}</strong> was due on {due_label} and is still outstanding.</p>"
        f"<p>If payment has already been sent, please disregard this note. "
        f'Otherwise you can <a href="{pay_link}">settle it online</a>.</p>'
        f"<p>Thank you,<br>Freelance Book</p>"
    )
    return subject, text, html


def build_booking_reminder_email(
    *,
    client_name: str,
    consultation_title: str,
    appointment_time: datetime,
    meeting_link: str | None,
) -> tuple[str, str, str]:
    """24-hours-before reminder for a scheduled consultation."""
    when_label = appointment_time.strftime("%A, %B %d at %H:%M UTC")
    subject = f"Reminder: {consultation_title} is tomorrow ({when_label})"
    link_line = f"You can join here: {meeting_link}\n\n" if meeting_link else ""
    text = (
        f"Hi {client_name},\n\n"
        f"This is a reminder that your session \"{consultation_title}\" is "
        f"scheduled for {when_label}.\n\n"
        f"{link_line}"
        f"Talk soon,\nFreelance Book"
    )
    html = (
        f"<p>Hi {client_name},</p>"
        f"<p>This is a reminder that your session <strong>{consultation_title}</strong> "
        f"is scheduled for {when_label}.</p>"
        + (f'<p>You can <a href="{meeting_link}">join here</a>.</p>' if meeting_link else "")
        + "<p>Talk soon,<br>Freelance Book</p>"
    )
    return subject, text, html
