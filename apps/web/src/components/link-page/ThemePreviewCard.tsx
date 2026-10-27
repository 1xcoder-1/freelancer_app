"use client";

import React from "react";
import { Check } from "lucide-react";
import type { LINK_TEMPLATES } from "./template-constants";

type LinkTemplate = (typeof LINK_TEMPLATES)[number];

interface ThemePreviewCardProps {
  template: LinkTemplate;
  isSelected: boolean;
  onSelect: () => void;
}

const SERIF = "Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, 'JetBrains Mono', 'SF Mono', 'Courier New', monospace";
const HAND = "var(--font-signature), 'Segoe Script', 'Bradley Hand', cursive";

function MiniAvatar({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shadow-xs"
      style={{ background: bg, color: fg }}
    >
      {label}
    </div>
  );
}

function MiniRow({
  bg,
  fg,
  border,
  label,
  radius = 999,
  font,
}: {
  bg: string;
  fg: string;
  border?: string;
  label: string;
  radius?: number;
  font?: string;
}) {
  return (
    <div
      className="w-32 h-4 flex items-center justify-center text-[8px] font-medium shadow-2xs"
      style={{ background: bg, color: fg, border: border ? `1px solid ${border}` : undefined, borderRadius: radius, fontFamily: font }}
    >
      {label}
    </div>
  );
}

