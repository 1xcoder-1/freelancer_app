from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.auth import require_authenticated_user
from app.core.workspace import get_or_create_user_workspace
from app.core.inngest_client import emit
from app.models.contract import Contract, ContractEvent, ContractTemplate, generate_token
from app.models.project import Project
from app.models.client import Client
from app.models.workspace import Workspace
from app.services.revenue_at_stake import compute_revenue_at_stake
from app.schemas.domain import (
    ContractCreate,
    ContractSignRequest,
    ContractSenderSignRequest,
    ContractDeclineRequest,
    ContractEventOut,
    ContractTemplateCreate,
    ContractTemplateOut,
    ContractOut,
    PublicContractOut,
)

router = APIRouter(prefix="/contracts", tags=["Contracts & E-Signatures"])

# Statuses that mean the sign link is dead for the recipient — the public route
# refuses to execute against either with a clean 410 (N2 expiry / N5 supersede).
_DEAD_STATUSES = ("expired", "superseded")


def _client_ip(request: Request) -> str:
    """Best-effort originating IP for the signature/read-receipt audit trail.

    Behind Vercel/Cloudflare `request.client.host` is the edge proxy, so the
    real visitor lives in the proxy-set headers. Read in trust order and never
    used for authorisation — it is a forensic stamp only, so a spoofed value
    can't grant access, it just gets truncated like everything else.
    """
    for header in ("cf-connecting-ip", "x-real-ip"):
        value = request.headers.get(header)
        if value:
            return value
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "Unknown IP"


def _user_agent(request: Request) -> str:
    return (request.headers.get("user-agent") or "Unknown Device")[:500]


def _is_expired(contract: Contract, now: Optional[datetime] = None) -> bool:
    now = now or datetime.utcnow()
    return bool(contract.expires_at and contract.expires_at < now)


def _record_event(
    db: AsyncSession,
    contract: Contract,
    event: str,
    request: Optional[Request] = None,
    note: Optional[str] = None,
) -> None:
    """Append an immutable audit row (N1). Caller commits in the same txn.

    When a Request is present the actor IP + user agent are captured so the
    detail-page timeline can evidence *where* a signature or view happened —
    the single ``viewed_ip`` column was collected but never surfaced before."""
    db.add(ContractEvent(
        contract_id=contract.id,
        workspace_id=contract.workspace_id,
        event=event,
        occurred_at=datetime.utcnow(),
        actor_ip=_client_ip(request)[:120] if request else None,
        actor_user_agent=_user_agent(request) if request else None,
        note=(note[:2000] if note else None),
    ))


def _freelancer_display(contract: Contract, workspace: Optional[Workspace]) -> str:
    """Sender display name. ``sender_signature`` doubles as the authorized-signer
    name (a plain text value on create); a drawn counter-signature is an image
    blob, in which case fall back to the workspace name rather than a data URL."""
    sig = contract.sender_signature or ""
    if sig and not sig.lower().startswith("data:image"):
        return sig
    if workspace and workspace.name:
        return workspace.name
    return sig or "Freelancer"


def _serialize_contract(
    c: Contract,
    project_title: Optional[str] = None,
    client_name: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "id": c.id,
        "workspace_id": c.workspace_id,
        "project_id": c.project_id,
        "project_title": project_title,
        "client_id": c.client_id,
        "client_name": client_name,
        "title": c.title,
        "content": c.content,
        "status": c.status,
        "token": c.token,
        "recipient_name": c.recipient_name,
        "recipient_email": c.recipient_email,
        "sender_signature": c.sender_signature,
        "sender_signed_at": c.sender_signed_at,
        "viewed_at": c.viewed_at,
        "viewed_user_agent": c.viewed_user_agent,
        "viewed_ip": c.viewed_ip,
        "client_signature": c.client_signature,
        "client_signed_at": c.client_signed_at,
        "client_ip": c.client_ip,
        "client_user_agent": c.client_user_agent,
        "file_url": c.file_url,
        "expires_at": c.expires_at,
        "expire_days": c.expire_days,
        "version": c.version,
        "supersedes_id": c.supersedes_id,
        "fully_executed_at": c.fully_executed_at,
        "created_at": c.created_at,
    }


async def _maybe_fully_execute(c: Contract, db: AsyncSession, request: Optional[Request]) -> None:
    """N6: ``fully_executed_at`` is stamped only when *both* parties have signed —
    never at creation. Called from both the client-sign and the counter-sign path
    so the order the parties sign in doesn't matter."""
    if c.client_signed_at and c.sender_signed_at and not c.fully_executed_at:
        c.fully_executed_at = datetime.utcnow()
        c.status = "fully_executed"
        _record_event(db, c, "fully_executed", request)


