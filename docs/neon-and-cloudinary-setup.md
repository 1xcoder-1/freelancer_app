# Neon & Cloudinary Setup Guide

---

## 1. Overview & Architectural Roles

In **Freelance Book**, we use **Neon** and **Cloudinary** together for two distinct and complementary roles:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             FREELANCE BOOK APP                              │
├──────────────────────────────────────┬──────────────────────────────────────┤
│               NEON                   │             CLOUDINARY               │
│    (Primary Serverless PostgreSQL)   │      (Media & Document Storage)      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • Structured data (tables, numbers)  │ • Media & files (PDFs, images, ZIPs) │
│ • Fast relational queries & indexes  │ • Automatic image resizing & preview │
│ • Multi-tenant workspaces & CRM      │ • Signed direct-upload URLs          │
│ • Real-time transactions & timers    │ • Secure delivery & transformations  │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. Feature Mapping: What Uses Neon vs. What Uses Cloudinary

| Feature Module | What is Saved in **Neon (PostgreSQL)** | What is Saved in **Cloudinary (Storage & CDN)** |
| :--- | :--- | :--- |
| **Invoicing & Payments** | Invoice numbers, dates, amounts, taxes, line items, status (`Paid`/`Late`), Stripe IDs. | Generated vector Invoice PDF files and official payment receipts. |
| **Client CRM & Contacts** | Client names, emails, addresses, lifetime value, notes, health scores. | Client logo images and company branding assets. |
| **Project & Task Management** | Projects, milestones, kanban columns, subtasks, deadlines, priorities. | Project brief documents, spec files, and design attachment files. |
| **Time Tracking & Billing** | Start/stop timestamps, duration seconds, billable flags, hourly rates. | *(All numerical data stored in Neon)* |
| **Contracts & E-Signatures** | Legal clause text, e-signature timestamps, signer IP addresses, status. | Final signed, legally binding Contract PDF documents. |
| **Proposals & AI Generator** | Proposal scope text, packages, deliverables checklists, pricing items. | Proposal cover images, embedded PDFs, Loom-style video pitches. |
| **Visual Proofing & Annotations** | Pinned feedback X/Y coordinates, comment text, resolution ticks. | Design preview mockups, UI screenshots, and annotated images. |
| **Expense & Income Tracking** | Expense amounts, dates, tax categories, deductible flags, net profit. | Scanned receipt photos (auto-optimized & compressed) and receipts. |
| **Asset Vault & Link Hub** | External URLs (GitHub, LinkedIn, Behance), rate cards, text templates. | Uploaded Resume/CV PDFs, portfolio sample files, capability decks. |
| **Client Portal** | Milestone progress %, chat messages, approval records, timestamps. | Final deliverable ZIP packages, source code archives, high-res exports. |

---

## 3. How to Connect Neon PostgreSQL (Backend)

### Step 1: Your Neon Connection String
Your Neon connection string is configured in [`apps/api/.env`](file:///c:/Users/coder/Desktop/freelancer%20book/apps/api/.env):
```env
DATABASE_URL=postgresql+asyncpg://neondb_owner:npg_YUXGMd5ghv1H@ep-patient-star-b4tnogzf-pooler.c-6.us-east-2.aws.neon.tech/neondb?ssl=require
```

### Step 2: Automatic Initialization
When FastAPI boots up, SQLAlchemy creates and verifies all 28 tables automatically:
```powershell
cd apps/api
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

---

## 4. How to Connect Cloudinary (Backend)

### Step 1: Get Cloudinary API Keys
1. Log in to your [Cloudinary Dashboard](https://cloudinary.com/console).
2. On your dashboard, copy:
   - **Cloud Name**
   - **API Key**
   - **API Secret**
   *(Or copy the complete `CLOUDINARY_URL` string)*.

### Step 2: Add to `apps/api/.env`
Paste your credentials into [`apps/api/.env`](file:///c:/Users/coder/Desktop/freelancer%20book/apps/api/.env):
```env
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 5. Why Frontend Never Needs Storage or Database Secrets

```
┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
│                 │           │                 │           │  NEON DATABASE  │
│  FRONTEND APP   │ ────────> │   FASTAPI API   │ ────────> │   (PostgreSQL)  │
│  (Next.js Web / │  Bearer   │    (Backend)    │           └─────────────────┘
│   Mobile / PC)  │   Token   │                 │           ┌─────────────────┐
│                 │           │                 │ ────────> │   CLOUDINARY    │
└─────────────────┘           └─────────────────┘           │  (Media/Files)  │
                                                            └─────────────────┘
```

- **Security**: Database passwords and Cloudinary API Secrets **never** touch the frontend or client browsers.
- **Direct Uploads**: The frontend asks FastAPI for a short-lived signed upload token (`/api/v1/storage/upload-url`), then uploads the file directly to Cloudinary without overloading the backend server.
