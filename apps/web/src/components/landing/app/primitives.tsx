"use client";

import * as React from "react";
import { Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { chipTones, dotColors, pillTones } from "./tokens";

/* Panel-level primitives shared by every marketing mock: the app's chips,
   stat/roster cards, tags, headings and the fixed-scale renderer. */

export function AppChip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof chipTones;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium tracking-tight shadow-xs",
        chipTones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function AppStatCard({
  label,
  value,
  icon: Icon,
  rows,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  rows: { text: string; dot?: keyof typeof dotColors | "check" }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[150px] flex-col justify-between rounded-2xl border border-[#26272d] bg-[#141518] p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-medium leading-snug tracking-wide text-[#f4f4f5]">
          {label}
        </h3>
        <Icon className="mt-0.5 size-4 shrink-0 text-[#d4d4d8] opacity-90" />
      </div>
      <div className="my-auto py-1 text-2xl font-medium leading-none tracking-tight text-white">
        {value}
      </div>
      <div className="space-y-1 pt-1">
        {rows.map((r) => (
          <div key={r.text} className="flex items-center gap-2 text-xs text-[#a1a1aa]">
            <span>{r.text}</span>
            {r.dot === "check" ? (
              <span className="text-xs font-bold text-[#22c55e]">✓</span>
            ) : r.dot ? (
              <span className={cn("inline-block size-2 rounded-full", dotColors[r.dot])} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChaiCup({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <g transform="rotate(10 16 16)">
        <path
          d="M9.5 12.5h13l-1.4 11.2c-.15 1.1-1.1 1.9-2.2 1.9h-5.8c-1.1 0-2.05-.8-2.2-1.9L9.5 12.5z"
          fill="#f97316"
        />
        <path
          d="M8 7h16l-1.8 17.2c-.18 1.4-1.35 2.5-2.75 2.5h-6.9c-1.4 0-2.57-1.1-2.75-2.5L8 7z"
          stroke="#9ca3af"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M7 7h18" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M12.5 17.5l-1.8 1.4 1.8 1.4M19.5 17.5l1.8 1.4-1.8 1.4M16.8 16.5l-1.6 4.8"
          stroke="#ffffff"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export function AppVisualCard({
  title,
  subtitle,
  badge,
  tags,
}: {
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  tags?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-[136px] flex-col justify-between overflow-hidden rounded-2xl border border-[#26272d] bg-[#141518] p-5 shadow-sm">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ea580c 1px, transparent 1px), linear-gradient(to bottom, #ea580c 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(circle at 10% 15%, black 0%, transparent 65%)",
          WebkitMaskImage:
            "radial-gradient(circle at 10% 15%, black 0%, transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -right-10 size-48 rounded-full bg-gradient-to-tl from-orange-500/20 via-amber-500/10 to-transparent opacity-60 blur-2xl"
      />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h4 className="text-[15px] font-medium capitalize leading-snug tracking-wide text-[#f4f4f5]">
            {title}
          </h4>
          {tags && <div className="flex flex-wrap items-center gap-1.5">{tags}</div>}
        </div>
        {badge && <div className="shrink-0 pt-0.5">{badge}</div>}
      </div>
      <div className="relative z-10 flex items-end justify-between gap-2 pt-2">
        <span className="min-w-0 truncate text-[13px] capitalize tracking-wide text-[#a1a1aa]">
          {subtitle}
        </span>
        <ChaiCup className="h-7 w-7 shrink-0" />
      </div>
    </div>
  );
}

export const vipBadge = (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 px-3 py-1 text-xs font-semibold tracking-wide text-amber-300 shadow-sm">
    <span className="text-sm text-amber-400">★</span>
    <span className="text-[11px] font-bold tracking-wider">VIP</span>
  </span>
);

export const standardBadge = (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-slate-300">
    <span className="text-[10px] text-slate-400">✦</span>
    <span className="text-[11px] tracking-wide">Standard</span>
  </span>
);

export function RateTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-orange-500/25 bg-orange-500/15 px-2.5 py-0.5 font-mono text-[11px] font-medium text-orange-400">
      {children}
    </span>
  );
}

export function SilenceTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-red-500/25 bg-red-500/15 px-2.5 py-0.5 text-[11px] font-medium text-red-400">
      {children}
    </span>
  );
}

export function Counter({ value, state }: { value: string; state: string }) {
  return (
    <div className="flex items-baseline font-mono font-semibold tracking-tight">
      <span className="text-[17px] font-bold text-[#d46b28]">{value}</span>
      <span className="text-sm font-medium text-[#a1a1aa]">/{state}</span>
    </div>
  );
}

export function StatusTag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "paid" | "overdue" | "sent";
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize",
        tone === "paid" && "border-emerald-500/25 bg-emerald-500/15 font-semibold text-emerald-400",
        tone === "overdue" && "border-rose-500/25 bg-rose-500/15 font-semibold text-rose-400",
        tone === "sent" && "border-sky-500/25 bg-sky-500/15 text-sky-400"
      )}
    >
      {children}
    </span>
  );
}

export function DueTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-orange-500/25 bg-orange-500/15 px-2.5 py-0.5 font-mono text-[11px] font-medium text-orange-400">
      {children}
    </span>
  );
}

export function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex flex-col items-start space-y-1.5">
      <h3 className="text-lg font-medium tracking-wide text-[#f0efed]">{children}</h3>
      <div className="h-[2.5px] w-full rounded-full bg-[#d46b28] shadow-xs" />
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xl font-medium tracking-wide text-[#f0efed] sm:text-2xl">
        {title}
      </p>
      {subtitle && <p className="mt-1.5 text-sm text-[#a19d98]">{subtitle}</p>}
    </div>
  );
}

export function AccentButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#d46b28] px-3.5 text-sm font-semibold text-white shadow-xs">
      <Plus className="size-3.5" />
      {children}
    </span>
  );
}

