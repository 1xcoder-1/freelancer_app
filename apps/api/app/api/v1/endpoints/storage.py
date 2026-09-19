import re
from fastapi import APIRouter, Query, HTTPException, status, Depends
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any
from app.core.auth import require_authenticated_user
from app.services.storage_service import storage_service

router = APIRouter(prefix="/storage", tags=["Storage & Media"])

ALLOWED_CONTENT_TYPES = {
    # Images
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
    # Documents & Invoices
    "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain", "text/csv",
    # Deliverables & Archives
    "application/zip", "application/x-zip-compressed", "application/octet-stream",
    # Videos for proposals
    "video/mp4", "video/webm", "video/quicktime"
}

class UploadUrlRequest(BaseModel):
    file_key: str = Field(..., min_length=3, max_length=200, description="Target file name e.g. 'receipt_101.png'")
    content_type: str = Field(default="application/octet-stream", description="MIME type of the file")
    category: str = Field(default="uploads", description="Category: 'receipts', 'invoices', 'contracts', 'proposals', 'deliverables'")
    expires_in: int = Field(default=3600, ge=60, le=86400, description="Expiration in seconds")

    @field_validator("file_key")
    @classmethod
    def sanitize_file_key(cls, v: str) -> str:
        # Prevent Directory Traversal / malicious path injection
        clean = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', v.strip().lstrip('/\\'))
        if not clean or clean.startswith('.'):
            raise ValueError("Invalid file name format")
        return clean

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, v: str) -> str:
        v_clean = v.lower().strip()
        if v_clean not in ALLOWED_CONTENT_TYPES:
            raise ValueError(f"Unsupported file type '{v_clean}'. Uploads must be valid images, documents, or archives.")
        return v_clean


@router.post("/upload-signature", summary="Get Signed Upload Parameters (Protected)")
async def get_upload_signature(
    payload: UploadUrlRequest,
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
) -> Dict[str, Any]:
    """
    [SECURE] Generates a signed upload token for Cloudinary or presigned PUT URL for R2.
    - Requires authenticated Clerk user token.
    - Enforces user workspace folder sandboxing to prevent cross-user file overwrites.
    - Validates MIME content types against security whitelists.
    """
    user_id = current_user.get("user_id", "anonymous_user")
    # Isolated user folder sandbox
    sandboxed_folder = f"freelance-book/{user_id}/{payload.category}"
    sandboxed_key = f"{user_id}_{payload.file_key}"

    return storage_service.generate_presigned_upload_url(
        file_key=sandboxed_key,
        content_type=payload.content_type,
        expires_in=payload.expires_in,
        folder=sandboxed_folder
    )


@router.get("/download-url", summary="Get Secure File Access URL (Protected)")
async def get_file_url(
    file_key: str = Query(..., min_length=2, max_length=250, description="File key or public_id"),
    current_user: Dict[str, Any] = Depends(require_authenticated_user)
):
    """
    [SECURE] Retrieves a secure CDN URL to view or download an asset for authenticated users.
    """
    clean_key = re.sub(r'[^a-zA-Z0-9_\-\.\/]', '_', file_key.strip())
    url = storage_service.generate_presigned_download_url(clean_key)
    if not url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File or storage provider not found"
        )
    return {"file_key": clean_key, "url": url}

