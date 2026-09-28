"""Inngest durable workflows for contracts: 3-day signature reminder."""

from datetime import datetime, timedelta
import inngest
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.inngest_client import inngest_client
from app.models.contract import Contract
from app.models.client import Client
from app.services.email_service import build_contract_reminder_email, send_email

CONTRACT_REMINDER_DAYS = 3


@inngest_client.create_function(
    fn_id="contract.reminder-3d",
    trigger=inngest.TriggerEvent(event="contract.sent"),
)
async def contract_reminder_3d(ctx: inngest.Context) -> dict:
    """Sleep until 3 days after contract is sent, then email a signature reminder
    if the contract is still unsigned."""
    data = dict(ctx.event.data)
    contract_id = str(data.get("contract_id", ""))

    if not contract_id:
        return {"skipped": True, "reason": "missing-contract-id"}

    wake_at = datetime.utcnow() + timedelta(days=CONTRACT_REMINDER_DAYS)
    await ctx.step.sleep_until("wait-until-3-days", wake_at)

    async def _check() -> dict:
        async with AsyncSessionLocal() as session:
            contract = await session.get(Contract, contract_id)
            if not contract:
                return {"send": False, "reason": "contract-deleted"}
            if contract.status in ("signed", "declined", "cancelled"):
                return {"send": False, "reason": f"status-{contract.status}"}

            recipient_email = contract.recipient_email
            recipient_name = contract.recipient_name or "there"

            if not recipient_email and contract.client_id:
                client = await session.get(Client, contract.client_id)
                if client and client.email:
                    recipient_email = client.email
                    recipient_name = client.name or recipient_name

            if not recipient_email:
                return {"send": False, "reason": "no-recipient-email"}

            sign_link = f"{settings.WEB_APP_URL}/sign-contract/{contract.token}"
            return {
                "send": True,
                "reason": "ok",
                "recipient_email": recipient_email,
                "recipient_name": recipient_name,
                "contract_title": contract.title,
                "sign_link": sign_link,
            }

    target = await ctx.step.run("check-still-unsigned", _check)
    if not target.get("send"):
        ctx.logger.info(f"Skipping contract reminder: {target.get('reason')}")
        return {"skipped": True, "reason": target.get("reason")}

    async def _send() -> dict:
        subject, text, html = build_contract_reminder_email(
            client_name=target["recipient_name"],
            contract_title=target["contract_title"],
            sign_link=target["sign_link"],
        )
        return await send_email(to=target["recipient_email"], subject=subject, text=text, html=html)

    result = await ctx.step.run("send-contract-reminder-email", _send)
    ctx.logger.info(f"Contract signature reminder delivered via {result.get('provider')}")
    return {"sent": True, "provider": result.get("provider")}
