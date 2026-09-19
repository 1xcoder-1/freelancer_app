import time
import hashlib
from typing import Optional, Dict, Any
from botocore.config import Config
from botocore.exceptions import ClientError
from app.core.config import settings

# Optional lazy import for Cloudinary
try:
    import cloudinary
    import cloudinary.uploader
    import cloudinary.utils
    CLOUDINARY_AVAILABLE = True
except ImportError:
    CLOUDINARY_AVAILABLE = False

# Optional lazy import for boto3 (R2)
try:
    import boto3
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False


class StorageService:
    """
    Unified Cloud Storage Service for Freelance Book.
    Supports Cloudinary (Primary for media, images, receipts, contracts, PDFs)
    and Cloudflare R2 (S3-Compatible blob storage).
    """
    def __init__(self):
        self.provider = settings.STORAGE_PROVIDER.lower()
        self._init_cloudinary()
        self._init_r2()

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

    def _init_r2(self):
        self.bucket_name = settings.R2_BUCKET_NAME
        self.r2_enabled = bool(
            BOTO3_AVAILABLE and
            settings.R2_ACCOUNT_ID and 
            settings.R2_ACCESS_KEY_ID and 
            settings.R2_SECRET_ACCESS_KEY
        )
        self._r2_client = None

    @property
    def r2_client(self):
        if not self.r2_enabled:
            return None
        if self._r2_client is None:
            endpoint = settings.R2_ENDPOINT or f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
            self._r2_client = boto3.client(
                "s3",
                endpoint_url=endpoint,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                config=Config(signature_version="s3v4"),
                region_name="auto"
            )
        return self._r2_client

    def generate_presigned_upload_url(
        self, 
        file_key: str, 
        content_type: str = "application/octet-stream", 
        expires_in: int = 3600,
        folder: str = "freelance-book"
    ) -> Dict[str, Any]:
        """
        Generates signed upload parameters for direct client-side upload.
        Works seamlessly with Cloudinary or Cloudflare R2.
        """
        # 1. Cloudinary Upload Signature
        if self.provider == "cloudinary" and self.cloudinary_enabled:
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

        # 2. Cloudflare R2 Presigned PUT URL
        if self.r2_client:
            try:
                url = self.r2_client.generate_presigned_url(
                    ClientMethod="put_object",
                    Params={
                        "Bucket": self.bucket_name,
                        "Key": file_key,
                        "ContentType": content_type
                    },
                    ExpiresIn=expires_in
                )
                return {
                    "provider": "r2",
                    "upload_url": url,
                    "file_key": file_key,
                    "expires_in": expires_in,
                    "is_mock": False
                }
            except ClientError as e:
                return {"error": str(e), "file_key": file_key}

        # 3. Local Mock Fallback
        return {
            "provider": "mock",
            "upload_url": f"/api/v1/mock-upload/{file_key}",
            "file_key": file_key,
            "is_mock": True,
            "message": "Neither Cloudinary nor R2 configured; using local fallback."
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
        if self.provider == "cloudinary" and self.cloudinary_enabled:
            return cloudinary.utils.cloudinary_url(
                file_key, 
                secure=True, 
                resource_type="auto"
            )[0]

        # Cloudflare R2 Presigned GET URL
        if self.r2_client:
            try:
                url = self.r2_client.generate_presigned_url(
                    ClientMethod="get_object",
                    Params={
                        "Bucket": self.bucket_name,
                        "Key": file_key
                    },
                    ExpiresIn=expires_in
                )
                return url
            except ClientError:
                return None

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
        # 1. Cloudinary Direct Upload
        if self.provider == "cloudinary" and self.cloudinary_enabled:
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

        # 2. Cloudflare R2 Upload
        if self.r2_client:
            try:
                self.r2_client.put_object(
                    Bucket=self.bucket_name,
                    Key=file_key,
                    Body=file_bytes,
                    ContentType=content_type
                )
                return self.generate_presigned_download_url(file_key)
            except ClientError:
                return None

        return None

    def delete_file(self, file_key: str) -> bool:
        """
        Deletes an object from Cloudinary or Cloudflare R2.
        """
        if self.provider == "cloudinary" and self.cloudinary_enabled:
            try:
                public_id = file_key.rsplit(".", 1)[0] if "." in file_key else file_key
                res = cloudinary.uploader.destroy(public_id, resource_type="auto")
                return res.get("result") in ["ok", "not found"]
            except Exception:
                return False

        if self.r2_client:
            try:
                self.r2_client.delete_object(Bucket=self.bucket_name, Key=file_key)
                return True
            except ClientError:
                return False

        return False


storage_service = StorageService()
