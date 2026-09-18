from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "Freelance Book API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    
    # CORS Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]
    
    # Primary Database (Cloudflare D1 - Serverless SQL Database)
    DATABASE_URL: str = "sqlite+aiosqlite:///./freelance_book.db"
    CLOUDFLARE_ACCOUNT_ID: str = ""
    CLOUDFLARE_D1_DATABASE_ID: str = ""
    CLOUDFLARE_API_TOKEN: str = ""
    
    # Clerk Authentication
    CLERK_SECRET_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = ""
    CLERK_ISSUER: Optional[str] = None
    
    # Cache & Temporary Workloads (Upstash Redis)
    REDIS_URL: str = ""
    
    # Transactional Email (Brevo)
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = "noreply@freelancebook.com"
    BREVO_SENDER_NAME: str = "Freelance Book"
    
    # Object & File Storage (Cloudflare R2)
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "freelance-book-assets"
    R2_ENDPOINT: str = ""
    
    # Background Workflows (Inngest)
    INNGEST_EVENT_KEY: str = ""
    INNGEST_SIGNING_KEY: str = ""
    
    # AI Engines
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    
    # Error Monitoring
    SENTRY_DSN: str = ""
    
    # Optional Supabase (If selected for specific realtime needs)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
