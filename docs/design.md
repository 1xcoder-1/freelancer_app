# Freelance Book — Design System & UI/UX Standards

## 1. UI Architecture & Primary Component Library

All user interfaces across the **Web** (Next.js 16), **Windows Desktop** (Electron wrapper), and **Shared UI Components** (`packages/ui`) MUST strictly utilize **`shadcn/ui`** as the primary component library, styled with **Tailwind CSS v4**.

```
packages/ui/ (shadcn/ui Component Primitives)
      ├── Button, Card, Dialog, Sheet Drawer
      ├── Input, Form, Select, DropdownMenu, Table
      ├── Tabs, Accordion, Badge, Toast, Tooltip
      └── Skeleton, ScrollArea, Avatar, Separator
            │
            ├── App Router Layouts (apps/web)
            ├── Electron Desktop Window (apps/desktop)
            └── Native Cross-Platform UI Patterns (apps/mobile)
```

- **Primary UI Library**: `shadcn/ui` with Tailwind CSS v4.
- **Icons**: `lucide-react` icons strictly.
- **Animations & Micro-interactions**: `framer-motion` for page transitions, tab switches, dynamic list reordering, and hover effects.
- **Charts & Data Visualization**: `recharts` for financial charts, monthly revenue, billable vs non-billable hours, and project profitability.
- **Rich Text Editor**: `@tiptap/react` for project notes, proposals, daily logs, and contract specs.

---

## 2. Color System & Aesthetics (Tailwind v4 OKLCH Tokens)

Freelance Book enforces a **sleek, dark-first premium aesthetic** tailored for modern freelancers. Colors are defined using high-precision OKLCH color spaces.

| Design Token | Color Representation | OKLCH / Hex Value | Application |
| :--- | :--- | :--- | :--- |
| `--background` | Deep Slate Navy | `oklch(0.12 0.02 260)` / `#090d16` | Main application canvas background |
| `--card` / `--surface` | Elevated Slate Blue | `oklch(0.18 0.03 260)` / `#131b2e` | Cards, sidebars, modals, panels |
| `--border` | Subtle Translucent Slate | `rgba(255, 255, 255, 0.08)` | Borders, divider lines, outline rings |
| `--primary` | Vibrant Emerald Growth | `oklch(0.69 0.17 160)` / `#10b981` | Primary CTA buttons, paid status, growth charts |
| `--secondary` | Electric Indigo / Violet | `oklch(0.58 0.21 270)` / `#6366f1` | Book AI triggers, quick action highlights, badges |
| `--muted` | Cool Slate Gray | `oklch(0.40 0.02 260)` / `#64748b` | Muted labels, disabled states |
| `--foreground` | Crisp Crisp White | `oklch(0.98 0.00 0)` / `#f8fafc` | Primary text headlines and body text |

---

## 3. Core Database Architecture

- **Primary Database**: **Cloudflare D1** (Free Serverless SQL Database).
- **ORM & Migrations**: SQLAlchemy 2.0 (`sqlite+aiosqlite`) & Alembic.
- **Object Storage**: **Cloudflare R2** (S3-Compatible Edge Bucket).

---

## 4. Key Screen Layout Blueprints

### 4.1. Freelancer Operating Dashboard
- **Top Navigation Bar**: Sticky backdrop blur (`backdrop-blur-md bg-background/80`), quick search trigger (`Ctrl+K`), Quick Add button, user workspace switcher, notifications bell.
- **Hero Metrics Strip**: 4 summary cards showing Monthly Revenue (with trend chart sparkline), Active Projects, Billable Hours Tracked, Outstanding Invoices alert.
- **Main Workspace Split**:
  - **Left 65%**: Today's Focus timer widget, Active Kanban summary, GitHub-style Activity feed.
  - **Right 35%**: Quick notes pad, Book AI suggestion widget, upcoming deadlines calendar.

### 4.2. Windows Desktop Quick Capture (`Ctrl+Shift+F`)
- **Overlay Window**: Framer Motion animated modal appearing centered on press of `Ctrl+Shift+F`.
- **Quick Action Selector**: Segmented control (`shadcn/ui` ToggleGroup) for: `Task` | `Note` | `Time` | `Expense` | `Client`.
- **Minimal Input**: Auto-focused text input with keyboard shortcuts (`Enter` to submit, `Esc` to dismiss).

### 4.3. Client CRM & Client Portal
- **CRM View**: Split-pane layout with client list on left and comprehensive client profile on right (contacts, project cards, invoice status, health badge).
- **Client Portal**: Clean, white-label client view omitting internal margins, focused on invoice payment (Brevo / Stripe links), milestone approvals, and file downloads.

---

## 5. Mandatory UX Rules & Accessibility Standards

1. **Dark & Light Theme**: Dark mode default, with seamless persistence in `localStorage` and system preference fallback.
2. **Skeleton Loading**: Never present blank pages or raw spinning icons. Use `shadcn/ui` Skeleton blocks matching exact layout structures.
3. **Interactive Micro-Animations**:
   - Hover states: Subtle scaling (`hover:scale-[1.02]`), border glow, `transition-all duration-200`.
   - Card click: Active press depression (`active:scale-[0.98]`).
4. **Accessibility (WCAG AAA)**:
   - High-contrast text compliance across all states.
   - Visible focus indicators (`focus-visible:ring-2 focus-visible:ring-primary`).
   - Full keyboard navigation support (`Tab`, `Esc`, Arrow keys for dialogs & menus).
