# Workspace Rules: UI, Graphify, and Standards

## Rule 1: Primary UI Component Library (shadcn/ui)
- `shadcn/ui` is the designated primary UI library for all web applications and frontend components in this repository.
- Use `shadcn/ui` primitive components (Buttons, Dialogs, Cards, Inputs, Tables, Badges, Tabs, Accordions, Dropdown Menus, etc.).
- Ensure components follow standard Tailwind CSS styling, OKLCH color palettes, dark mode support, and Radix UI primitives underlying `shadcn/ui`.

## Rule 2: Graphify Codebase Dependency Analysis (Mandatory)
- The AI agent MUST ALWAYS run `graphify` context analysis before modifying, creating, or refactoring code.
- Trace all imports, component dependencies, and module graph structures to ensure zero broken references.
- Maintain strict module boundaries between `apps/*` and `packages/*`.
- Avoid circular imports, dead abstractions, or orphan files.

## Rule 3: Pull Request (PR) Workflow (No Direct Commits to Main)
- DO NOT push or commit changes directly to the `main` branch.
- For every task, bug fix, or feature request:
  1. Create a descriptive feature branch: `git checkout -b feat/<short-desc>` or `fix/<short-desc>`.
  2. Implement and test changes on the feature branch.
  3. Push the feature branch to GitHub (`git push -u origin <branch-name>`).
  4. Open a Pull Request (PR) for review and merging into `main`.

## Rule 4: Quality Checklists & Architecture Adherence
- Validate all web pages against the 3 core pillars in `checklist.md`:
  1. UI / UX Features (Dark mode, sticky header, mobile drawer, loading skeletons, etc.)
  2. SEO Essentials (Meta titles, meta descriptions, single H1, canonical tags, schema markup, etc.)
  3. Performance & Technical (Debounced inputs, caching, code splitting, image optimization, pagination, connection pooling)
- Maintain alignment with `architecture.md` and `design.md`.
