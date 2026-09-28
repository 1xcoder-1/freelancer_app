"""Inngest durable workflows for proposals: 3-day follow-up reminder."""

from datetime import datetime, timedelta
import inngest
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.inngest_client import inngest_client
from app.models.proposal import Proposal
from app.models.client import Client
from app.services.email_service import build_proposal_reminder_email, send_email

PROPOSAL_REMINDER_DAYS = 3


@inngest_client.create_function(
    fn_id="proposal.reminder-3d",
    trigger=inngest.TriggerEvent(event="proposal.sent"),
)
async def proposal_reminder_3d(ctx: inngest.Context) -> dict:
    """Sleep until 3 days after a proposal is sent, then email a polite follow-up
    if the proposal is still pending/unanswered."""
    data = dict(ctx.event.data)
    proposal_id = str(data.get("proposal_id", ""))

    if not proposal_id:
        return {"skipped": True, "reason": "missing-proposal-id"}

    wake_at = datetime.utcnow() + timedelta(days=PROPOSAL_REMINDER_DAYS)
    await ctx.step.sleep_until("wait-until-3-days", wake_at)

    async def _check() -> dict:
        async with AsyncSessionLocal() as session:
            prop = await session.get(Proposal, proposal_id)
            if not prop:
                return {"send": False, "reason": "proposal-deleted"}
            if prop.status not in ("sent", "draft", "pending"):
                return {"send": False, "reason": f"status-{prop.status}"}

            client_email = None
            client_name = "there"
            if prop.client_id:
                client = await session.get(Client, prop.client_id)
                if client:
                    client_email = client.email
                    client_name = client.name or client_name

            if not client_email:
                return {"send": False, "reason": "no-client-email"}

            proposal_link = f"{settings.WEB_APP_URL}/portal/{prop.token}" if prop.token else settings.WEB_APP_URL
            return {
                "send": True,
                "reason": "ok",
                "client_email": client_email,
                "client_name": client_name,
                "proposal_title": prop.title,
                "proposal_link": proposal_link,
            }

    target = await ctx.step.run("check-still-pending", _check)
    if not target.get("send"):
        ctx.logger.info(f"Skipping proposal reminder: {target.get('reason')}")
        return {"skipped": True, "reason": target.get("reason")}

    async def _send() -> dict:
        subject, text, html = build_proposal_reminder_email(
            client_name=target["client_name"],
            proposal_title=target["proposal_title"],
            proposal_link=target.get("proposal_link"),
        )
        return await send_email(to=target["client_email"], subject=subject, text=text, html=html)

    result = await ctx.step.run("send-proposal-reminder-email", _send)
    ctx.logger.info(f"Proposal follow-up delivered via {result.get('provider')}")
    return {"sent": True, "provider": result.get("provider")}
