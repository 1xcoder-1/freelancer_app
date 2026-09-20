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
        <h1 className="font-display text-[26px] sm:text-3xl font-bold tracking-tight text-fg">
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
  rows,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  rows?: { text: string; dot?: "ok" | "danger" | "warn" | "info" }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card border border-line rounded-xl p-5 flex flex-col min-h-[148px] shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[17px] font-medium text-fg leading-snug max-w-[80%]">
          {label}
        </span>
        {Icon && <Icon className="w-5 h-5 text-fg shrink-0" />}
      </div>
      <div className="font-display text-[32px] font-semibold text-fg mt-1 leading-none">
        {value}
      </div>
      {rows && rows.length > 0 && (
        <div className="mt-auto pt-4 space-y-1">
          {rows.map((r) => (
            <div key={r.text} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="font-mono">{r.text}</span>
              {r.dot && (
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    r.dot === "ok" && "bg-ok",
                    r.dot === "danger" && "bg-danger",
                    r.dot === "warn" && "bg-warn",
                    r.dot === "info" && "bg-info"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const chipTones: Record<string, string> = {
  ok: "bg-ok/10 text-ok border-ok/20",
  danger: "bg-danger/10 text-danger border-danger/20",
  warn: "bg-warn/15 text-warn border-warn/25",
  info: "bg-info/10 text-info border-info/20",
  violet: "bg-violet/10 text-violet border-violet/20",
  accent: "bg-accent/10 text-accent border-accent/20",
  neutral: "bg-surface text-muted border-line",
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
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-mono font-semibold",
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
