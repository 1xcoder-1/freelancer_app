# UI Polish Plugin

Two complementary skills for micro-interactions and visual polish, packaged from
[UI Skills](https://www.ui-skills.com/):

- **better-ui** (jakubkrehel) — exact-value design-engineering principles for
  shadows, radii, press states, enter/exit motion, icon transitions, and
  reduced-motion gating. Supports: `animations.md`, `enter-exit.md`,
  `icon-transitions.md`, `icons.md`, `performance.md`, `surfaces.md`.
- **interaction-design** (wshobson) — purposeful motion, timing scale, easing
  functions, and component patterns (skeletons, toggles, page transitions,
  ripple/feedback, gestures). Supports: `references/animation-libraries.md`,
  `references/microinteraction-patterns.md`, `references/scroll-animations.md`.

## Source Provenance

- Catalog pages: `https://www.ui-skills.com/skills/jakubkrehel/better-ui`,
  `https://www.ui-skills.com/skills/wshobson/interaction-design`
- `better-ui` copied from `https://github.com/jakubkrehel/skills`
  (`skills/better-ui/`, shallow clone, files: SKILL.md + 6 reference docs).
  The source `agents/` sub-directory was omitted (editor-specific sub-agent
  definitions not needed for Qoder skill discovery).
- `interaction-design` copied from `https://github.com/wshobson/agents`
  (`plugins/ui-design/skills/interaction-design/`, shallow clone).

## Omitted Files

- `skills/better-ui/agents/` — source-only sub-agent config, not referenced by
  SKILL.md for the primary workflow.
- No logo is bundled with either source; no logo is declared in the manifest.

## Validation

- Offline validator: `scripts/validate_qoder_plugin.py` (create-plugin skill
  bundle) — see conversation log for run results.
- All referenced support files exist inside each skill folder; relative links
  preserved.
