"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/components/common/ConfirmDialog";

const DRAFT_PREFIX = "freelancebook:draft:";

interface DraftEnvelope {
  values: Record<string, unknown>;
  savedAt: string;
}

export interface UnsavedGuardOptions {
  /** Every tracked form value, keyed stably. Dirty = any of these differs
   * from the baseline the guard snapshotted (initial or last markSaved). */
  values: Record<string, unknown>;
  /** Baseline for edit forms. Omit for "new" forms — everything compared
   * against empty (undefined/null → "", so a filled field is dirty). */
  initial?: Record<string, unknown>;
  /** Keep false while the record is still loading, so the empty shell of an
   * edit form never counts as unsaved work. */
  enabled?: boolean;
  /** Enables localStorage autosave + a "restore draft?" prompt on mount. */
  draftKey?: string;
  /** Called (once, after enable) when a stored draft exists and the user
   * chooses to restore it. Apply the values to your form state here. */
  onRestoreDraft?: (saved: Record<string, unknown>) => void;
}

export interface UnsavedGuard {
  dirty: boolean;
  /** After a successful save: re-baselines (clears dirty) and drops the
   * stored draft. Always call before navigating away post-save. */
  markSaved: () => void;
  /** Re-capture the current values as the clean baseline. Use on "new"
   * forms whose defaults land asynchronously (e.g. an auto-selected client
   * after a fetch) so programmatic pre-fills never count as user edits. */
  seedBaseline: () => void;
  /** router.push that first asks "discard changes?" when dirty. */
  guardedPush: (path: string) => Promise<void>;
  /** Leave immediately without asking (used after the user already chose
   * to navigate in their own dialog, e.g. opening a duplicate record).
   * The draft stays in localStorage so a restore offer awaits on return. */
  forcePush: (path: string) => void;
}

function normalize(v: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(v)) out[k] = v[k] == null ? "" : String(v[k]);
  return out;
}

function isDirty(
  values: Record<string, unknown>,
  baseline: Record<string, unknown>
): boolean {
  const a = normalize(values);
  const b = normalize(baseline);
  for (const k of Object.keys(a)) {
    if (a[k] !== (b[k] ?? "")) return true;
  }
  return false;
}

/**
 * Unsaved-changes protection for the app's typing-heavy forms (clients, leads,
 * projects, contracts, invoices, intake — new/edit, plus the public intake
 * questionnaire and the proposal composer):
 * 1. in-app navigation (sidebar/back/cancel links and guardedPush) asks
 *    "discard changes?" through the app's ConfirmDialog — never window.confirm;
 * 2. browser refresh/tab-close uses beforeunload (the one native dialog
 *    browsers insist on controlling);
 * 3. optional localStorage draft autosave with a restore offer on return.
 */
