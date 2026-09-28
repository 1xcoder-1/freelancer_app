"""Inngest durable workflows for projects & deliverables: daily status check."""

from datetime import datetime
import inngest
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.inngest_client import inngest_client
from app.models.project import Project, Milestone


async def scan_active_projects_and_milestones(session) -> dict:
    """Scan active projects and pending milestones for progress tracking.
    Module-level so it can be tested directly."""
    # 1. Active Projects
    p_stmt = select(Project).where(Project.status == "in_progress")
    p_res = await session.execute(p_stmt)
    active_projects = [
        {"id": p.id, "title": p.title, "status": p.status}
        for p in p_res.scalars().all()
    ]

    # 2. Pending Milestones
    m_stmt = select(Milestone).where(Milestone.is_completed == False)  # noqa: E712
    m_res = await session.execute(m_stmt)
    pending_milestones = [
        {"id": m.id, "title": m.title, "project_id": m.project_id}
        for m in m_res.scalars().all()
    ]

    return {
        "active_projects_count": len(active_projects),
        "pending_milestones_count": len(pending_milestones),
        "projects": active_projects,
        "milestones": pending_milestones,
    }


@inngest_client.create_function(
    fn_id="project.status-scan",
    trigger=inngest.TriggerCron(cron="0 7 * * *"),
)
async def project_status_scan(ctx: inngest.Context) -> dict:
    """Daily cron sweep: check active projects and incomplete milestones."""

    async def _scan() -> dict:
        async with AsyncSessionLocal() as session:
            return await scan_active_projects_and_milestones(session)

    result = await ctx.step.run("scan-active-projects", _scan)
    ctx.logger.info(
        f"Project status scan completed: {result['active_projects_count']} active project(s), "
        f"{result['pending_milestones_count']} pending milestone(s)"
    )
    return result
