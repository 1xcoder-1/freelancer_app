import time
import hashlib
import re
from typing import Optional, Dict, Any
import httpx
from app.core.config import settings


class StorageService:
    """
    Unified Cloud Storage Service for Freelance Book.
    Uses Cloudinary via native REST API (httpx) for media, images,
    receipts, contracts and PDFs, with zero SDK dependency.
    """
    def __init__(self):
        self._init_cloudinary()

    def _init_cloudinary(self):
        self.cloud_name = settings.CLOUDINARY_CLOUD_NAME or ""
        self.api_key = settings.CLOUDINARY_API_KEY or ""
        self.api_secret = settings.CLOUDINARY_API_SECRET or ""

        if not (self.cloud_name and self.api_key and self.api_secret) and settings.CLOUDINARY_URL:
            # Parse cloudinary://api_key:api_secret@cloud_name
            match = re.match(r"cloudinary://([^:]+):([^@]+)@(.+)", settings.CLOUDINARY_URL)
            if match:
                self.api_key = match.group(1)
                self.api_secret = match.group(2)
                self.cloud_name = match.group(3)

        self.cloudinary_enabled = bool(self.cloud_name and self.api_key and self.api_secret)

    def _sign_params(self, params: Dict[str, Any]) -> str:
        """Cloudinary standard SHA-1 parameter signature."""
        keys_to_exclude = {"file", "cloud_name", "resource_type", "api_key"}
        sorted_pairs = [
            f"{k}={params[k]}" 
            for k in sorted(params.keys()) 
            if params[k] is not None and k not in keys_to_exclude
        ]
        to_sign = "&".join(sorted_pairs) + self.api_secret
        return hashlib.sha1(to_sign.encode("utf-8")).hexdigest()

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
        if self.cloudinary_enabled:
            timestamp = int(time.time())
            public_id = file_key.rsplit(".", 1)[0] if "." in file_key else file_key
            params_to_sign = {
                "folder": folder,
                "public_id": public_id,
                "timestamp": timestamp,
            }
            signature = self._sign_params(params_to_sign)
            return {
                "provider": "cloudinary",
                "upload_url": f"https://api.cloudinary.com/v1_1/{self.cloud_name}/auto/upload",
                "api_key": self.api_key,
                "timestamp": timestamp,
                "signature": signature,
                "folder": folder,
                "public_id": public_id,
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
        if self.cloudinary_enabled:
            clean_key = file_key.lstrip("/")
            return f"https://res.cloudinary.com/{self.cloud_name}/image/upload/{clean_key}"

        return f"/api/v1/mock-files/{file_key}"

    def upload_bytes(
        self, 
        file_bytes: bytes, 
        file_key: str, 
        content_type: str = "application/octet-stream",
        folder: str = "freelance-book"
    ) -> Optional[str]:
        """
        Uploads server-generated files or uploaded media directly to Cloudinary.
        Returns the public/secure file URL upon success.
        """
        if self.cloudinary_enabled:
            try:
                public_id = file_key.rsplit(".", 1)[0] if "." in file_key else file_key
                timestamp = int(time.time())
                params_to_sign = {
                    "folder": folder,
                    "overwrite": "true",
                    "public_id": public_id,
                    "timestamp": timestamp,
                }
                signature = self._sign_params(params_to_sign)

                data = {
                    "api_key": self.api_key,
                    "timestamp": str(timestamp),
                    "folder": folder,
                    "public_id": public_id,
                    "overwrite": "true",
                    "signature": signature,
                }
                filename = file_key if "." in file_key else f"{file_key}.bin"
                files = {
                    "file": (filename, file_bytes, content_type)
                }

                upload_url = f"https://api.cloudinary.com/v1_1/{self.cloud_name}/auto/upload"
                with httpx.Client(timeout=30.0) as client:
                    resp = client.post(upload_url, data=data, files=files)
                    if resp.status_code in (200, 201):
                        res_json = resp.json()
                        return res_json.get("secure_url") or res_json.get("url")
                    else:
                        import logging
                        logging.getLogger(__name__).error(
                            f"Cloudinary REST upload failed ({resp.status_code}): {resp.text}"
                        )
                        return None
            except Exception as e:
                import logging
                logging.getLogger(__name__).exception(f"Cloudinary upload exception: {e}")
                return None

        return None


storage_service = StorageService()
