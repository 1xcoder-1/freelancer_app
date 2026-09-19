import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.workspace import get_or_create_user_workspace
from app.models.intake import IntakeForm, IntakeSubmission
from app.models.client import Client
from app.models.workspace import Workspace
from app.schemas.domain import (
    IntakeFormCreate,
    IntakeFormOut,
    PublicIntakeFormOut,
    IntakeSubmissionCreate,
    IntakeSubmissionOut,
    IntakeQuestion,
)

router = APIRouter(prefix="/intake", tags=["Client Intake Forms"])

@router.get("", response_model=List[IntakeFormOut])
async def list_intake_forms(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(IntakeForm).where(IntakeForm.workspace_id == workspace.id).order_by(IntakeForm.created_at.desc())
    result = await db.execute(stmt)
    forms = result.scalars().all()

    out = []
    for f in forms:
        try:
            raw_questions = json.loads(f.questions_json)
        except Exception:
            raw_questions = []

        sub_stmt = select(func.count(IntakeSubmission.id)).where(IntakeSubmission.form_id == f.id)
        sub_res = await db.execute(sub_stmt)
        count = sub_res.scalar_one() or 0

        out.append({
            "id": f.id,
            "workspace_id": f.workspace_id,
            "client_id": f.client_id,
            "title": f.title,
            "description": f.description,
            "questions": raw_questions,
            "status": f.status,
            "token": f.token,
            "submissions_count": count,
            "created_at": f.created_at
        })
    return out

@router.post("", response_model=IntakeFormOut, status_code=status.HTTP_201_CREATED)
async def create_intake_form(
    payload: IntakeFormCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)

    if payload.client_id:
        c_res = await db.execute(
            select(Client).where(Client.id == payload.client_id, Client.workspace_id == workspace.id)
        )
        if not c_res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Client not found in current workspace")

    questions_data = [q.model_dump() for q in payload.questions]
    form = IntakeForm(
        workspace_id=workspace.id,
        client_id=payload.client_id,
        title=payload.title,
        description=payload.description,
        questions_json=json.dumps(questions_data),
        status="active"
    )
    db.add(form)
    await db.commit()
    await db.refresh(form)

    return {
        "id": form.id,
        "workspace_id": form.workspace_id,
        "client_id": form.client_id,
        "title": form.title,
        "description": form.description,
        "questions": payload.questions,
        "status": form.status,
        "token": form.token,
        "submissions_count": 0,
        "created_at": form.created_at
    }

@router.delete("/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_intake_form(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(IntakeForm).where(IntakeForm.id == form_id, IntakeForm.workspace_id == workspace.id)
    result = await db.execute(stmt)
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Intake form not found")

    await db.delete(form)
    await db.commit()
    return None

@router.get("/public/{token}", response_model=PublicIntakeFormOut)
async def get_public_intake_form(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(IntakeForm).where(IntakeForm.token == token)
    result = await db.execute(stmt)
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Intake form not found or link expired")

    w_res = await db.execute(select(Workspace).where(Workspace.id == form.workspace_id))
    workspace = w_res.scalar_one_or_none()

    try:
        raw_questions = json.loads(form.questions_json)
    except Exception:
        raw_questions = []

    return {
        "id": form.id,
        "title": form.title,
        "description": form.description,
        "questions": raw_questions,
        "freelancer_name": workspace.name if workspace else "Freelancer",
        "token": form.token,
        "created_at": form.created_at
    }

@router.post("/public/{token}/submit", response_model=IntakeSubmissionOut, status_code=status.HTTP_201_CREATED)
async def submit_public_intake_form(
    token: str,
    payload: IntakeSubmissionCreate,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(IntakeForm).where(IntakeForm.token == token)
    result = await db.execute(stmt)
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Intake form not found or link expired")

    submission = IntakeSubmission(
        form_id=form.id,
        client_name=payload.client_name,
        client_email=payload.client_email,
        answers_json=json.dumps(payload.answers)
    )
    db.add(submission)
    await db.commit()
    await db.refresh(submission)

    return {
        "id": submission.id,
        "form_id": submission.form_id,
        "client_name": submission.client_name,
        "client_email": submission.client_email,
        "answers": payload.answers,
        "created_at": submission.created_at
    }

@router.get("/{form_id}/submissions", response_model=List[IntakeSubmissionOut])
async def list_form_submissions(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    # Verify form belongs to current workspace
    f_res = await db.execute(select(IntakeForm).where(IntakeForm.id == form_id, IntakeForm.workspace_id == workspace.id))
    form = f_res.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Intake form not found")

    stmt = select(IntakeSubmission).where(IntakeSubmission.form_id == form.id).order_by(IntakeSubmission.created_at.desc())
    result = await db.execute(stmt)
    submissions = result.scalars().all()

    out = []
    for s in submissions:
        try:
            ans = json.loads(s.answers_json)
        except Exception:
            ans = {}
        out.append({
            "id": s.id,
            "form_id": s.form_id,
            "client_name": s.client_name,
            "client_email": s.client_email,
            "answers": ans,
            "created_at": s.created_at
        })
    return out
