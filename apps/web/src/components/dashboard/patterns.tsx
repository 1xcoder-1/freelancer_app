"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { TextMorph } from "torph/react";
import { ArrowLeft } from "@/components/animated-icons";
import { cn } from "@/lib/utils";
import { SpotlightCard } from "@/components/ui/spotlight-card";

/* ------------------------------------------------------------------
   Shared dashboard patterns styled 1:1 after the reference app:
   page header + subtitle, big-number stat cards with status dots,
   and tinted mono pill chips.
------------------------------------------------------------------- */

export function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
  backLabel,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="space-y-3 mb-8">
      {backHref && (
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel ?? "Back"}</span>
          </Link>
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
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
    </div>
  );
}

export interface StatCardRow {
  text: string;
  dot?: "ok" | "danger" | "warn" | "info" | "green" | "red" | "blue" | "amber";
  check?: boolean;
  href?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  badge,
  subtext,
  rows,
  className,
  href,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  badge?: React.ReactNode;
  subtext?: string;
  rows?: StatCardRow[];
  className?: string;
  href?: string;
  onClick?: () => void;
}) {
  const router = useRouter();

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      router.push(href);
    }
  };

  const isClickable = Boolean(href || onClick);

  return (
    <SpotlightCard
      radius={260}
      glow="rgba(234,88,12,0.08)"
      onClick={isClickable ? handleCardClick : undefined}
      className={cn(
        "bg-card dark:bg-[#141518] border border-line dark:border-[#26272d] rounded-2xl p-6 flex flex-col justify-between min-h-[180px] shadow-sm transition-all duration-150 ease-out",
        isClickable && "cursor-pointer hover:border-accent/40 dark:hover:border-accent/40 hover:shadow-md hover:-translate-y-0.5 group",
        !isClickable && "hover:border-line-strong dark:hover:border-[#383942]",
        className
      )}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-sm sm:text-[15px] font-medium text-fg dark:text-[#f4f4f5] leading-snug whitespace-pre-line tracking-wide flex items-center gap-1.5">
          {label}
          {isClickable && (
            <ChevronRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 group-hover:text-accent transition-all -ml-0.5" />
          )}
        </h3>
        {Icon && (
          <Icon className="w-4 h-4 text-muted dark:text-[#d4d4d8] opacity-90 shrink-0 mt-0.5 group-hover:text-accent transition-colors" />
        )}
      </div>

      {/* Primary Value — numbers morph by place value as live data changes. */}
      <div className="my-auto py-1">
        <div className="font-display text-2xl sm:text-3xl font-medium text-fg dark:text-white tracking-tight leading-none">
          {typeof value === "number" ? (
            <TextMorph numbers className="tabular-nums">{value}</TextMorph>
          ) : (
            value
          )}
        </div>
      </div>

      {/* Bottom Row: List with right-aligned colored dots / checkmark or Subtext & Badge */}
      {rows && rows.length > 0 ? (
        <div className="space-y-1.5 pt-1">
          {rows.map((r, idx) => {
            const rowClickable = Boolean(r.href || r.onClick);
            return (
              <div
                key={idx}
                onClick={(e) => {
                  if (rowClickable) {
                    e.stopPropagation();
                    if (r.onClick) r.onClick();
                    else if (r.href) router.push(r.href);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 text-xs text-muted dark:text-[#a1a1aa] transition-colors",
                  rowClickable && "cursor-pointer hover:text-accent hover:underline decoration-accent/40"
                )}
              >
                <span>{r.text}</span>
                {r.check ? (
                  <span className="text-[#22c55e] font-bold text-xs">✓</span>
                ) : r.dot === "ok" || r.dot === "green" ? (
                  <span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block shrink-0" />
                ) : r.dot === "danger" || r.dot === "red" ? (
                  <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block shrink-0" />
                ) : r.dot === "warn" || r.dot === "amber" ? (
                  <span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block shrink-0" />
                ) : r.dot === "info" || r.dot === "blue" ? (
                  <span className="w-2 h-2 rounded-full bg-[#38bdf8] inline-block shrink-0" />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (subtext || badge) ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted dark:text-[#a1a1aa] pt-1">
          <span className="truncate">{subtext}</span>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
      ) : null}
    </SpotlightCard>
  );
}

const chipTones: Record<string, string> = {
  green: "bg-emerald-500/10 text-emerald-700 dark:text-[#22c55e] border-emerald-500/20 dark:bg-[#062414] dark:border-[#0d542c] hover:border-emerald-500/40",
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-[#22c55e] border-emerald-500/20 dark:bg-[#062414] dark:border-[#0d542c] hover:border-emerald-500/40",
  blue: "bg-sky-500/10 text-sky-700 dark:text-[#38bdf8] border-sky-500/20 dark:bg-[#082238] dark:border-[#0e4b7a] hover:border-sky-500/40",
  info: "bg-sky-500/10 text-sky-700 dark:text-[#38bdf8] border-sky-500/20 dark:bg-[#082238] dark:border-[#0e4b7a] hover:border-sky-500/40",
  red: "bg-rose-500/10 text-rose-700 dark:text-[#fb7185] border-rose-500/20 dark:bg-[#2f0814] dark:border-[#6b162f] hover:border-rose-500/40",
  danger: "bg-rose-500/10 text-rose-700 dark:text-[#fb7185] border-rose-500/20 dark:bg-[#2f0814] dark:border-[#6b162f] hover:border-rose-500/40",
  amber: "bg-amber-500/10 text-amber-700 dark:text-[#fbbf24] border-amber-500/20 dark:bg-[#2e1905] dark:border-[#6d3c0a] hover:border-amber-500/40",
  warn: "bg-amber-500/10 text-amber-700 dark:text-[#fbbf24] border-amber-500/20 dark:bg-[#2e1905] dark:border-[#6d3c0a] hover:border-amber-500/40",
  purple: "bg-purple-500/10 text-purple-700 dark:text-[#c084fc] border-purple-500/20 dark:bg-[#240a38] dark:border-[#581c87] hover:border-purple-500/40",
  violet: "bg-purple-500/10 text-purple-700 dark:text-[#c084fc] border-purple-500/20 dark:bg-[#240a38] dark:border-[#581c87] hover:border-purple-500/40",
  neutral: "bg-surface text-muted dark:text-[#d4d4d8] border-line dark:bg-[#18191d] dark:border-[#2d2f36] hover:border-line-strong",
};

export function StatChip({
  children,
  tone = "neutral",
  className,
  href,
  onClick,
}: {
  children: React.ReactNode;
  tone?: keyof typeof chipTones | string;
  className?: string;
  href?: string;
  onClick?: () => void;
}) {
  const isClickable = Boolean(href || onClick);
  const baseClasses = cn(
    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-[13px] font-medium tracking-tight shadow-xs transition-all",
    isClickable
      ? "hover:scale-[1.03] active:scale-[0.98] cursor-pointer hover:shadow-sm select-none"
      : "hover:scale-[1.02]",
    chipTones[tone] ?? chipTones.neutral,
    className
  );

  if (href) {
    return (
      <Link href={href} className={baseClasses}>
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClasses}>
        {children}
      </button>
    );
  }

  return (
    <span className={baseClasses}>
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
