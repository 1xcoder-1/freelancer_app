# Design System & UI/UX Standards

## 1. Primary UI Component Library: `shadcn/ui`

All frontend applications and components in this repository MUST use **`shadcn/ui`** as the primary component library.

- **Component Primitives**: Buttons, Cards, Dialogs, Inputs, Tables, Badges, Tabs, Accordions, Dropdown Menus, Sheet Drawers, and Toast Notifications are constructed using `shadcn/ui` pattern conventions.
- **Styling Architecture**: Tailwind CSS v4 with custom OKLCH design tokens.
- **Icons**: `lucide-react` icons exclusively.
- **Animations**: `framer-motion` for dynamic UI state transitions and micro-interactions.

---

## 2. Design Tokens & Color System

- **Background (Dark)**: `#090d16` / `#0f172a` (Slate-950)
- **Card / Surface (Dark)**: `#1e293b` (Slate-800)
- **Primary Accent**: `#10b981` (Emerald-500)
- **Secondary Accent**: `#6366f1` (Indigo-500)
- **Text Primary**: `#f8fafc` (Slate-50)
- **Text Muted**: `#94a3b8` (Slate-400)

---

## 3. Mandatory UI/UX Patterns

1. **Dark & Light Mode**: System theme default with manual toggle persisted in `localStorage`.
2. **Sticky Navigation**: Header fixed with backdrop blur (`backdrop-blur-md bg-background/80`).
3. **Responsive Drawers**: Slide-in mobile menu drawer closing on navigation or `Escape` keypress.
4. **Interactive Hover States**: Subtle scaling (`hover:scale-[1.02]`), border glow, and smooth transitions (`transition-all duration-200`).
5. **Loading States**: `shadcn/ui` Skeleton components during data loading state — never present blank or unstyled text.
6. **Accessibility**: Visible focus rings (`focus-visible:ring-2`), skip-to-content link, WCAG AAA contrast ratio.
