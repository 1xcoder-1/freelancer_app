"use client";

import React, { useEffect, useRef, useState } from "react";
import { Settings2 } from "@/components/animated-icons";
import { ACCENT_OPTIONS, FONT_OPTIONS } from "./constants";
import type { CardSettings } from "@/lib/api";

interface SettingsPopoverProps {
  settings: CardSettings;
  disabled?: boolean;
  onChange: (next: CardSettings) => void;
}

/**
 * Appearance control shown as the gear button in the top-right of the card
 * (reference design): a dark pill panel with font choices and colour dots.
 * Selection is persisted straight to the owner's Neon row via `onChange`.
 */
export function SettingsPopover({
  settings,
  disabled,
  onChange,
}: SettingsPopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title="Card appearance"
        aria-expanded={open}
        className="w-10 h-10 rounded-xl bg-surface border border-line hover:border-line-strong text-fg flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Settings2 className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-[290px] rounded-2xl bg-[#2a2724] border border-white/10 p-4 shadow-2xl">
          {/* Font choices */}
          <div className="flex items-center gap-1.5 rounded-xl bg-black/25 p-1.5">
            {FONT_OPTIONS.map((font) => {
              const active = settings.font === font.id;
              return (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => onChange({ ...settings, font: font.id })}
                  style={{ fontFamily: font.cssVar }}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    active
                      ? "bg-[#4a4542] text-white shadow-sm"
                      : "text-white/65 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {font.label}
                </button>
              );
            })}
          </div>

          <div className="my-3 border-t border-dashed border-white/15" />

          {/* Accent colour dots */}
          <div className="flex items-center gap-2.5 px-1">
            {ACCENT_OPTIONS.map((color) => {
              const active = settings.accent === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => onChange({ ...settings, accent: color })}
                  title={color}
                  className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                    active
                      ? "ring-2 ring-white/80 ring-offset-2 ring-offset-[#2a2724]"
                      : ""
                  }`}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
