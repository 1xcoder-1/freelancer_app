import time
import hashlib
from typing import Optional, Dict, Any
from app.core.config import settings

# Optional lazy import for Cloudinary
try:
    import cloudinary
    import cloudinary.uploader
    import cloudinary.utils
    CLOUDINARY_AVAILABLE = True
except ImportError:
    CLOUDINARY_AVAILABLE = False


class StorageService:
    """
    Unified Cloud Storage Service for Freelance Book.
    Uses Cloudinary as the primary storage provider for media, images,
    receipts, contracts and PDFs, with a local mock fallback for dev.
    """
    def __init__(self):
        self._init_cloudinary()

    def _init_cloudinary(self):
        self.cloudinary_enabled = bool(
            CLOUDINARY_AVAILABLE and (
                (settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET) or
                settings.CLOUDINARY_URL
            )
        )
        if self.cloudinary_enabled:
            if settings.CLOUDINARY_URL:
                cloudinary.config(cloudinary_url=settings.CLOUDINARY_URL)
            else:
                cloudinary.config(
                    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                    api_key=settings.CLOUDINARY_API_KEY,
                    api_secret=settings.CLOUDINARY_API_SECRET,
                    secure=True
                )

    def generate_presigned_upload_url(
        self, 
        file_key: str, 
        content_type: str = "application/octet-stream", 
        expires_in: int = 3600,
        folder: str = "freelance-book"
    ) -> Dict[str, Any]:
        """
        Generates signed upload parameters for direct client-side upload
        to Cloudinary.
        """
        # Cloudinary Upload Signature
        if self.cloudinary_enabled:
            timestamp = int(time.time())
            params_to_sign = {
                "timestamp": timestamp,
                "folder": folder,
                "public_id": file_key.rsplit(".", 1)[0] if "." in file_key else file_key
            }
            signature = cloudinary.utils.api_sign_request(
                params_to_sign, 
                settings.CLOUDINARY_API_SECRET
            )
            return {
                "provider": "cloudinary",
                "upload_url": f"https://api.cloudinary.com/v1_1/{settings.CLOUDINARY_CLOUD_NAME}/auto/upload",
                "api_key": settings.CLOUDINARY_API_KEY,
                "timestamp": timestamp,
                "signature": signature,
                "folder": folder,
                "public_id": params_to_sign["public_id"],
                "file_key": file_key,
                "is_mock": False
            }

        # Local Mock Fallback
        return {
            "provider": "mock",
            "upload_url": f"/api/v1/mock-upload/{file_key}",
            "file_key": file_key,
            "is_mock": True,
            "message": "Cloudinary is not configured; using local fallback."
        }

    def generate_presigned_download_url(
        self, 
        file_key: str, 
        expires_in: int = 3600
    ) -> Optional[str]:
        """
        Generates a secure access URL to view or download a file.
        """
        # Cloudinary direct secure URL
        if self.cloudinary_enabled:
            return cloudinary.utils.cloudinary_url(
                file_key, 
                secure=True, 
                resource_type="auto"
            )[0]

        return f"/api/v1/mock-files/{file_key}"

    def upload_bytes(
        self, 
        file_bytes: bytes, 
        file_key: str, 
        content_type: str = "application/octet-stream",
        folder: str = "freelance-book"
    ) -> Optional[str]:
        """
        Uploads server-generated files (e.g. Invoices, PDFs, export archives) directly.
        Returns the public/secure file URL upon success.
        """
        # Cloudinary Direct Upload
        if self.cloudinary_enabled:
            try:
                public_id = file_key.rsplit(".", 1)[0] if "." in file_key else file_key
                res = cloudinary.uploader.upload(
                    file_bytes,
                    public_id=public_id,
                    folder=folder,
                    resource_type="auto",
                    overwrite=True
                )
                return res.get("secure_url") or res.get("url")
            except Exception:
                return None

        return None

    def delete_file(self, file_key: str) -> bool:
        """
        Deletes an object from Cloudinary.
        """
        if self.cloudinary_enabled:
            try:
                public_id = file_key.rsplit(".", 1)[0] if "." in file_key else file_key
                res = cloudinary.uploader.destroy(public_id, resource_type="auto")
                return res.get("result") in ["ok", "not found"]
            except Exception:
                return False

        return False


storage_service = StorageService()
