"""Inngest durable workflow for lead proposals (L4).

Unanswered proposals age silently, so money that is effectively gone still
reads as open on the pipeline. A daily scan flips past-expiry ``sent`` proposals
to ``expired``; the public accept path then refuses an expired version (see
proposals.py). The expiry logic lives in a module-level helper
(``expire_stale_proposals``) the hermetic tests run directly against a session,
mirroring the ``mark_overdue_invoices`` convention.
"""

from datetime import datetime

import inngest
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.inngest_client import emit, inngest_client
from app.models.proposal import Proposal


async def expire_stale_proposals(session, now: datetime | None = None) -> dict:
    """Move every 'sent' proposal whose expiry has passed to 'expired'.
    Returns a summary the cron step logs and the notice fan-out reads."""
    now = now or datetime.utcnow()
    res = await session.execute(
        select(Proposal).where(
            Proposal.status == "sent",
            Proposal.expires_at.is_not(None),
            Proposal.expires_at < now,
        )
    )
    expired = []
    for p in res.scalars().all():
        p.status = "expired"
        expired.append({
            "proposal_id": p.id,
            "title": p.title,
            "budget": p.budget,
            "workspace_id": p.workspace_id,
            "client_id": p.client_id,
        })
    await session.commit()
    return {"expired": len(expired), "proposals": expired}


@inngest_client.create_function(
    fn_id="lead.proposal-expiry-scan",
    trigger=inngest.TriggerCron(cron="15 7 * * *"),
)
async def lead_proposal_expiry_scan(ctx: inngest.Context) -> dict:
    """Daily sweep: expire unanswered proposals past their valid-through date
    and emit a notice per proposal so the pipeline reflects reality."""

    async def _run() -> dict:
        async with AsyncSessionLocal() as session:
            return await expire_stale_proposals(session)

    result = await ctx.step.run("expire-stale-proposals", _run)
    for prop in result.get("proposals", []):
        await emit("proposal.expired", {
            "proposal_id": prop["proposal_id"],
            "title": prop["title"],
            "budget": prop["budget"],
            "workspace_id": prop["workspace_id"],
            "client_id": prop["client_id"],
        })
    ctx.logger.info(f"Proposal expiry scan: {result['expired']} proposal(s) expired")
    return result
