# System Architecture & Technical Specification

## 1. Overview & Monorepo Architecture

Freelancer Book is organized as a high-performance monorepo using **Turborepo** and **pnpm workspaces**.

```
freelancer-book/
├── apps/
│   ├── web/        # Next.js 16 (App Router, React 19, Tailwind CSS v4, shadcn/ui)
│   ├── mobile/     # React Native (Expo SDK 57)
│   ├── desktop/    # Electron + React Desktop App
│   └── api/        # Python FastAPI High-Performance Backend API
├── packages/
│   ├── ui/         # Shared shadcn/ui component primitives & Tailwind design tokens
│   ├── api-client/ # Shared TypeScript REST/API SDK
│   ├── types/      # Shared TypeScript data transfer objects & schemas
│   └── config/     # Shared ESLint, TypeScript, and Tailwind configurations
├── docs/           # Architecture, Design, and Checklist documentation
└── .agents/        # AI Agent Rules, Graphify directives, and standards
```

---

## 2. Component & Application Architecture

### Web Application (`apps/web`)
- **Framework**: Next.js 16 (App Router) + React 19
- **Styling & UI**: Tailwind CSS v4 + `shadcn/ui` (Primary UI Component Library)
- **State Management**: Zustand & React Query (`@tanstack/react-query`)
- **Forms & Validation**: React Hook Form + Zod
- **Authentication**: Clerk (`@clerk/nextjs`)

### Mobile Application (`apps/mobile`)
- **Framework**: React Native + Expo (SDK 57)
- **State & Data**: React Query + Zustand

### Desktop Application (`apps/desktop`)
- **Framework**: Electron + React
- **Security**: Context isolation enabled, IPC bridge via `preload.ts`

### Backend Service (`apps/api`)
- **Framework**: Python 3.12+ / FastAPI / Uvicorn
- **Database ORM**: SQLAlchemy 2.0 async / Alembic migrations
- **Caching**: Redis
- **Background Jobs**: Inngest (Python SDK) — implemented. The serve endpoint
  (`/api/inngest`) is mounted directly on the FastAPI app (gated by
  `INNGEST_ENABLED`), so no separate worker process exists. Durable workflows:
  daily overdue-invoice scan (cron), 4-day payment reminder (`sleep_until`),
  and 24h-before booking reminder — all delivering through the pluggable
  `email_service` (console in dev, Resend in prod). Events are emitted from
  the invoice/booking endpoints with a failure guard: job-infrastructure
  outages can never fail a user request.

---

## 3. Dependency Graph & Module Boundaries (Graphify Directive)

- Applications in `apps/*` consume shared packages from `packages/*`.
- Shared UI elements MUST reside in `packages/ui` using `shadcn/ui` primitives.
- Circular dependencies between packages or apps are strictly prohibited.
- `graphify` dependency tracing is mandated before executing refactors or structural code changes.
