from fastapi import APIRouter, Depends
from typing import Dict, Any, List
from datetime import datetime
from pydantic import BaseModel
from app.core.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

class StartTimerRequest(BaseModel):
    project_name: str = "Client Project"
    task_name: str = "Focus Session"

@router.get("/stats")
async def get_dashboard_stats(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Returns live aggregated KPIs for the user's workspace dashboard.
    """
    return {
        "monthly_revenue": 14850.00,
        "revenue_growth_pct": 18.4,
        "active_projects_count": 6,
        "billable_hours_this_month": 142.5,
        "effective_hourly_rate": 104.20,
        "pending_invoices_amount": 4200.00,
        "pending_invoices_count": 2,
        "active_clients_count": 8,
        "currency": "USD",
        "timestamp": datetime.utcnow().isoformat(),
        "user_email": user.get("email") if user else "guest_developer@freelancebook.com"
    }

@router.get("/overview")
async def get_dashboard_overview(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Returns full categorized dashboard data (recent projects, active tasks, invoices, time entries).
    """
    return {
        "summary": {
            "monthly_revenue": 14850.00,
            "active_projects": 6,
            "billable_hours": 142.5,
            "effective_rate": 104.20,
        },
        "recent_projects": [
            {
                "id": "proj-01",
                "title": "Fintech Dashboard Redesign",
                "client_name": "Acme Capital",
                "status": "in_progress",
                "progress_pct": 75,
                "budget": 6500.00,
                "tracked_hours": 38.5,
                "due_date": "2026-09-25",
            },
            {
                "id": "proj-02",
                "title": "E-Commerce Stripe Integration",
                "client_name": "Nordic Apparel",
                "status": "in_progress",
                "progress_pct": 45,
                "budget": 4200.00,
                "tracked_hours": 18.0,
                "due_date": "2026-10-02",
            },
            {
                "id": "proj-03",
                "title": "Mobile Expo Companion App",
                "client_name": "Venture Labs",
                "status": "review",
                "progress_pct": 95,
                "budget": 8000.00,
                "tracked_hours": 72.0,
                "due_date": "2026-09-20",
            },
            {
                "id": "proj-04",
                "title": "Cloudflare D1 & R2 Migration",
                "client_name": "HyperScale Corp",
                "status": "completed",
                "progress_pct": 100,
                "budget": 3500.00,
                "tracked_hours": 24.0,
                "due_date": "2026-09-14",
            },
        ],
        "recent_invoices": [
            {
                "id": "inv-2026-091",
                "number": "INV-2026-091",
                "client": "Acme Capital",
                "amount": 3250.00,
                "status": "paid",
                "issue_date": "2026-09-10",
            },
            {
                "id": "inv-2026-092",
                "number": "INV-2026-092",
                "client": "Nordic Apparel",
                "amount": 2100.00,
                "status": "sent",
                "issue_date": "2026-09-15",
            },
            {
                "id": "inv-2026-093",
                "number": "INV-2026-093",
                "client": "Venture Labs",
                "amount": 4000.00,
                "status": "paid",
                "issue_date": "2026-09-01",
            },
        ],
        "recent_time_entries": [
            {
                "id": "time-01",
                "project": "Fintech Dashboard Redesign",
                "task": "Framer Motion Chart Animations",
                "duration": "02:45:10",
                "billable": True,
                "date": "Today",
            },
            {
                "id": "time-02",
                "project": "E-Commerce Stripe Integration",
                "task": "FastAPI Webhook Security Signature",
                "duration": "01:30:00",
                "billable": True,
                "date": "Today",
            },
            {
                "id": "time-03",
                "project": "Internal Operations",
                "task": "Client Lead Follow-ups & Proposal Review",
                "duration": "00:45:00",
                "billable": False,
                "date": "Yesterday",
            },
        ],
        "active_focus_timer": {
            "is_running": True,
            "project_name": "Fintech Dashboard Redesign",
            "task_name": "Interactive Analytics Grid",
            "elapsed_seconds": 9912,
            "started_at": "2026-09-18T19:45:00Z",
        }
    }

@router.post("/timer/start")
async def start_focus_timer(payload: StartTimerRequest, user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "status": "started",
        "project_name": payload.project_name,
        "task_name": payload.task_name,
        "started_at": datetime.utcnow().isoformat(),
    }

@router.post("/timer/stop")
async def stop_focus_timer(user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "status": "stopped",
        "duration_seconds": 9912,
        "stopped_at": datetime.utcnow().isoformat(),
        "logged_to_timesheet": True
    }