# ------------------------------------------------------------------------------
# Static clause snippets (N4) + Templates — literal paths, declared before
# `/{contract_id}` so they are never matched as an id.
# ------------------------------------------------------------------------------

CLAUSE_SNIPPETS: List[Dict[str, str]] = [
    {"key": "scope", "title": "Scope & Change Control", "body": "Any work outside the agreed Statement of Work is handled as a written change request, priced separately before it begins."},
    {"key": "revisions", "title": "Revision Cap", "body": "Each deliverable includes two rounds of revisions. Additional rounds are billed at the hourly rate set out above."},
    {"key": "late_fee", "title": "Late Fee", "body": "Invoices are payable within the stated terms. Overdue balances accrue a 1.5% monthly finance charge."},
    {"key": "kill_fee", "title": "Kill Fee / Early Termination", "body": "Either party may terminate with 14 days written notice. On termination, the Client pays for all work completed plus a 15% kill fee on the remaining balance."},
    {"key": "ip_transfer", "title": "IP Transfer", "body": "All intellectual property in the deliverables transfers to the Client only upon receipt of full payment. Until then the Provider retains all rights."},
    {"key": "expenses", "title": "Expense Reimbursement", "body": "Pre-approved third-party expenses (stock, hosting, fonts) are reimbursed at cost and invoiced alongside fees."},
]


