# Workspace Rules: UI, Graphify, and Standards

## Rule 1: Primary UI Component Library (shadcn/ui)
- `shadcn/ui` is the designated primary UI library for all web applications and frontend components in this repository.
- Use `shadcn/ui` primitive components (Buttons, Dialogs, Cards, Inputs, Tables, Badges, Tabs, Accordions, Dropdown Menus, etc.).
- Ensure components follow standard Tailwind CSS styling, OKLCH color palettes, dark mode support, and Radix UI primitives underlying `shadcn/ui`.

## Rule 2: Graphify Codebase Dependency Analysis
- Whenever implementing new features or refactoring existing modules, perform dependency graph analysis using `graphify`.
- Maintain strict module boundaries between `apps/*` and `packages/*`.
- Avoid circular imports, dead abstractions, or orphan files.

## Rule 3: Quality Checklists & Architecture Adherence
- Validate all web pages against the 3 core pillars in `checklist.md`:
  1. UI / UX Features (Dark mode, sticky header, mobile drawer, loading skeletons, etc.)
  2. SEO Essentials (Meta titles, meta descriptions, single H1, canonical tags, schema markup, etc.)
  3. Performance & Technical (Debounced inputs, caching, code splitting, image optimization, pagination, connection pooling)
- Maintain alignment with `architecture.md` and `design.md`.
