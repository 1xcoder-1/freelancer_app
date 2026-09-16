# Workspace Agent Rules & Guidelines

> **IMPORTANT**: The AI assistant MUST follow all rules defined in `.agents/` and `.agents/rules/` on EVERY user request and command.

## 1. Primary Directives & Standards

- **Primary UI Library**: `shadcn/ui` (with Tailwind CSS) MUST be used as the primary UI library across all web and React applications in this project. All UI components, buttons, dialogs, inputs, forms, and overlays must be built using or extending `shadcn/ui` patterns.
- **Graphify Integration (Mandatory)**: On ALL architectural, structural, and code modifications, the AI MUST ALWAYS use `graphify` context and principles to trace imports, module boundaries, component graphs, and dependency flows BEFORE modifying code.
- **PR Workflow Mandate (No Direct Commits to Main)**: NEVER push or commit changes directly to the `main` branch. For every feature, bug fix, or refactor, ALWAYS create a dedicated feature branch (e.g. `feat/...`, `fix/...`), make the changes, and create a Pull Request (PR) for merge approval.
- **Rules Compliance**: Always read and adhere strictly to all rule files inside `.agents/rules/` and project documentation (`architecture.md`, `design.md`, `checklist.md`).

## 2. Mandatory Documentation & Checklists

Every feature implementation or review MUST verify compliance against:
1. [`architecture.md`](file:///c:/Users/coder/Desktop/freelancer%20book/architecture.md) — System architecture & monorepo standards.
2. [`design.md`](file:///c:/Users/coder/Desktop/freelancer%20book/design.md) — UI/UX design system & `shadcn/ui` guidelines.
3. [`checklist.md`](file:///c:/Users/coder/Desktop/freelancer%20book/checklist.md) — UI/UX, SEO, and Performance checklist.

## 3. Code Quality & Agent Behavior

- **Always Create PRs**: All code deliverables must be submitted via feature branch Pull Requests (PRs).
- **No Over-engineering**: Keep code minimal, type-safe, and standard.
- **Accessibility & Contrast**: Enforce WCAG AA/AAA contrast ratios and keyboard navigation.
- **Performance First**: Zero un-memoized expensive re-renders, full image/code splitting optimization.