@router.get("/clauses", response_model=List[Dict[str, str]])
async def list_clause_snippets(
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Reusable clause bodies the editor can drop into a contract (N4)."""
    return CLAUSE_SNIPPETS


@router.get("/at-stake", response_model=Dict[str, Any])
async def contracts_at_stake(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """Revenue blocked behind unsigned paperwork (N3 / F4).

    One shared aggregate: unsigned-contract value (project budget), unbilled
    time (hours x rate) and unpaid invoices (balance). Declared before
    ``/{contract_id}`` so the literal path is never swallowed as an id."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    return await compute_revenue_at_stake(db, workspace.id, workspace.currency)


@router.get("/templates", response_model=List[ContractTemplateOut])
async def list_contract_templates(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(
        select(ContractTemplate)
        .where(ContractTemplate.workspace_id == workspace.id)
        .order_by(ContractTemplate.is_default.desc(), ContractTemplate.created_at.desc())
    )
    return res.scalars().all()


@router.post("/templates", response_model=ContractTemplateOut, status_code=status.HTTP_201_CREATED)
async def create_contract_template(
    payload: ContractTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    tpl = ContractTemplate(
        workspace_id=workspace.id,
        title=payload.title,
        content=payload.content,
        category=payload.category,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contract_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(
        select(ContractTemplate).where(
            ContractTemplate.id == template_id,
            ContractTemplate.workspace_id == workspace.id,
        )
    )
    tpl = res.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(tpl)
    await db.commit()
    return None


# ------------------------------------------------------------------------------
# Authenticated Workspace Contract Management
# ------------------------------------------------------------------------------

@router.get("", response_model=List[ContractOut])
async def list_contracts(
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)

    query = select(Contract).where(Contract.workspace_id == workspace.id)
    if project_id:
        query = query.where(Contract.project_id == project_id)
    query = query.order_by(Contract.created_at.desc())
    result = await db.execute(query)
    contracts = result.scalars().all()

    project_ids = [c.project_id for c in contracts if c.project_id]
    client_ids = [c.client_id for c in contracts if c.client_id]

    projects_map = {}
    if project_ids:
        p_res = await db.execute(
            select(Project).where(Project.id.in_(project_ids), Project.workspace_id == workspace.id)
        )
        projects_map = {p.id: p.title for p in p_res.scalars().all()}

    clients_map = {}
    if client_ids:
        c_res = await db.execute(
            select(Client).where(Client.id.in_(client_ids), Client.workspace_id == workspace.id)
        )
        clients_map = {c.id: c.name for c in c_res.scalars().all()}

    now = datetime.utcnow()
    out = []
    for c in contracts:
        row = _serialize_contract(c, projects_map.get(c.project_id), clients_map.get(c.client_id) if c.client_id else None)
        # N2 "awaiting signature for N days" + days-to-expiry, computed on the
        # server clock so the card never does date maths during render.
        if c.status in ("sent", "viewed") and c.created_at:
            row["days_awaiting"] = max(0, (now - c.created_at).days)
        if c.expires_at:
            row["days_left"] = (c.expires_at - now).days
        out.append(row)
    return out


@router.post("", response_model=ContractOut, status_code=status.HTTP_201_CREATED)
async def create_contract(
    payload: ContractCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    user, workspace = await get_or_create_user_workspace(db, current_user)

    p_res = await db.execute(
        select(Project).where(Project.id == payload.project_id, Project.workspace_id == workspace.id)
    )
    project = p_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found in current workspace")

    contract = Contract(
        workspace_id=workspace.id,
        project_id=project.id,
        client_id=payload.client_id or project.client_id,
        title=payload.title,
        content=payload.content,
        recipient_name=payload.recipient_name,
        recipient_email=payload.recipient_email,
      # The authorized-sender name is recorded here, but N6: the sender's
        # signature is NOT considered adopted (sender_signed_at stays null) until
        # t  hey counter-sign — so "fully signed" is only ever true after both.
        sender_signature=payload.sender_signature or user.full_name or "Workspace Owner",
        sender_signed_at=None,
        status="sent",
        # N2: seed the sign-link expiry from the requested window.
        expire_days=payload.expire_days,
        expires_at=datetime.utcnow() + timedelta(days=payload.expire_days),
        version=1,
    )
    db.add(contract)
    await db.flush()  # assign id before the audit row references it
    _record_event(db, contract, "sent")
    await db.commit()
    await db.refresh(contract)

    client_name = None
    if contract.client_id:
        c_res = await db.execute(
            select(Client).where(Client.id == contract.client_id, Client.workspace_id == workspace.id)
        )
        cl = c_res.scalar_one_or_none()
        if cl:
            client_name = cl.name

    await emit(
        "contract.sent",
        {
            "contract_id": contract.id,
            "title": contract.title,
            "recipient_email": contract.recipient_email,
            "recipient_name": contract.recipient_name,
            "workspace_id": contract.workspace_id,
            "client_id": contract.client_id,
        },
    )

    return _serialize_contract(contract, project.title, client_name)


@router.get("/{contract_id}", response_model=ContractOut)
async def get_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Contract).where(Contract.id == contract_id, Contract.workspace_id == workspace.id)
    result = await db.execute(stmt)
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    project_title = None
    if contract.project_id:
        p_res = await db.execute(
            select(Project).where(Project.id == contract.project_id, Project.workspace_id == workspace.id)
        )
        p = p_res.scalar_one_or_none()
        if p:
            project_title = p.title

    client_name = None
    if contract.client_id:
        c_res = await db.execute(
            select(Client).where(Client.id == contract.client_id, Client.workspace_id == workspace.id)
        )
        cl = c_res.scalar_one_or_none()
        if cl:
            client_name = cl.name

    return _serialize_contract(contract, project_title, client_name)


@router.get("/{contract_id}/events", response_model=List[ContractEventOut])
async def get_contract_events(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """N1 audit timeline (workspace-scoped; a foreign id is a 404)."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    exists = await db.execute(
        select(Contract.id).where(Contract.id == contract_id, Contract.workspace_id == workspace.id)
    )
    if not exists.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Contract not found")
    res = await db.execute(
        select(ContractEvent)
        .where(ContractEvent.contract_id == contract_id, ContractEvent.workspace_id == workspace.id)
        .order_by(ContractEvent.occurred_at.asc())
    )
    return res.scalars().all()


@router.post("/{contract_id}/sign-sender", response_model=ContractOut)
async def sign_sender_contract(
    contract_id: str,
    payload: ContractSenderSignRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """N6 counter-sign: the freelancer adopts their signature after (or before)
    the client; full execution only lands once both are present."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(
        select(Contract).where(Contract.id == contract_id, Contract.workspace_id == workspace.id)
    )
    contract = res.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.status in _DEAD_STATUSES:
        raise HTTPException(status_code=410, detail="This version is no longer executable.")

    contract.sender_signature = payload.sender_signature
    contract.sender_signed_at = datetime.utcnow()
    _record_event(db, contract, "counter_signed", request)
    was_complete = contract.fully_executed_at is not None
    await _maybe_fully_execute(contract, db, request)
    await db.commit()
    await db.refresh(contract)

    if contract.fully_executed_at and not was_complete:
        await emit(
            "contract.fully_executed",
            {
                "contract_id": contract.id,
                "title": contract.title,
                "workspace_id": contract.workspace_id,
                "recipient_email": contract.recipient_email,
            },
        )

    project_title = None
    if contract.project_id:
        p_res = await db.execute(
            select(Project).where(Project.id == contract.project_id, Project.workspace_id == workspace.id)
        )
        p = p_res.scalar_one_or_none()
        if p:
            project_title = p.title
    return _serialize_contract(contract, project_title, None)


@router.post("/{contract_id}/resend", response_model=ContractOut)
async def resend_contract(
    contract_id: str,
    payload: ContractCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """N5 re-send creates v2 and marks v1 superseded so the old link stops being
    signable and you can prove which version of the terms was accepted."""
    user, workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(
        select(Contract).where(Contract.id == contract_id, Contract.workspace_id == workspace.id)
    )
    old = res.scalar_one_or_none()
    if not old:
        raise HTTPException(status_code=404, detail="Contract not found")
    if old.status in ("signed", "fully_executed"):
        raise HTTPException(status_code=409, detail="A signed contract cannot be superseded; draft a new one instead.")

    p_res = await db.execute(
        select(Project).where(Project.id == payload.project_id, Project.workspace_id == workspace.id)
    )
    project = p_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found in current workspace")

    new = Contract(
        workspace_id=workspace.id,
        project_id=payload.project_id,
        client_id=payload.client_id or project.client_id,
        title=payload.title,
        content=payload.content,
        recipient_name=payload.recipient_name or old.recipient_name,
        recipient_email=payload.recipient_email or old.recipient_email,
        sender_signature=payload.sender_signature or old.sender_signature or user.full_name or "Workspace Owner",
        sender_signed_at=None,
        status="sent",
        expire_days=payload.expire_days,
        expires_at=datetime.utcnow() + timedelta(days=payload.expire_days),
        version=old.version + 1,
        supersedes_id=old.id,
    )
    db.add(new)
    await db.flush()
    old.status = "superseded"
    _record_event(db, new, "sent", note=f"Version {new.version} (re-send)")
    _record_event(db, old, "superseded", note=f"Replaced by v{new.version}")
    await db.commit()
    await db.refresh(new)

    await emit("contract.sent", {
        "contract_id": new.id,
        "title": new.title,
        "recipient_email": new.recipient_email,
        "recipient_name": new.recipient_name,
        "workspace_id": new.workspace_id,
        "client_id": new.client_id,
    })
    return _serialize_contract(new, project.title, None)


@router.post("/{contract_id}/save-as-template", response_model=ContractTemplateOut, status_code=status.HTTP_201_CREATED)
async def save_contract_as_template(
    contract_id: str,
    payload: ContractTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """N4: promote a good contract into a reusable template."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(
        select(Contract).where(Contract.id == contract_id, Contract.workspace_id == workspace.id)
    )
    contract = res.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    tpl = ContractTemplate(
        workspace_id=workspace.id,
        title=payload.title,
        content=payload.content or contract.content,
        category=payload.category,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.post("/{contract_id}/rotate-token", response_model=ContractOut)
async def rotate_contract_token(
    contract_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """SE10: revoke a possibly-leaked sign link by minting a fresh token. The old
    URL stops resolving immediately (the public routes key on `token`), and the
    action is written to the audit trail."""
    _, workspace = await get_or_create_user_workspace(db, current_user)
    res = await db.execute(
        select(Contract).where(Contract.id == contract_id, Contract.workspace_id == workspace.id)
    )
    contract = res.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.status in ("signed", "fully_executed"):
        raise HTTPException(status_code=409, detail="An executed contract's link cannot be rotated.")

    contract.token = generate_token()
    _record_event(db, contract, "token_rotated", request=request, note="Sign link rotated by owner")
    await db.commit()
    await db.refresh(contract)
    return _serialize_contract(contract)


@router.delete("/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    _, workspace = await get_or_create_user_workspace(db, current_user)
    stmt = select(Contract).where(Contract.id == contract_id, Contract.workspace_id == workspace.id)
    result = await db.execute(stmt)
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    await db.delete(contract)
    await db.commit()
    return None


# ------------------------------------------------------------------------------
# Public Client E-Sign & Real-Time Tracking Endpoints (Token-Based)
# ------------------------------------------------------------------------------

def _public_payload(contract: Contract, project: Optional[Project], workspace: Optional[Workspace]) -> Dict[str, Any]:
    return {
        "id": contract.id,
        "title": contract.title,
        "content": contract.content,
        "status": contract.status,
        "token": contract.token,
        "project_title": project.title if project else "",
        "freelancer_name": _freelancer_display(contract, workspace),
        "recipient_name": contract.recipient_name,
        "recipient_email": contract.recipient_email,
        "sender_signature": contract.sender_signature if (contract.sender_signature and not contract.sender_signature.lower().startswith("data:image")) else None,
        "sender_signed_at": contract.sender_signed_at,
        "viewed_at": contract.viewed_at,
        "client_signature": contract.client_signature,
        "client_signed_at": contract.client_signed_at,
        "expires_at": contract.expires_at,
        "superseded": contract.status == "superseded",
        "fully_executed_at": contract.fully_executed_at,
        "created_at": contract.created_at,
    }


@router.get("/public/{token}", response_model=PublicContractOut)
async def get_public_contract(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Contract).where(Contract.token == token)
    result = await db.execute(stmt)
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract link is invalid or expired")

    # Real-Time Read Receipt Trigger: record the client opened the contract, and
    # append the N1 "opened" audit row carrying the viewer IP the old code dropped.
    if contract.status in ("sent", "draft") and not contract.viewed_at:
        contract.status = "viewed"
        contract.viewed_at = datetime.utcnow()
        contract.viewed_user_agent = _user_agent(request)
        contract.viewed_ip = _client_ip(request)[:120]
        _record_event(db, contract, "opened", request)
        await db.commit()
        await db.refresh(contract)

    p_res = await db.execute(select(Project).where(Project.id == contract.project_id))
    project = p_res.scalar_one_or_none()
    w_res = await db.execute(select(Workspace).where(Workspace.id == contract.workspace_id))
    workspace = w_res.scalar_one_or_none()

    return _public_payload(contract, project, workspace)


@router.post("/public/{token}/sign", response_model=PublicContractOut)
async def sign_public_contract(
    token: str,
    payload: ContractSignRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Contract).where(Contract.token == token)
    result = await db.execute(stmt)
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract link is invalid or expired")

    if contract.status == "signed":
        raise HTTPException(status_code=400, detail="Contract has already been signed")
    # N5: a superseded version must not be executable — point them at the latest.
    if contract.status == "superseded":
        raise HTTPException(status_code=410, detail="This version has been replaced. Please sign the latest version.")
    # N2: an expired offer is gone; refuse with 410 even if the daily scan hasn't
    # run yet, so the DB-status flip and the wall-clock check can't disagree.
    if contract.status == "expired" or _is_expired(contract):
        raise HTTPException(status_code=410, detail="This version has expired. Please request a new copy.")

    contract.client_signature = payload.client_signature
    contract.client_signed_at = datetime.utcnow()
    contract.client_ip = _client_ip(request)[:120]
    contract.client_user_agent = _user_agent(request)
    contract.status = "signed"
    if payload.recipient_name:
        contract.recipient_name = payload.recipient_name
    if payload.recipient_email:
        contract.recipient_email = payload.recipient_email
    _record_event(db, contract, "signed", request)
    # N6: only execute fully if the freelancer already counter-signed.
    await _maybe_fully_execute(contract, db, request)

    await db.commit()
    await db.refresh(contract)

    await emit(
        "contract.signed",
        {
            "contract_id": contract.id,
            "title": contract.title,
            "workspace_id": contract.workspace_id,
            "client_signature": contract.client_signature,
            "recipient_name": contract.recipient_name,
            "recipient_email": contract.recipient_email,
        },
    )

    p_res = await db.execute(select(Project).where(Project.id == contract.project_id))
    project = p_res.scalar_one_or_none()
    w_res = await db.execute(select(Workspace).where(Workspace.id == contract.workspace_id))
    workspace = w_res.scalar_one_or_none()

    return _public_payload(contract, project, workspace)


@router.post("/public/{token}/decline", response_model=PublicContractOut)
async def decline_public_contract(
    token: str,
    payload: ContractDeclineRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """N1/N3: let the recipient decline, which drops the value out of the
    revenue-at-stake pool and records why in the audit trail."""
    stmt = select(Contract).where(Contract.token == token)
    result = await db.execute(stmt)
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract link is invalid or expired")
    if contract.status in ("signed", "fully_executed"):
        raise HTTPException(status_code=400, detail="A signed contract cannot be declined")

    contract.status = "declined"
    _record_event(db, contract, "declined", request, note=payload.reason)
    await db.commit()
    await db.refresh(contract)

    p_res = await db.execute(select(Project).where(Project.id == contract.project_id))
    project = p_res.scalar_one_or_none()
    w_res = await db.execute(select(Workspace).where(Workspace.id == contract.workspace_id))
    workspace = w_res.scalar_one_or_none()
    return _public_payload(contract, project, workspace)