export function IconButton({
  children = <RefreshCw className="size-4" />,
  label,
}: {
  children?: React.ReactNode;
  label: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#28282a] bg-[#161617] text-[#f0efed]"
    >
      {children}
    </span>
  );
}

export function RosterCount({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-[#d46b28]/20 bg-[#261912] px-2.5 py-1 font-mono text-xs font-semibold text-[#d46b28]">
      {children}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
  mono = false,
  strong = false,
}: {
  children: React.ReactNode;
  tone?: keyof typeof pillTones;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px]",
        mono ? "font-mono" : "font-medium capitalize",
        strong && "font-semibold",
        pillTones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function Fraction({
  current,
  total,
}: {
  current: React.ReactNode;
  total: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline font-mono tracking-tight">
      <span className="text-[17px] font-bold text-[#d46b28]">{current}</span>
      <span className="text-sm font-medium text-[#a1a1aa]">/{total}</span>
    </div>
  );
}

export function Amount({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[17px] font-bold tracking-tight text-[#d46b28]">
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  badge,
  subtitle,
  actions,
}: {
  title: string;
  badge: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#28282a]/60 pb-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-xl font-medium tracking-wide text-[#f0efed] sm:text-2xl">
            {title}
          </h2>
          <RosterCount>{badge}</RosterCount>
        </div>
        <p className="mt-1 text-sm text-[#a19d98]">{subtitle}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function AppCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-[#28282a] bg-[#161617] p-6", className)}>
      {children}
    </div>
  );
}

export function AppSubTabs({
  tabs,
  active,
}: {
  tabs: { label: string; count: number }[];
  active: number;
}) {
  return (
    <div className="inline-flex items-center gap-1 overflow-x-auto rounded-xl border border-[#28282a] bg-[#1d1d1f]/70 p-1">
      {tabs.map((t, i) => (
        <span
          key={t.label}
          className={cn(
            "flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium",
            i === active ? "bg-[#d46b28] font-semibold text-white" : "text-[#a19d98]"
          )}
        >
          {t.label}
          <span
            className={cn(
              "min-w-4 rounded-full px-1.5 text-center font-mono text-[10px]",
              i === active
                ? "bg-[#e07730] text-white"
                : "border border-[#28282a] bg-[#1d1d1f] text-[#a19d98]"
            )}
          >
            {t.count}
          </span>
        </span>
      ))}
    </div>
  );
}

/* Renders a real screen at its desktop width and scales it into the slot,
   so the marketing mock keeps the app's own grid instead of re-flowing. */
export function ScaledMock({
  designWidth,
  designHeight,
  children,
  className,
}: {
  designWidth: number;
  designHeight: number;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.5);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / designWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [designWidth]);
  return (
    <div
      ref={ref}
      className={cn("w-full overflow-hidden", className)}
      style={{ height: designHeight * scale }}
    >
      <div
        className="origin-top-left"
        style={{ width: designWidth, height: designHeight, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
