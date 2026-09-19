from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.workspace import get_or_create_user_workspace
from app.models.finance import Expense
from app.models.project import Project
from app.schemas.domain import ExpenseCreate, ExpenseOut

router = APIRouter(prefix="/expenses", tags=["Expenses & Taxes"])

@router.get("", response_model=List[ExpenseOut])
async def list_expenses(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Expense).where(Expense.workspace_id == workspace.id).order_by(Expense.created_at.desc())
    result = await db.execute(stmt)
    expenses = result.scalars().all()
    return [
        {
            "id": exp.id,
            "workspace_id": exp.workspace_id,
            "project_id": exp.project_id,
            "category": exp.category,
            "amount": exp.amount,
            "description": exp.description,
            "receipt_cloudinary_url": exp.receipt_r2_url,
            "created_at": exp.created_at
        }
        for exp in expenses
    ]

@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
async def create_expense(
    payload: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)

    if payload.project_id:
        p_res = await db.execute(
            select(Project).where(Project.id == payload.project_id, Project.workspace_id == workspace.id)
        )
        if not p_res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Project not found in current workspace")

    expense = Expense(
        workspace_id=workspace.id,
        project_id=payload.project_id,
        category=payload.category,
        amount=payload.amount,
        description=payload.description,
        receipt_r2_url=payload.receipt_cloudinary_url
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return {
        "id": expense.id,
        "workspace_id": expense.workspace_id,
        "project_id": expense.project_id,
        "category": expense.category,
        "amount": expense.amount,
        "description": expense.description,
        "receipt_cloudinary_url": expense.receipt_r2_url,
        "created_at": expense.created_at
    }

@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Expense).where(Expense.id == expense_id, Expense.workspace_id == workspace.id)
    res = await db.execute(stmt)
    expense = res.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    await db.delete(expense)
    await db.commit()
