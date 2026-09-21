from fastapi import APIRouter
from app.api.v1.endpoints import (
    health, 
    auth, 
    dashboard, 
    storage, 
    clients, 
    projects, 
    invoices, 
    time_entries, 
    expenses,
    contracts,
    proposals,
    intake,
    booking,
    automations,
    report_card
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, tags=["Authentication"])
api_router.include_router(dashboard.router, tags=["Dashboard"])
api_router.include_router(storage.router)
api_router.include_router(clients.router)
api_router.include_router(projects.router)
api_router.include_router(contracts.router)
api_router.include_router(invoices.router)
api_router.include_router(time_entries.router)
api_router.include_router(expenses.router)
api_router.include_router(proposals.router)
api_router.include_router(intake.router)
api_router.include_router(booking.router)
api_router.include_router(automations.router)
api_router.include_router(report_card.router, prefix="/report-card", tags=["Report Card"])



