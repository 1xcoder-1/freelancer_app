"""Inngest workflows served from the FastAPI process.

app/main.py registers everything in `functions` with inngest.fast_api.serve()
when INNGEST_ENABLED is true. Keep this list in sync when adding job modules.
"""

from app.inngest_functions.booking_jobs import booking_reminder_24h
from app.inngest_functions.invoice_jobs import invoice_overdue_scan, invoice_reminder_4d

functions = [invoice_overdue_scan, invoice_reminder_4d, booking_reminder_24h]
