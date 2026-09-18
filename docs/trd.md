# Freelance Book — Technical Requirements Document (TRD)

## 1. Monorepo & System Architecture

Freelance Book is structured as a pnpm monorepo using Turborepo. All frontend applications (Web, Desktop, Mobile) share UI component primitives, TypeScript type definitions, and API client libraries, communicating with a centralized high-performance Python FastAPI backend.

```
freelance-book/
├── apps/
│   ├── web/        # Next.js 16 (App Router, React 19, TypeScript)
│   ├── mobile/     # React Native (Expo Router, Android)
│   ├── desktop/    # Electron (Windows .exe installer, system tray, quick capture)
│   └── api/        # Python 3.12+ / FastAPI backend
├── packages/
│   ├── ui/         # Shared shadcn/ui components & Tailwind v4 theme
│   ├── types/      # Shared TypeScript data transfer objects & schemas
│   ├── config/     # Shared configuration (ESLint, TSConfig, Tailwind)
│   └── api-client/ # Shared typed REST SDK
├── docs/           # PRD, TRD, Design, Architecture, and Checklist documentation
└── infra/          # Infrastructure configurations
```

---

## 2. Technology Stack & Role Matrix

| Component | Technology | Simple Meaning | Role in Freelance Book |
| :--- | :--- | :--- | :--- |
| **Authentication** | **Clerk** | Auth as a Service | User login/signup, session tokens, password resets, email verification, OAuth. |
| **Backend API** | **FastAPI** (Python 3.12+) | Async Python Web Framework | Business logic, API endpoints, permissions, Pydantic validation, AI orchestration. |
| **Primary Database** | **Cloudflare D1** | Free Serverless SQL Database | Relational storage for users, clients, projects, tasks, invoices, payments, etc. |
| **Database ORM** | **SQLAlchemy 2.0** (Async) | Python Database Toolkit / ORM | Asynchronous Python ORM (`sqlite+aiosqlite`) for database access, schema mapping, and queries. |
| **Migrations** | **Alembic** | DB Schema Migration Tool | Tracks and applies database migrations safely to Cloudflare D1. |
| **Caching & Queue** | **Upstash Redis** | Serverless Redis Store | Caching, API rate limiting, temporary state, optional message queues. |
| **File Storage** | **Cloudflare R2** | S3-Compatible Object Store | Storage for invoice PDFs, images, ZIP files, project attachments, and client assets. |
| **Realtime** | **FastAPI WebSockets** | Bi-directional Connection | Live comments, live notifications, task status updates, and user presence. |
| **Transactional Email** | **Brevo** | Email Service Provider | Sending invoice notifications, client invitations, account alerts. |
| **Background Jobs** | **Inngest** | Background Workflow Engine | Scheduled billing reminders, recurring jobs, background workflow automation. |
| **Push Notifications** | **FCM (Firebase)** | Mobile Push Notification Service | Push notifications for Android devices. |
| **AI Models** | **Gemini / OpenAI API** | LLM Services | AI assistant capabilities ("Book AI") integrated via FastAPI server. |
| **Monitoring** | **Sentry** | Crash Reporting & APM | Real-time error tracking and performance monitoring. |

---

## 3. Important Architecture Decision: Cloudflare D1 & Supabase Status

> [!IMPORTANT]
> **Database Architecture Decision**: The primary database is **Cloudflare D1** (Serverless SQL Database).
> - **Primary Database**: Cloudflare D1 (Free Serverless SQL).
> - **Primary Auth**: Clerk.
> - **Primary Storage**: Cloudflare R2.
> - **Primary Backend**: Python FastAPI + SQLAlchemy 2 (`sqlite+aiosqlite`).
> 
> *Supabase remains strictly OPTIONAL*: Supabase is not used as a primary DB or primary backend.

---

## 4. Deep Dive: Key Technical Questions

### 4.1. Authentication — Clerk
- **What is used?**: **Clerk** (`@clerk/nextjs` on frontend, Clerk JWT verification on backend).
- **Integrated with Python Backend?**: **YES**.
- **How it works**:
  1. Frontend user signs in via Clerk UI/SDK.
  2. Clerk issues a session JWT token to the client app.
  3. Client passes the Clerk JWT token in the `Authorization: Bearer <token>` header on API requests to FastAPI.
  4. FastAPI middleware verifies the token signature against Clerk's public key or secret key (`CLERK_SECRET_KEY`).
  5. FastAPI extracts the `user_id` and attaches user workspace & role-based permissions before performing database operations via SQLAlchemy.

### 4.2. Object-Relational Mapper (ORM) — SQLAlchemy 2.0 & Alembic
- **What is used?**: **SQLAlchemy 2.0** (Async mode using `sqlite+aiosqlite`) alongside **Alembic** for schema migrations.
- **When & How is it used?**:
  - Used during every backend API call that interacts with Cloudflare D1.
  - Defines declarative Python model classes representing D1 SQL tables.
  - Manages database transactions, filtering, joins, and data serialization.
  - Alembic auto-generates SQL migration scripts (`alembic revision --autogenerate`) and applies them (`alembic upgrade head`).
- **Integrated with Python Backend?**: **YES**.
  - SQLAlchemy 2 is a native Python library executing directly inside the FastAPI backend application process.

### 4.3. Database — Cloudflare D1 & Upstash Redis
- **What is used?**: **Cloudflare D1** as the free serverless SQL database, supplemented by **Upstash Redis** for cache/rate-limiting.
- **Integrated with Python Backend?**: **YES**.
  - FastAPI connects to Cloudflare D1 using SQLAlchemy 2 with `sqlite+aiosqlite`.
  - FastAPI connects to Upstash Redis using `redis-py` / `aioredis`.

---

## 5. Deployment Guide: Free & Scalable Cloud Hosting

| Tier | Component | Recommended Free Platform | Deployment Method |
| :--- | :--- | :--- | :--- |
| **Frontend** | `apps/web` (Next.js 16) | **Vercel** / **Railway** | Connect GitHub repo to Vercel/Railway ➔ Auto build (`pnpm --dir apps/web build`). |
| **Backend API** | `apps/api` (FastAPI) | **Render** / **Railway** / **Cloudflare** | Deploy Python container / web service on Render/Railway using `Dockerfile` or `uvicorn app.main:app`. |
| **Database** | Primary SQL DB | **Cloudflare D1** | Free serverless D1 database hosted on Cloudflare edge. |
| **Storage** | Assets & PDFs | **Cloudflare R2** | Free 10GB S3-compatible object bucket hosted on Cloudflare. |
| **Authentication** | User Accounts | **Clerk** | Free tier up to 10,000 monthly active users (MAU). |

---

## 6. Development & Deployment Commands

### 6.1. Environment Setup (Windows PowerShell)
```powershell
# Prerequisites
git --version; node --version; npm --version; python --version

# Global pnpm
npm install -g pnpm

# Setup Virtual Environment for Python API
cd apps/api
py -m venv .venv
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install fastapi "uvicorn[standard]" pydantic pydantic-settings sqlalchemy alembic aiosqlite httpx redis pytest pytest-asyncio ruff
pip freeze > requirements.txt
```

### 6.2. Database Migration Commands (Alembic)
```powershell
cd apps/api
.\.venv\Scripts\Activate.ps1

# Initialize migration repository (first time)
alembic init alembic

# Create auto-generated migration schema
alembic revision --autogenerate -m "initial database schema"

# Apply migration to Cloudflare D1 / SQLite
alembic upgrade head
```

### 6.3. Running Applications
```powershell
# Web Application (Next.js)
pnpm --dir apps/web dev

# Python Backend API
cd apps/api
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```
