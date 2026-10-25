"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import type { BookingConsultation } from "@/lib/api";

// Handcrafted bespoke meeting glyph with custom dual-tone geometry
function BespokeMeetingGlyph({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Camera Body */}
      <rect
        x="2.5"
        y="5.5"
        width="12"
        height="13"
        rx="2.5"
        className="fill-surface/50 stroke-fg/75 group-hover:stroke-fg transition-colors"
      />
      {/* Video Lens Projection */}
      <path
        d="M14.5 10.2L19.5 7v10l-5-3.2"
        className="stroke-[#ea580c] fill-[#ea580c]/15 group-hover:fill-[#ea580c]/25 transition-all"
      />
      {/* Live recording indicator dot inside camera body */}
      <circle cx="6.5" cy="12" r="1.25" className="fill-[#ea580c]" />
    </svg>
  );
}

// Handcrafted phone glyph for phone-based services
function BespokePhoneGlyph({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="6"
        y="3"
        width="12"
        height="18"
        rx="3"
        className="fill-surface/50 stroke-fg/75 group-hover:stroke-fg transition-colors"
      />
      <line x1="10" y1="6" x2="14" y2="6" className="stroke-fg/40" />
      <circle cx="12" cy="17" r="1" className="fill-[#ea580c]" />
    </svg>
  );
}

export interface ServiceCardProps {
  item: BookingConsultation;
  onOpenDetail?: (item: BookingConsultation) => void;
  isPreview?: boolean;
  className?: string;
}

export function ServiceCard({
  item,
  onOpenDetail,
  isPreview = false,
  className = "",
}: ServiceCardProps) {
  const [copied, setCopied] = useState(false);

  const title = item.title?.trim() || "Consultation";
  const duration = item.duration_minutes || 30;
  const provider = (item.meeting_provider || "google_meet").toLowerCase();
  const key = item.token || item.id;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPreview || !key) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/booking/${key}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Booking link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCardClick = () => {
    if (isPreview) return;
    if (onOpenDetail) {
      onOpenDetail(item);
    }
  };

  const isPhone = provider.includes("phone");
  const providerLabel = provider.includes("meet")
    ? "Google Meet"
    : provider.includes("zoom")
      ? "Zoom"
      : item.meeting_provider || "Video Call";

  return (
    <SpotlightCard
      radius={280}
      glow="rgba(234,88,12,0.10)"
      onClick={handleCardClick}
      className={`group relative rounded-2xl border border-line dark:border-[#26272d] bg-card dark:bg-[#141518] hover:bg-surface/30 dark:hover:bg-[#18181c] hover:border-line-strong dark:hover:border-[#383942] p-6 sm:p-7 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[175px] sm:min-h-[185px] select-none overflow-hidden motion-safe:hover:-translate-y-0.5 ${
        isPreview ? "cursor-default" : "cursor-pointer"
      } ${className}`}
    >
      {/* Background Subtle Grid Texture with radial mask — Signature Brand Depth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.08] transition-opacity duration-300 group-hover:opacity-[0.06] dark:group-hover:opacity-[0.11]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #ea580c 1px, transparent 1px),
            linear-gradient(to bottom, #ea580c 1px, transparent 1px)
          `,
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(circle at 15% 20%, black 0%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle at 15% 20%, black 0%, transparent 70%)",
        }}
      />

      {/* Top Section: Styled Typography (Title with styled micro-badge and metadata) */}
      <div className="relative z-10 space-y-1.5">
        <h4 className="font-display text-[17px] sm:text-[18.5px] font-semibold text-fg dark:text-[#f4f4f5] tracking-tight group-hover:text-fg transition-colors truncate capitalize leading-snug">
          {title}
        </h4>

        {/* Structured metadata: crisp mono duration tag + provider label */}
        <div className="flex items-center gap-2 pt-0.5">
          <span className="font-mono text-[11px] font-semibold text-fg/90 bg-surface/90 border border-line/80 px-2 py-0.5 rounded-md shadow-2xs">
            {duration}m
          </span>
          <span className="text-muted/40 text-xs select-none">·</span>
          <span className="text-xs text-muted dark:text-[#a1a1aa] font-medium tracking-wide">
            {providerLabel}
          </span>
        </div>
      </div>

      {/* Bottom Section (Card Ending): Tactile micro-button & bespoke crafted glyph */}
      <div className="relative z-10 flex items-center justify-between gap-3 pt-3 mt-auto border-t border-line/40 dark:border-white/5">
        {/* Left: Tactile Copy Link micro-button */}
        <button
          type="button"
          onClick={handleCopyLink}
          disabled={isPreview}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface/80 hover:bg-surface border border-line/70 hover:border-line-strong text-[11px] font-medium text-muted hover:text-fg transition-all duration-150 cursor-pointer active:scale-95 shadow-2xs"
          title="Copy booking link"
        >
          <span className={copied ? "text-emerald-400 font-semibold" : "text-muted group-hover:text-fg"}>
            {copied ? "Link Copied" : "Copy link"}
          </span>
        </button>

        {/* Right: Bespoke crafted meeting glyph in neutral metallic frame */}
        <div className="w-9 h-9 rounded-xl bg-surface/90 border border-line/80 group-hover:border-line-strong flex items-center justify-center transition-all duration-200 shadow-2xs group-hover:scale-105">
          {isPhone ? (
            <BespokePhoneGlyph className="w-5 h-5" />
          ) : (
            <BespokeMeetingGlyph className="w-5 h-5" />
          )}
        </div>
      </div>
    </SpotlightCard>
  );
}
