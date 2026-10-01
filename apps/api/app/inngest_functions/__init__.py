"""Inngest workflows served from the FastAPI process.

app/main.py registers everything in `functions` with inngest.fast_api.serve()
when INNGEST_ENABLED is true. Keep this list in sync when adding job modules.
"""

from app.inngest_functions.booking_jobs import (
    booking_reminder_24h,
    booking_reminder_1h,
    booking_payment_confirmed,
)
from app.inngest_functions.calendar_jobs import google_calendar_sync
from app.inngest_functions.invoice_jobs import invoice_overdue_scan, invoice_reminder_4d
from app.inngest_functions.lead_jobs import lead_proposal_expiry_scan
from app.inngest_functions.contract_jobs import contract_reminder_3d, contract_expiry_scan
from app.inngest_functions.proposal_jobs import proposal_reminder_3d
from app.inngest_functions.project_jobs import project_status_scan, project_task_day_scan

functions = [
    invoice_overdue_scan,
    invoice_reminder_4d,
    lead_proposal_expiry_scan,
    booking_reminder_24h,
    booking_reminder_1h,
    booking_payment_confirmed,
    google_calendar_sync,
    contract_reminder_3d,
    contract_expiry_scan,
    proposal_reminder_3d,
    project_status_scan,
    project_task_day_scan,
]


