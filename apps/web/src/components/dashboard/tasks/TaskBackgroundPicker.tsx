"use client";

// Board background picker — curated Unsplash categories through the existing
// /stock/images proxy plus six built-in dark gradients. Results are cached
// per category for the SPA session (module-level map in task-ui.ts), and a
// 501 (server has no Unsplash key) degrades gracefully to gradients only.
//
// RENDERING ROOT CAUSE (the old "semi-transparent, misplaced popover with
// washed-out gradient swatches"): the panel used to be an absolutely
// positioned child of the top bar, which carries `backdrop-blur-md`. A
// backdrop-filter creates a stacking context, so the whole bar — popover
// included — painted BELOW the board columns (which stack their own
// translucent blurred glass later in DOM order). The picker was literally
// viewed through the columns' backdrop blur: dimmed, blurred, overlapping.
//
// Fix: the panel (and its click-away shield) portals to <body> and is fixed-
// positioned from the trigger button's rect — anchored below the button,
// flipping above when the viewport edge is near, re-anchoring on resize.
// Out of the bar's stacking context it now paints crisp and solid above
// everything on the board.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Check, Palette, X } from "@/components/animated-icons";
import { toast } from "sonner";

import { getStockImages, type StockImage } from "@/lib/api";
import { logHandledError } from "@/lib/log-error";
import { cn } from "@/lib/utils";
import {
  GRADIENT_PRESETS,
  getCachedPickerResults,
  isStockUnconfiguredError,
  setCachedPickerResults,
  unsplashVariant,
} from "./task-ui";

export const BACKGROUND_CATEGORIES = [
  { label: "Mountains", query: "mountains landscape" },
  { label: "Ocean", query: "ocean waves coast" },
  { label: "Forest", query: "forest fog trees" },
  { label: "City", query: "city night skyline" },
  { label: "Abstract", query: "abstract gradient texture" },
  { label: "Space", query: "galaxy stars nebula" },
] as const;

export interface BackgroundSelection {
  background_url: string | null;
  background_kind: string | null;
}

/** The board's current background encoding — powers the selected ring. */
export interface PickerCurrentBackground {
  kind: string | null;
  url: string | null;
}