export function ThemePreviewCard({
  template,
  isSelected,
  onSelect,
}: ThemePreviewCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative text-left rounded-2xl border p-3.5 transition-all duration-150 cursor-pointer select-none group flex flex-col justify-between overflow-hidden ${
        isSelected
          ? "border-emerald-500/80 ring-2 ring-emerald-500/20 bg-emerald-500/[0.03] shadow-xs"
          : "border-line bg-card hover:border-line-strong hover:bg-surface/50"
      }`}
    >
      {/* Top Header: Title & Archetype + Selected checkmark */}
      <div className="flex items-start justify-between gap-2 mb-2 w-full">
        <div>
          <span className="text-xs font-semibold text-fg tracking-tight block">
            {template.name}
          </span>
          <span className="text-[11px] text-muted font-normal">
            {template.archetype}
          </span>
        </div>
        {isSelected && (
          <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </span>
        )}
      </div>

      {/* Visual canvas miniature, one per design */}
      <div className="w-full h-22 rounded-xl overflow-hidden border border-line/60 my-1 relative select-none transition-transform group-hover:scale-[1.01]">
        {template.key === "fresh-press" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2"
            style={{ background: "linear-gradient(180deg, #5F6B57 0%, #525E49 100%)" }}
          >
            <MiniAvatar bg="#2E3A28" fg="#E8A33D" label="H" />
            <div className="text-[8px] font-semibold text-white">Hydra Juice</div>
            <MiniRow bg="#C9CDC4" fg="#33402C" radius={8} label="Our drinks" />
            <MiniRow bg="#C9CDC4" fg="#33402C" radius={8} label="Find us" />
          </div>
        )}

        {template.key === "honeyed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2" style={{ background: "#E9EAF3" }}>
            <MiniAvatar bg="#F2827B" fg="#2B3AA5" label="H" />
            <div className="text-[8px] font-bold" style={{ fontFamily: MONO, color: "#2B3AA5" }}>
              Honeyed Pastry
            </div>
            <MiniRow bg="rgba(255,255,255,0.55)" fg="#2B3AA5" border="#2B3AA5" radius={10} label="Menu" font={MONO} />
            <MiniRow bg="rgba(255,255,255,0.55)" fg="#2B3AA5" border="#2B3AA5" radius={10} label="Our story" font={MONO} />
          </div>
        )}

        {template.key === "studio-cloud" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2" style={{ background: "#F3F2F8" }}>
            <svg viewBox="0 0 200 110" fill="none" className="absolute w-24 -top-2 -right-4 opacity-50" aria-hidden="true">
              <path d="M30 82 C12 82 6 68 14 58 C6 46 18 32 32 38 C36 20 58 12 72 24 C82 6 110 6 120 24 C136 12 160 20 162 38 C180 34 192 50 184 64 C192 74 184 86 170 84 Z" stroke="#4A5BD0" strokeWidth="1.6" />
            </svg>
            <svg viewBox="0 0 200 110" fill="none" className="absolute w-20 -bottom-3 -left-4 opacity-40" aria-hidden="true">
              <path d="M30 82 C12 82 6 68 14 58 C6 46 18 32 32 38 C36 20 58 12 72 24 C82 6 110 6 120 24 C136 12 160 20 162 38 C180 34 192 50 184 64 C192 74 184 86 170 84 Z" stroke="#4A5BD0" strokeWidth="1.6" />
            </svg>
            <MiniAvatar bg="#DDE2F5" fg="#3D4EC7" label="M" />
            <div className="text-[10px]" style={{ fontFamily: HAND, color: "#3D4EC7" }}>Marjan</div>
            <MiniRow bg="#FFFFFF" fg="#3D4EC7" border="#3D4EC7B3" radius={4} label="Website" font={HAND} />
            <MiniRow bg="#FFFFFF" fg="#3D4EC7" border="#3D4EC7B3" radius={4} label="Interviews" font={HAND} />
          </div>
        )}

        {template.key === "hardwave" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2"
            style={{ background: "linear-gradient(180deg, #D2702F 0%, #8A4E22 30%, #2A211A 70%, #171412 100%)" }}
          >
            <MiniAvatar bg="#2A211A" fg="#D2702F" label="S" />
            <div className="text-[8px] font-semibold text-white">Shannon Cary</div>
            <div
              className="w-32 flex items-center justify-center text-[8px] font-semibold bg-white text-[#1A1815] shadow-2xs"
              style={{ height: 18, clipPath: "polygon(0% 3px, 7% 0px, 14% 3px, 21% 0px, 28% 3px, 35% 0px, 42% 3px, 49% 0px, 56% 3px, 63% 0px, 70% 3px, 77% 0px, 84% 3px, 91% 0px, 98% 3px, 100% 1px, 100% 100%, 0% 100%)" }}
            >
              Boilerroom set
            </div>
            <MiniRow bg="#FFFFFF" fg="#1A1815" radius={10} label="Book a concert" />
          </div>
        )}

        {template.key === "prism" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2"
            style={{ background: "linear-gradient(160deg, #F2C9DC 0%, #C9D2F0 28%, #DCCEF2 52%, #F4DECB 76%, #BFCDF2 100%)" }}
          >
            <MiniAvatar bg="#DCCEF2" fg="#23222E" label="R" />
            <div className="text-[8px] font-semibold" style={{ color: "#23222E" }}>Rhagouel</div>
            <MiniRow bg="rgba(255,255,255,0.9)" fg="#23222E" radius={8} label="Tour Dates" />
            <MiniRow bg="rgba(255,255,255,0.9)" fg="#23222E" radius={8} label="Our Discord" />
          </div>
        )}

        {template.key === "paper" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2" style={{ background: "#B7B4AD" }}>
            <MiniAvatar bg="#8F8C85" fg="#2B2A26" label="A" />
            <div className="text-[8px]" style={{ fontFamily: SERIF, color: "#2B2A26" }}>
              Arielle Emmanuelle
            </div>
            <MiniRow bg="#FCFCFA" fg="#22211D" radius={2} label="Work" font={SERIF} />
            <MiniRow bg="#FCFCFA" fg="#22211D" radius={2} label="Inspiration" font={SERIF} />
          </div>
        )}
      </div>

      {/* Bottom Footer: Typography label and color swatches */}
      <div className="flex items-center justify-between pt-2 border-t border-line/40 text-[10px] text-muted w-full mt-1">
        <span className="font-mono text-[10px] text-muted truncate">
          {template.fontFamily.split("/")[0].trim()}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {template.palette.map((color, i) => (
            <span
              key={i}
              style={{ backgroundColor: color }}
              className="w-2.5 h-2.5 rounded-full border border-black/30 shadow-2xs"
            />
          ))}
        </div>
      </div>
    </button>
  );
}
