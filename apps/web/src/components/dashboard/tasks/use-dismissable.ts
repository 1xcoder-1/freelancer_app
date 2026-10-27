"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

// Dismissal for the board's inline popovers (card composer, list menu,
// add-list composer): closes on any pointerdown outside `ref` and on Escape.
//
// Why not the old `fixed inset-0` click-away shield: the columns carry
// `backdrop-blur-md`, and a backdrop-filter makes that column the containing
// block for position:fixed descendants — the shield resolved against the
// COLUMN box, so clicking on any other column (or the board canvas) never
// hit it and the popover stayed open. A window listener with a DOM
// `contains()` check is immune to containing-block geometry.
export function useDismissable<T extends HTMLElement>(
  open: boolean,
  ref: RefObject<T | null>,
  onClose: () => void
): void {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, ref, onClose]);
}