export function TaskBackgroundPicker({
  anchorEl,
  current,
  onSelect,
  onClose,
  busy,
}: {
  anchorEl: HTMLElement | null;
  current: PickerCurrentBackground;
  onSelect: (selection: BackgroundSelection) => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const { getToken } = useAuth();
  const [tab, setTab] = useState<string>("Gradients");
  const [images, setImages] = useState<StockImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [unconfigured, setUnconfigured] = useState(false);
  // SSR-safe portal gate (this component only mounts on user interaction,
  // but the guard keeps createPortal honest under any prerender).
  const [mounted, setMounted] = useState(false);

  // Anchored popover position, computed from the trigger's rect. Flips above
  // the button when there isn't room below; re-anchors on window resize.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{
    top?: number;
    bottom?: number;
    right: number;
    flip: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot SSR gate: createPortal needs document.body, which only exists client-side
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!anchorEl) return;
    const compute = () => {
      const r = anchorEl.getBoundingClientRect();
      const panelH = panelRef.current?.offsetHeight ?? 420;
      const panelW = Math.min(340, window.innerWidth * 0.92);
      const roomBelow = window.innerHeight - r.bottom;
      const flip = roomBelow < Math.min(panelH + 16, 340) && r.top > panelH + 24;
      setPos({
        ...(flip ? { bottom: window.innerHeight - r.top + 8 } : { top: r.bottom + 8 }),
        // Anchor to the trigger's right edge, clamped so the panel can never
        // overflow either viewport edge on narrow screens.
        right: Math.min(
          Math.max(10, window.innerWidth - r.right),
          Math.max(10, window.innerWidth - panelW - 10)
        ),
        flip,
      });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [anchorEl]);

  const loadCategory = useCallback(
    async (label: string) => {
      const cached = getCachedPickerResults(label);
      if (cached) {
        setImages(cached);
        return;
      }
      setLoading(true);
      setImages([]);
      try {
        const token = (await getToken()) || undefined;
        const category = BACKGROUND_CATEGORIES.find((c) => c.label === label);
        const data = await getStockImages(category?.query ?? label, token, 1, 12);
        setCachedPickerResults(label, data.images);
        setImages(data.images);
      } catch (err) {
        if (isStockUnconfiguredError(err)) {
          setUnconfigured(true);
          setTab("Gradients");
          toast.info("Background service not configured — using gradients");
        } else {
          toast.error("Couldn't load background photos — try again");
          logHandledError("Task board background search failed:", err);
        }
      } finally {
        setLoading(false);
      }
    },
    [getToken]
  );

  const switchTab = (label: string) => {
    setTab(label);
    if (label !== "Gradients") void loadCategory(label);
  };

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!anchorEl || !mounted) return null;

  const noneSelected = !current.url;

  return createPortal(
    <>
      {/* Click-away shield — portalled so it always covers the real viewport */}
      <div className="fixed inset-0 z-[85]" onClick={onClose} aria-hidden />

      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: -6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        style={{
          top: pos?.top,
          bottom: pos?.bottom,
          right: pos?.right ?? 12,
        }}
        className="fixed z-[86] w-[340px] max-w-[92vw] rounded-2xl border border-line bg-card shadow-2xl shadow-black/60 p-3"
        role="dialog"
        aria-label="Board background"
      >
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg">
            <Palette className="w-3.5 h-3.5 text-accent" />
            Board background
          </span>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="press p-1 rounded-md text-muted hover:text-fg hover:bg-surface cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Category chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-2.5 mb-1 border-b border-line">
          {["Gradients", ...BACKGROUND_CATEGORIES.map((c) => c.label)].map((label) => {
            const disabled = label !== "Gradients" && unconfigured;
            return (
              <button
                key={label}
                onClick={() => !disabled && switchTab(label)}
                disabled={disabled}
                title={disabled ? "Background service not configured" : undefined}
                className={`press px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  tab === label
                    ? "bg-accent text-accent-fg"
                    : "bg-surface text-muted hover:text-fg border border-line"
                } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {tab === "Gradients" ? (
          <div className="grid grid-cols-3 gap-2 pt-2">
            {/* None — clears the background */}
            <button
              onClick={() => onSelect({ background_url: null, background_kind: null })}
              disabled={busy}
              aria-pressed={noneSelected}
              className={cn(
                "h-16 rounded-xl border border-dashed flex items-center justify-center text-[11px] transition-colors cursor-pointer disabled:opacity-50",
                noneSelected
                  ? "border-accent ring-2 ring-accent/70 text-fg"
                  : "border-line-strong text-muted hover:text-fg hover:border-accent/60"
              )}
            >
              None
            </button>
            {GRADIENT_PRESETS.map((g) => {
              const selected =
                current.kind === "gradient" && current.url === `gradient:${g.key}`;
              return (
                <button
                  key={g.key}
                  onClick={() =>
                    onSelect({ background_url: `gradient:${g.key}`, background_kind: "gradient" })
                  }
                  disabled={busy}
                  title={g.label}
                  aria-label={`Background: ${g.label}`}
                  aria-pressed={selected}
                  className={cn(
                    "group relative h-16 rounded-xl border transition-transform duration-150 cursor-pointer disabled:opacity-50 hover:scale-[1.04] hover:border-accent/70",
                    selected ? "border-accent ring-2 ring-accent/70" : "border-white/10"
                  )}
                  style={{ background: g.css }}
                >
                  {/* hairline inner highlight keeps the dark gradients crisp */}
                  <span
                    className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]"
                    aria-hidden
                  />
                  <span className="absolute inset-x-0 bottom-1 text-center text-[9px] font-medium text-white/70 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow">
                    {g.label}
                  </span>
                  {selected && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent text-accent-fg flex items-center justify-center shadow">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : loading ? (
          /* Skeleton tiles — shape-matched to the photo grid */
          <div className="grid grid-cols-3 gap-2 pt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-surface border border-line animate-pulse"
                aria-hidden
              />
            ))}
          </div>
        ) : images.length === 0 ? (
          <p className="text-[11px] text-muted text-center py-8">No photos found.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 pt-2 max-h-[240px] overflow-y-auto dialog-scroll">
            {images.map((img) => {
              const selected =
                current.kind === "unsplash" && current.url === img.url;
              return (
                <button
                  key={img.id}
                  onClick={() =>
                    onSelect({ background_url: img.url, background_kind: "unsplash" })
                  }
                  disabled={busy}
                  title={img.description || "Unsplash photo"}
                  aria-label={img.description || "Unsplash photo"}
                  aria-pressed={selected}
                  className={cn(
                    "group relative h-16 rounded-xl overflow-hidden border transition-transform cursor-pointer disabled:opacity-50 hover:scale-[1.03]",
                    selected
                      ? "border-accent ring-2 ring-accent/70"
                      : "border-line hover:border-accent/70"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote CDN URLs (any Unsplash photo), next/image has no configured domains */}
                  <img
                    // w=200 variant: the picker grid is ~100px per tile; never
                    // download the full-size image just for a thumbnail.
                    src={unsplashVariant(img.url, 200, 60)}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-cover select-none"
                  />
                  {selected && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent text-accent-fg flex items-center justify-center shadow">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-faint mt-2.5">
          {unconfigured
            ? "Photo backgrounds need an Unsplash key on the server — gradients always work."
            : "Photos from Unsplash · sized variants requested per surface"}
        </p>
      </motion.div>
    </>,
    document.body
  );
}
