# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are freelancers, solo consultants, independent contractors, and creative professionals who run their own client-facing businesses and need to manage their entire lifecycle from first discovery to final payment without juggling disconnected SaaS tools.

## Product Purpose

Freelance Book exists to eliminate the cognitive overhead, context switching, and fragmented subscriptions of independent work. Success means a freelancer can run their business end-to-end—capturing leads, sending proposals, executing contracts, tracking billable time, planning daily workflows, hosting branded link-in-bio pages, and collecting invoice payments—from a single, coherent, distraction-free operating system.

## Positioning

An all-in-one freelance operating system uniting the entire client lifecycle (`Lead ──> Proposal ──> Contract ──> Project ──> Time Tracking ──> Link Page ──> Invoice ──> Profit Analytics`) with zero disconnected silos, free-first architecture, and dark-first ergonomic aesthetics engineered specifically for solo operators.

## Operating Context

- **Workflows**: Daily focus planning, client discovery, contract drafting & e-signing, Kanban task management, one-click time tracking, public link-in-bio page sharing, invoice generation, and expense logging.
- **Environments**: Primarily Web (desktop and responsive mobile browsers), with planned Windows Desktop (Electron quick capture & floating timer) and Android Mobile (Expo / React Native on-the-go tracking).
- **Tools & Ecosystem**: Next.js 16 App Router, FastAPI backend, Cloudflare D1 (serverless SQL), Cloudflare R2 (storage), Clerk Auth, Tailwind CSS v4, and `shadcn/ui`.

## Capabilities and Constraints

- **Confirmed Functionality**:
  - Client CRM with contact records, revenue attribution, and interaction logs.
  - Project management with Kanban boards, milestones, and deliverable checklists.
  - Interactive time tracking with billable rates and effective hourly rate calculation.
  - Invoicing engine with line items, tax, discount codes, and payment status tracking.
  - Contracts and proposal vault with terms specification and document storage.
  - Public Link-in-Bio pages (`/p/[slug]`) with 6 distinct aesthetic templates and real-time mobile/desktop preview.
  - Dark-mode first UI architecture with accessible high-contrast tokens.
- **Technical Constraints**: Monorepo with pnpm workspaces, type-safety across TypeScript and Python, strict use of `shadcn/ui` with Tailwind CSS v4.

## Brand Commitments

- **Name**: Freelance Book
- **Voice**: Crisp, professional, empowering, efficient, and direct. No filler or corporate fluff.
- **Aesthetic**: Dark-first default (`#090d16` canvas, `#131b2e` elevated surface, emerald growth accents, electric indigo highlights), refined micro-interactions, and WCAG AA/AAA contrast.

## Evidence on Hand

- Verified production codebase in `apps/web` (Next.js 16, App Router).
- Complete product requirements in `docs/prd.md`.
- System architecture and monorepo standards in `docs/architecture.md`.
- UI/UX design tokens and component standards in `docs/design.md`.
- Technical verification checklist in `docs/checklist.md`.

## Product Principles

1. **One Continuous Pipeline**: Never force the user to re-enter data between leads, proposals, contracts, projects, time entries, and invoices.
2. **Speed Over Ceremony**: Actions (start timer, log expense, send link, copy URL) must be reachable in 1–2 clicks with minimal friction.
3. **Clarity Over Clutter**: Keep screens focused, bold, and to the point. Strip decorative noise that distracts from getting work done.
4. **Resilient Offline-Ready Feel**: Real-time caching, optimistic UI updates, zero blank loading screens, and robust error recovery.

## Accessibility & Inclusion

- Enforce WCAG AA/AAA contrast compliance across light and dark themes.
- Comprehensive keyboard navigation support (`Tab`, `Esc`, shortcut keys).
- Clear optical hierarchy and screen-reader accessible attributes (`aria-label`, semantic landmarks).
