"use client";

import React from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Shared dashboard patterns styled 1:1 after the reference app:
   page header + subtitle, big-number stat cards with status dots,
   and tinted mono pill chips.
------------------------------------------------------------------- */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted mt-1.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  badge,
  subtext,
  rows,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  badge?: React.ReactNode;
  subtext?: string;
  rows?: { text: string; dot?: "ok" | "danger" | "warn" | "info" | "green" | "red" | "blue" | "amber"; check?: boolean }[];
  tone?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-[#141518] dark:bg-[#141518] border border-[#26272d] hover:border-[#383942] rounded-2xl p-6 flex flex-col justify-between min-h-[180px] shadow-sm transition-all duration-200",
        className
      )}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-sm sm:text-[15px] font-medium text-[#f4f4f5] leading-snug whitespace-pre-line tracking-wide">
          {label}
        </h3>
        {Icon && (
          <Icon className="w-4 h-4 text-[#d4d4d8] opacity-90 shrink-0 mt-0.5" />
        )}
      </div>

      {/* Primary Value */}
      <div className="my-auto py-1">
        <div className="font-display text-2xl sm:text-3xl font-medium text-white tracking-tight leading-none">
          {value}
        </div>
      </div>

      {/* Bottom Row: List with right-aligned colored dots / checkmark or Subtext & Badge */}
      {rows && rows.length > 0 ? (
        <div className="space-y-1 pt-1">
          {rows.map((r, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-[#a1a1aa]">
              <span>{r.text}</span>
              {r.check ? (
                <span className="text-[#22c55e] font-bold text-xs">✓</span>
              ) : r.dot === "ok" || r.dot === "green" ? (
                <span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block" />
              ) : r.dot === "danger" || r.dot === "red" ? (
                <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block" />
              ) : r.dot === "warn" || r.dot === "amber" ? (
                <span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block" />
              ) : r.dot === "info" || r.dot === "blue" ? (
                <span className="w-2 h-2 rounded-full bg-[#38bdf8] inline-block" />
              ) : null}
            </div>
          ))}
        </div>
      ) : (subtext || badge) ? (
        <div className="flex items-center justify-between gap-2 text-xs text-[#a1a1aa] pt-1">
          <span className="truncate">{subtext}</span>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
      ) : null}
    </div>
  );
}

const chipTones: Record<string, string> = {
  green: "bg-[#062414] text-[#22c55e] border-[#0d542c]",
  ok: "bg-[#062414] text-[#22c55e] border-[#0d542c]",
  blue: "bg-[#082238] text-[#38bdf8] border-[#0e4b7a]",
  info: "bg-[#082238] text-[#38bdf8] border-[#0e4b7a]",
  red: "bg-[#2f0814] text-[#fb7185] border-[#6b162f]",
  danger: "bg-[#2f0814] text-[#fb7185] border-[#6b162f]",
  amber: "bg-[#2e1905] text-[#fbbf24] border-[#6d3c0a]",
  warn: "bg-[#2e1905] text-[#fbbf24] border-[#6d3c0a]",
  purple: "bg-[#240a38] text-[#c084fc] border-[#581c87]",
  violet: "bg-[#240a38] text-[#c084fc] border-[#581c87]",
  neutral: "bg-[#18191d] text-[#d4d4d8] border-[#2d2f36]",
};

export function StatChip({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof chipTones | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-[13px] font-medium tracking-tight shadow-xs transition-transform hover:scale-[1.02]",
        chipTones[tone] ?? chipTones.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}

/* Toolbar: search input + pill filter buttons (reference problems table header) */
export function Toolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  children,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap mb-5">
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <svg
          className="w-4 h-4 text-faint absolute left-3.5 top-1/2 -translate-y-1/2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
        </svg>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-10 pr-4 py-2.5 rounded-full bg-card border border-line text-sm text-fg placeholder:text-faint focus:outline-none focus:border-accent transition-colors"
        />
      </div>
      {children}
    </div>
  );
}

export function FilterPill({
  children,
  active,
  onClick,
  className,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
        active
          ? "bg-accent text-accent-fg border-accent"
          : "bg-card text-fg border-line hover:border-line-strong",
        className
      )}
    >
      {children}
    </button>
  );
}

/* Reference-style data table: uppercase muted headers, hairline rows */
export function RefTable({
  columns,
  children,
}: {
  columns: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((c) => (
                <th
                  key={c}
                  className="text-left px-5 py-3.5 text-[11px] font-mono font-bold uppercase tracking-wider text-muted"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
