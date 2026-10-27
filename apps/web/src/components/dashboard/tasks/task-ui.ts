import type { StockImage, TaskCard, TaskPriority } from "@/lib/api";

// Shared presentation helpers for the Task Management board surface:
// board-background encoding (gradients + Unsplash variants), priority/due
// chip styling, and the session-level stock-picker cache. Kept dependency
// free so the boards list page and the board view stay in lockstep.

// ------------------------------------------------------------------------------
// Board backgrounds
// ------------------------------------------------------------------------------
// Encoding contract (mirrors the backend's free-form background_url +
// background_kind columns):
//   gradient  → background_kind: "gradient", background_url: "gradient:<key>"
//               where <key> indexes GRADIENT_PRESETS below.
//   unsplash  → background_kind: "unsplash",  background_url: the full-size
//               images.unsplash.com URL; sized variants are derived per render
//               with unsplashVariant() so nothing oversized is ever downloaded.
//   legacy    → a raw css gradient string stored in background_url still renders.
export const GRADIENT_PRESETS: { key: string; label: string; css: string }[] = [
  {
    key: "midnight",
    label: "Midnight",
    css: "linear-gradient(135deg, #0b1220 0%, #101b31 45%, #1c2a4a 100%)",
  },
  {
    key: "ember",
    label: "Ember",
    css: "linear-gradient(135deg, #1a0f0a 0%, #331a0e 50%, #4a2410 100%)",
  },
  {
    key: "forest",
    label: "Forest",
    css: "linear-gradient(160deg, #0a1410 0%, #12261a 50%, #1b3a26 100%)",
  },
  {
    key: "violet",
    label: "Violet Dusk",
    css: "linear-gradient(135deg, #140f1f 0%, #221733 55%, #35234e 100%)",
  },
  {
    key: "space",
    label: "Deep Space",
    css: "radial-gradient(1200px 600px at 20% -10%, #1b2138 0%, #0c0f1a 55%, #070810 100%)",
  },
  {
    key: "graphite",
    label: "Graphite",
    css: "linear-gradient(180deg, #17181b 0%, #101114 100%)",
  },
];

export function gradientCss(key: string): string | null {
  return GRADIENT_PRESETS.find((g) => g.key === key)?.css ?? null;
}

export const GRADIENT_URL_PREFIX = "gradient:";

export type BoardBackground =
  | { type: "none" }
  | { type: "gradient"; css: string; key: string }
  | { type: "image"; url: string };

export function resolveBoardBackground(
  kind?: string | null,
  url?: string | null
): BoardBackground {
  if (kind === "gradient" && url?.startsWith(GRADIENT_URL_PREFIX)) {
    const key = url.slice(GRADIENT_URL_PREFIX.length);
    const css = gradientCss(key);
    return css ? { type: "gradient", css, key } : { type: "none" };
  }
  if (url && /^https?:\/\//i.test(url)) {
    return { type: "image", url };
  }
  // Legacy rows where the raw CSS gradient was stored directly in the URL.
  if (url && url.includes("gradient(")) {
    return { type: "gradient", css: url, key: "raw" };
  }
  return { type: "none" };
}

// Derive a sized variant of an images.unsplash.com URL (the CDN is imgix:
// w/q/fit/fm are plain query params). Non-Unsplash URLs pass through
// untouched so custom/legacy backgrounds keep working.
export function unsplashVariant(url: string, width: number, quality = 70): string {
  if (!/^https?:\/\//i.test(url)) return url;
  try {
    const u = new URL(url);
    if (!/images\.unsplash\.com$/i.test(u.hostname)) return url;
    u.searchParams.set("w", String(width));
    u.searchParams.set("q", String(quality));
    u.searchParams.set("fit", "crop");
    u.searchParams.set("fm", "jpg");
    u.searchParams.set("auto", "format");
    return u.toString();
  } catch {
    return url;
  }
}

// True when /stock/images answered 501 — the server has no Unsplash key yet.
// The picker degrades to gradient-only instead of erroring.
export function isStockUnconfiguredError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } } | null)?.response?.status;
  return status === 501;
}

// Session-level picker cache: one board picker can flip through several
// categories repeatedly; the server caches too but this avoids the round
// trip entirely within a SPA session.
const pickerCache = new Map<string, StockImage[]>();

export function getCachedPickerResults(category: string): StockImage[] | null {
  return pickerCache.get(category) ?? null;
}

export function setCachedPickerResults(category: string, images: StockImage[]): void {
  pickerCache.set(category, images);
}

// ------------------------------------------------------------------------------
// Priority + due-date chip styling (app tokens, dark theme)
// ------------------------------------------------------------------------------

export const PRIORITY_META: Record<
  TaskPriority,
  { dot: string; label: string; text: string }
> = {
  urgent: { dot: "bg-danger", label: "Urgent", text: "text-danger" },
  high: { dot: "bg-warn", label: "High", text: "text-warn" },
  medium: { dot: "bg-info", label: "Medium", text: "text-info" },
  low: { dot: "bg-violet", label: "Low", text: "text-violet" },
};

export function priorityDotClass(priority: TaskCard["priority"]): string {
  return priority ? PRIORITY_META[priority]?.dot ?? "" : "";
}

export type DueStatus = "overdue" | "today" | "future" | null;

// `today` is injected by callers (one clock snapshot per mount, never read
// during render math) so SSR/CSR output stays stable.
export function dueStatus(due: string | null | undefined, today: string | null, completed: boolean): DueStatus {
  if (!due || !today || completed) return null;
  if (due < today) return "overdue";
  if (due === today) return "today";
  return "future";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-03-05" → "Mar 5" (year included when it is not the current one).
export function formatDueDate(due: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(due);
  if (!m) return due;
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  const day = Number(m[3]);
  const year = m[1];
  const currentYear = String(new Date().getFullYear());
  return year !== currentYear ? `${month} ${day}, ${year}` : `${month} ${day}`;
}