export function useUnsavedChangesGuard({
  values,
  initial,
  enabled = true,
  draftKey,
  onRestoreDraft,
}: UnsavedGuardOptions): UnsavedGuard {
  const router = useRouter();
  const [baseline, setBaseline] = useState<Record<string, unknown>>(initial ?? {});

  const valuesRef = useRef(values);
  valuesRef.current = values;
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const bypassRef = useRef(false);
  const restoreAsked = useRef(false);
  const seededRef = useRef(false);
  const seededBaselineRef = useRef<Record<string, unknown> | null>(null);
  const onRestoreRef = useRef(onRestoreDraft);
  onRestoreRef.current = onRestoreDraft;

  const [dirty, setDirty] = useState(false);

  // Re-evaluate dirtiness whenever the form (or its baseline) moves.
  useEffect(() => {
    setDirty(enabled && isDirty(values, baseline));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, baseline, enabled]);

  // "New" forms (no `initial`): baseline starts as the values on first enabled
  // render — their designed defaults — not an empty shell, so pre-filled
  // fields don't make a brand-new form dirty before the user types anything.
  useEffect(() => {
    if (!enabled || initial || seededRef.current) return;
    seededRef.current = true;
    seededBaselineRef.current = { ...valuesRef.current };
    setBaseline({ ...valuesRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, initial]);

  const storageKey = draftKey ? `${DRAFT_PREFIX}${draftKey}` : null;

  // Baseline follows `initial` once (edit forms capture it after loading).
  const initialKey = draftKey ?? "";
  useEffect(() => {
    if (initial) setBaseline(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey, enabled]);

  // Debounced draft autosave while dirty; cleared on save.
  useEffect(() => {
    if (!storageKey || !enabled || !dirty) return;
    const t = setTimeout(() => {
      try {
        const envelope: DraftEnvelope = { values: valuesRef.current, savedAt: new Date().toISOString() };
        localStorage.setItem(storageKey, JSON.stringify(envelope));
      } catch {
        // Full/blocked storage must never break the form.
      }
    }, 600);
    return () => clearTimeout(t);
  }, [storageKey, enabled, dirty, values]);

  // Restore offer, once per form after it becomes enabled.
  useEffect(() => {
    if (!storageKey || !enabled || restoreAsked.current) return;
    restoreAsked.current = true;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(storageKey);
    } catch {
      return;
    }
    if (!raw) return;
    let envelope: DraftEnvelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
      localStorage.removeItem(storageKey);
      return;
    }
    if (!envelope?.values) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* noop */
      }
      return;
    }
    // A draft equal to the record adds nothing — skip the prompt silently.
    // (Compare against `initial`/the seeded baseline, not the state baseline:
    // that snapshot lands one render later and is not readable yet here.)
    if (!isDirty(envelope.values, initialRef.current ?? seededBaselineRef.current ?? {})) return;
    confirmDialog({
      title: "Restore your unsaved draft?",
      message: "This form has changes you typed before leaving. Restore them, or start fresh?",
      confirmLabel: "Restore draft",
      cancelLabel: "Start fresh",
    }).then((restore) => {
      if (restore) {
        onRestoreRef.current?.(envelope.values);
      } else {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* noop */
        }
      }
    });
  }, [storageKey, enabled]);

  // Native guard for refresh / tab close while dirty.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const askDiscard = useCallback(async (): Promise<boolean> => {
    return confirmDialog({
      title: "Unsaved changes",
      message: "You have edits that were not saved. Leave this page and lose them?",
      confirmLabel: "Discard changes",
      cancelLabel: "Keep editing",
    });
  }, []);

  // Intercept in-app link clicks (sidebar, back links, any <a>) while dirty.
  useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      if (bypassRef.current || e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (!href.startsWith("/") || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (anchor.pathname === window.location.pathname) return; // in-page anchors etc.
      e.preventDefault();
      e.stopPropagation();
      askDiscard().then((leave) => {
        if (!leave) return;
        bypassRef.current = true;
        try {
          router.push(href);
        } finally {
          // Release the bypass after the navigation tick; re-armed on next dirty.
          setTimeout(() => {
            bypassRef.current = false;
          }, 300);
        }
      });
    };
    // Capture so we run before Next's own Link handler.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, router, askDiscard]);

  const markSaved = useCallback(() => {
    setBaseline({ ...valuesRef.current });
    const key = storageKey;
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* noop */
      }
    }
  }, [storageKey]);

  const seedBaseline = useCallback(() => {
    seededRef.current = true;
    seededBaselineRef.current = { ...valuesRef.current };
    setBaseline({ ...valuesRef.current });
  }, []);

  const guardedPush = useCallback(
    async (path: string) => {
      if (isDirty(valuesRef.current, baselineRef.current) && !(await askDiscard())) return;
      bypassRef.current = true;
      router.push(path);
      setTimeout(() => {
        bypassRef.current = false;
      }, 300);
    },
    [router, askDiscard]
  );

  const forcePush = useCallback(
    (path: string) => {
      bypassRef.current = true;
      router.push(path);
      setTimeout(() => {
        bypassRef.current = false;
      }, 300);
    },
    [router]
  );

  return { dirty, markSaved, seedBaseline, guardedPush, forcePush };
}
