"use client";

import * as React from "react";
import {
  ArrowRight,
  Calendar,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  Crown,
  DollarSign,
  Home,
  IdCard,
  Layers,
  LayoutGrid,
  Mail,
  Pause,
  PenLine,
  Plus,
  Receipt,
  RefreshCw,
  Repeat,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  TrendingDown,
  Unplug,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Real Freelance Book dashboard, re-rendered as a marketing mock.
   Every token, radius, chip and card below is copied from
   apps/web/src/app/globals.css (.dark), components/dashboard/Sidebar.tsx,
   patterns.tsx and CategoryVisualCard.tsx so the landing pages show the
   actual product instead of an invented UI.
------------------------------------------------------------------- */

export const T = {
  bg: "#0e0e0f",
  fg: "#f0efed",
  muted: "#a19d98",
  faint: "#6f6b66",
  card: "#161617",
  surface: "#1d1d1f",
  line: "#28282a",
  lineStrong: "#38383b",
  accent: "#d46b28",
  accentHi: "#e07730",
  accentSoft: "#261912",
  info: "#6ea8dc",
} as const;

const chipTones: Record<string, string> = {
  green: "bg-[#062414] text-[#22c55e] border-[#0d542c]",
  blue: "bg-[#082238] text-[#38bdf8] border-[#0e4b7a]",
  red: "bg-[#2f0814] text-[#fb7185] border-[#6b162f]",
  amber: "bg-[#2e1905] text-[#fbbf24] border-[#6d3c0a]",
  purple: "bg-[#240a38] text-[#c084fc] border-[#581c87]",
  violet: "bg-[#240a38] text-[#c084fc] border-[#581c87]",
  neutral: "bg-[#18191d] text-[#d4d4d8] border-[#2d2f36]",
};

function AppChip({
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

const dotColors = {
  ok: "bg-[#22c55e]",
  danger: "bg-[#ef4444]",
  warn: "bg-[#f59e0b]",
  info: "bg-[#38bdf8]",
};

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

/* Tilted chai-cup glyph that ends every roster / invoice card */
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

/* CategoryVisualCard: roster + invoice cards with pixel grid, warm glow,
   top-right badge, tag pills and a "By …" footer */
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

const standardBadge = (
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
      <h1 className="text-xl font-medium tracking-wide text-[#f0efed] sm:text-2xl">
        {title}
      </h1>
      {subtitle && <p className="mt-1.5 text-sm text-[#a19d98]">{subtitle}</p>}
    </div>
  );
}

function AccentButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#d46b28] px-3.5 text-sm font-semibold text-white shadow-xs">
      <Plus className="size-3.5" />
      {children}
    </span>
  );
}

function IconButton({
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

/* ---------------- app shell: sidebar + topbar ---------------- */

export const navItems: {
  title: string;
  icon: React.ElementType;
  chevron?: boolean;
}[] = [
  { title: "Home", icon: Home },
  { title: "Clients", icon: Users, chevron: true },
  { title: "Projects", icon: LayoutGrid, chevron: true },
  { title: "Time", icon: Clock },
  { title: "Money", icon: Wallet },
  { title: "Proposals", icon: Sparkles },
  { title: "Booking", icon: Calendar },
  { title: "Planner", icon: PenLine },
  { title: "Profile", icon: IdCard },
  { title: "Settings", icon: Settings },
];

export function AppSidebar({ active }: { active: string }) {
  return (
    <aside className="flex w-[248px] shrink-0 select-none flex-col border-r border-dashed border-[#28282a] bg-[#161617]">
      <div className="flex h-16 items-center justify-between border-b border-dashed border-[#28282a] px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[#d46b28]/40 bg-[#261912] font-mono text-xs font-bold text-[#f0efed] shadow-xs">
            fb
          </span>
          <span className="whitespace-nowrap text-[15px] font-bold tracking-tight text-[#f0efed]">
            Freelance<span className="font-bold text-[#d46b28]">Book</span>
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-hidden px-3 py-4">
        {navItems.map((item) => {
          const isActive = item.title === active;
          return (
            <div
              key={item.title}
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm",
                isActive
                  ? "border border-[#d46b28]/40 bg-[#261912] font-bold text-[#f0efed] shadow-xs"
                  : "font-medium text-[#a19d98]"
              )}
            >
              <item.icon
                className={cn(
                  "size-5 shrink-0",
                  isActive ? "text-[#d46b28]" : "text-[#a19d98]"
                )}
              />
              <span className="flex-1 truncate font-semibold text-[#f0efed]">
                {item.title}
              </span>
              {item.chevron && <ChevronDown className="size-4 text-[#a19d98]" />}
            </div>
          );
        })}
      </div>

      <div className="border-t border-dashed border-[#28282a] p-3">
        <div className="flex items-center gap-2.5 overflow-hidden rounded-full border border-dashed border-[#38383b] p-1.5 pr-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#28282a] bg-[#1d1d1f] text-xs font-bold text-[#f0efed]">
            A
          </span>
          <span className="truncate text-xs font-semibold text-[#f0efed]">Alex</span>
        </div>
      </div>
    </aside>
  );
}

export function AppTopbar() {
  return (
    <div className="flex h-16 shrink-0 items-center justify-end gap-2.5 border-b border-dashed border-[#28282a] bg-[#161617] px-6">
      <div className="flex h-9 w-[248px] items-center gap-2 rounded-full border border-[#28282a] bg-[#0e0e0f] px-3.5 text-[13px] text-[#6f6b66]">
        <Search className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Search or run a command</span>
        <span className="shrink-0 rounded-md border border-[#28282a] px-1.5 py-0.5 font-mono text-[10px] text-[#a19d98]">
          ⌘K
        </span>
      </div>
      <span className="flex size-9 items-center justify-center rounded-xl border border-[#28282a] bg-[#161617] text-[#a19d98]">
        <Sun className="size-4" />
      </span>
    </div>
  );
}

/* Collapsed icon rail — what the real sidebar becomes below 1024px, which is
   exactly how the dashboard renders on a phone. */
function PhoneRail({ active }: { active: string }) {
  return (
    <aside className="flex w-[72px] shrink-0 select-none flex-col border-r border-dashed border-[#28282a] bg-[#161617]">
      <div className="flex h-16 items-center justify-center border-b border-dashed border-[#28282a]">
        <span className="flex size-8 items-center justify-center rounded-xl border border-[#d46b28]/40 bg-[#261912] font-mono text-xs font-bold text-[#f0efed] shadow-xs">
          fb
        </span>
      </div>
      <div className="flex flex-1 flex-col items-center gap-1 overflow-hidden py-4">
        {navItems.slice(0, 7).map((item) => {
          const isActive = item.title === active;
          return (
            <div
              key={item.title}
              className={cn(
                "relative flex size-11 items-center justify-center rounded-full",
                isActive
                  ? "border border-[#d46b28]/40 bg-[#261912] shadow-xs"
                  : "text-[#a19d98]"
              )}
            >
              <item.icon
                className={cn("size-5", isActive ? "text-[#d46b28]" : "text-[#a19d98]")}
              />
              {isActive && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#d46b28]" />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-center border-t border-dashed border-[#28282a] p-3">
        <span className="flex size-8 items-center justify-center rounded-full border border-dashed border-[#38383b] text-xs font-bold text-[#f0efed]">
          A
        </span>
      </div>
    </aside>
  );
}

/* Hero window tabs and the sidebar row each one lights up. */
export type AppViewId = "clients" | "time" | "money" | "home";

export const views: { id: AppViewId; rail: string; nav: string }[] = [
  { id: "clients", rail: "Manage Clients", nav: "Clients" },
  { id: "time", rail: "Track Time", nav: "Time" },
  { id: "money", rail: "Invoices & Billing", nav: "Projects" },
  { id: "home", rail: "See Earnings", nav: "Home" },
];

/* Phone viewport: the dashboard at 390 CSS px, scaled into the bezel. */
export function PhoneApp({
  active,
  scale = 0.65,
  children,
}: {
  active: string;
  scale?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0e0e0f]">
      <div
        className="flex origin-top-left bg-[#0e0e0f] text-[#f0efed]"
        style={{
          width: 390,
          height: `${100 / scale}%`,
          transform: `scale(${scale})`,
        }}
      >
        <div className="flex h-full min-w-0 flex-col">
          {/* iOS status strip with the island, in design coordinates */}
          <div className="relative flex h-11 shrink-0 items-center justify-between px-6 text-[13px] font-semibold">
            <span className="tabular-nums">9:41</span>
            <span
              aria-hidden
              className="absolute left-1/2 top-1.5 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black"
            />
            <span className="flex items-center gap-1.5">
              <span className="h-[9px] w-[13px] rounded-[2px] bg-white/80" />
              <span className="h-[11px] w-[22px] rounded-[3px] border border-white/50 p-px">
                <span className="block h-full w-3/4 rounded-[1.5px] bg-emerald-400" />
              </span>
            </span>
          </div>
          <div className="flex min-h-0 flex-1">
            <PhoneRail active={active} />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex h-16 shrink-0 items-center justify-end gap-2 border-b border-dashed border-[#28282a] bg-[#161617] px-4">
                <span className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#28282a] bg-[#0e0e0f] px-3 text-[13px] text-[#6f6b66]">
                  <Search className="size-4 shrink-0" />
                  <span className="truncate">Search or run a command</span>
                </span>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#28282a] text-[#a19d98]">
                  <Sun className="size-4" />
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden px-4 py-5">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- panel-level primitives ----------------
   The pieces every real dashboard panel reuses: a heading with its
   mono count badge, the SubTabs pill strip, plain Cards, and the
   status/budget/version chips that sit inside CategoryVisualCards.
---------------------------------------------------------- */

function PanelHeader({
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

function AppCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#28282a] bg-[#161617] p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/* SubTabs.tsx: rounded-xl surface strip, active tab is a solid accent pill. */
function AppSubTabs({
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

const pillTones = {
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  sky: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  warn: "border-[#e3a83a]/30 bg-[#e3a83a]/20 text-[#e3a83a]",
  danger: "border-[#ef6f5f]/30 bg-[#ef6f5f]/15 text-[#ef6f5f]",
  accent: "border-[#d46b28]/25 bg-[#261912] text-[#d46b28]",
  neutral: "border-[#28282a] bg-[#1d1d1f] text-[#a19d98]",
} as const;

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

/* CategoryVisualCard's top-right progress readout. */
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

/* Invoice-card amount (InvoicesPanel.tsx) — mono figure only; the status
   lives in the StatusTag pill below the title. */
function Amount({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[17px] font-bold tracking-tight text-[#d46b28]">
      {children}
    </div>
  );
}

/* ---------------- CommandMenu.tsx: the real Ctrl+K palette ---------------- */

const paletteItems = [
  { title: "Clients", icon: Users },
  { title: "Time", icon: Clock },
  { title: "Projects", icon: LayoutGrid },
  { title: "Invoices", icon: Receipt },
  { title: "Settings", icon: Settings },
];

export function CommandPalette({ query = "" }: { query?: string }) {
  return (
    <div className="w-full max-w-lg overflow-hidden rounded-xl border border-dashed border-[#28282a] bg-[#161617] shadow-2xl">
      <div className="flex items-center gap-2.5 border-b border-dashed border-[#28282a] px-4 py-3">
        <Search className="size-4 shrink-0 text-[#d46b28]" />
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className={query ? "text-[#f0efed]" : "text-[#6f6b66]"}>
            {query || "Search sections..."}
          </span>
          <span className="ml-0.5 inline-block h-3.5 w-px translate-y-[3px] bg-[#f0efed]/60" />
        </span>
        <X className="size-4 shrink-0 text-[#6f6b66]" />
      </div>
      <div className="max-h-[248px] overflow-hidden p-2">
        {paletteItems.map((item, i) => (
          <div
            key={item.title}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg p-3",
              i === 0 && "bg-[#1d1d1f]"
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#28282a] bg-[#1d1d1f] text-[#a19d98]">
                <item.icon className={cn("size-4", i === 0 && "text-[#d46b28]")} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-[#f0efed]">
                  {item.title}
                </span>
                <span className="block font-mono text-[10px] text-[#a19d98]">Go to</span>
              </span>
            </div>
            <ArrowRight
              className={cn(
                "size-4 shrink-0",
                i === 0 ? "translate-x-1 text-[#d46b28]" : "text-[#6f6b66]"
              )}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-[#28282a] bg-[#1d1d1f] px-4 py-2.5 font-mono text-[11px] text-[#6f6b66]">
        <span>Navigate with mouse or enter</span>
        <span>ESC to close</span>
      </div>
    </div>
  );
}

/* ---------------- DashboardCalendar: the real Google connect control ---------- */

export function GoogleCalendarPill({ email, synced }: { email: string; synced: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#38383b] px-2.5 py-1">
      <span className="size-1.5 animate-pulse rounded-full bg-[#3fbf6f] motion-reduce:animate-none" />
      <span className="max-w-[180px] truncate font-mono text-[10px] text-[#a19d98]">
        {email} · {synced}
      </span>
      <span className="rounded p-1 text-[#a19d98]">
        <RefreshCw className="size-3.5" />
      </span>
      <span className="rounded p-1 text-[#a19d98]">
        <Unplug className="size-3.5" />
      </span>
    </div>
  );
}

export function GoogleCalendarButton() {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#38383b] px-3 text-sm text-[#f0efed]">
      <CalendarDays className="size-3.5 text-[#d46b28]" />
      Connect Google Calendar
    </span>
  );
}

/* The public pay link a client receives (/pay/[token]) — real method list
   and all, shown next to the calendar connect so the "integrations" row
   only claims things the product actually does. */
export function PayLinkCard() {
  const methods = ["Bank transfer", "Card", "PayPal", "Stripe", "Cash", "Other"];
  return (
    <div className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-[#28282a] bg-[#161617] p-6 shadow-xl">
      <div className="flex items-center gap-2.5 border-b border-[#28282a] pb-4">
        <span className="flex size-9 items-center justify-center rounded-xl bg-[#261912] text-[#d46b28]">
          <Receipt className="size-4.5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[#f0efed]">INV-023 · Nova Studio</p>
          <p className="text-xs text-[#a19d98]">freelancebook.app/pay/…</p>
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-[#a19d98]">Amount due</span>
        <span className="font-mono text-xl font-semibold text-[#f0efed]">$3,000.00</span>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[#a19d98]">Payment method</label>
        <div className="flex flex-wrap gap-1.5">
          {methods.map((m) => (
            <span
              key={m}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs",
                m === "Stripe"
                  ? "border-[#d46b28]/40 bg-[#261912] font-semibold text-[#f0efed]"
                  : "border-[#28282a] bg-[#0e0e0f] text-[#a19d98]"
              )}
            >
              {m}
            </span>
          ))}
        </div>
      </div>
      <span className="flex h-9 w-full items-center justify-center rounded-xl bg-[#d46b28] text-sm font-semibold text-white shadow-xs">
        Record payment
      </span>
      <p className="text-center text-[11px] text-[#6f6b66]">
        Marking it paid updates the roster, the invoice board and the cash-flow chart.
      </p>
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

/* ---------------- the real screens, one component each ----------------
   Each view below mirrors a live route: /dashboard, the Clients panel,
   /dashboard/time-tracker, the Invoices panel, the Projects panel, the
   Contracts panel and the Automations panel in Settings.
------------------------------------------------------------------------ */

/* /dashboard */
export function HomeView() {
  const tabs = ["Today", "My Projects", "Recent Invoices", "Time Entries"];
  const [tab, setTab] = React.useState(2);
  const invoices = [
    { n: "INV-024", c: "Acme Corp", d: "Oct 2, 2026", a: "$1,200.00", s: "paid" },
    { n: "INV-023", c: "Nova Studio", d: "Sep 18, 2026", a: "$3,000.00", s: "overdue" },
    { n: "INV-022", c: "Helio Media", d: "Sep 12, 2026", a: "$800.00", s: "sent" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <PageTitle title="Good afternoon, Alex" subtitle="Friday, October 9" />
        <div className="flex items-center gap-2">
          <IconButton label="Refresh">
            <RefreshCw className="size-3.5" />
          </IconButton>
          <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#d46b28] px-3.5 text-sm font-semibold text-white shadow-sm">
            <Calendar className="size-3.5" />
            Calendar
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <AppStatCard
          label="Earned"
          value="$12,345"
          icon={DollarSign}
          rows={[
            { text: "+8% vs last month", dot: "ok" },
            { text: "$3,200 Pending", dot: "danger" },
          ]}
        />
        <AppStatCard
          label="Expenses"
          value="$1,250"
          icon={TrendingDown}
          rows={[
            { text: "4 Recorded", dot: "ok" },
            { text: "$900 Recurring", dot: "danger" },
          ]}
        />
        <AppStatCard
          label="Projects"
          value="7"
          icon={LayoutGrid}
          rows={[
            { text: "7 Total", dot: "ok" },
            { text: "2 In Progress", dot: "danger" },
          ]}
        />
        <AppStatCard
          label="Active Clients"
          value="8"
          icon={Users}
          rows={[
            { text: "8 Retainers", dot: "check" },
            { text: "5 Ongoing", dot: "danger" },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <AppChip tone="green">
          <span className="font-semibold">3</span>
          <span>Invoices waiting</span>
        </AppChip>
        <AppChip tone="blue">
          <span className="font-semibold">5</span>
          <span>Pending leads</span>
        </AppChip>
        <AppChip tone="purple">
          <span className="font-semibold">2</span>
          <span>Pending intake forms</span>
        </AppChip>
        <AppChip tone="red">
          <span className="font-semibold">4</span>
          <span>Contracts waiting</span>
        </AppChip>
        <AppChip tone="violet">
          <span className="font-semibold">1</span>
          <span>Pending bookings</span>
        </AppChip>
      </div>

      <div className="rounded-xl border border-[#28282a] bg-[#161617] p-5">
        <div className="mb-4 flex items-center gap-5 border-b border-[#28282a]">
          {tabs.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(i)}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-1 py-2.5 text-sm font-semibold transition-colors",
                tab === i
                  ? "border-[#d46b28] text-[#d46b28]"
                  : "border-transparent text-[#a19d98]"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="divide-y divide-[#28282a]">
          {invoices.map((inv) => (
            <div key={inv.n} className="flex items-center gap-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#261912] text-[#d46b28]">
                <Receipt className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#f0efed]">{inv.n}</p>
                <p className="text-xs text-[#a19d98]">
                  {inv.c} • {inv.d}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-semibold text-[#f0efed]">{inv.a}</p>
                <p
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-wide",
                    inv.s === "paid"
                      ? "text-emerald-400"
                      : inv.s === "overdue"
                        ? "text-rose-400"
                        : "text-sky-400"
                  )}
                >
                  {inv.s}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-[#6f6b66]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Clients panel (ClientsPanel.tsx) */
export function ClientsView({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-6">
      {!compact && (
        <div className="grid grid-cols-4 gap-4">
          <AppStatCard
            label="Total Clients"
            value="8"
            icon={Users}
            rows={[{ text: "3 VIP · 5 Standard", dot: "info" }]}
          />
          <AppStatCard
            label="VIP Accounts"
            value="3"
            icon={Crown}
            rows={[{ text: "3 Active VIPs", dot: "ok" }]}
          />
          <AppStatCard
            label="Repeat Clients"
            value="4"
            icon={Repeat}
            rows={[{ text: "4 Returning Clients", dot: "ok" }]}
          />
          <AppStatCard
            label="Categories"
            value="5"
            icon={Layers}
            rows={[{ text: "5 Roster Groups", dot: "info" }]}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-2">
          <RosterCount>8 Total Clients</RosterCount>
          <span className="hidden font-mono text-xs text-[#a19d98] sm:inline">
            across 5 categories
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <IconButton label="Refresh" />
          <AccentButton>
            <span>Add Client</span>
          </AccentButton>
        </div>
      </div>

      <div className="space-y-4">
        <GroupHeading>VIP &amp; Enterprise</GroupHeading>
        <div className={cn("grid gap-5", compact ? "grid-cols-2" : "grid-cols-3")}>
          <AppVisualCard
            title="Acme Corp"
            subtitle="By Acme Corp"
            badge={vipBadge}
            tags={<RateTag>USD 5,000/hr</RateTag>}
          />
          <AppVisualCard
            title="Nova Studio"
            subtitle="By Nova Studio"
            badge={vipBadge}
            tags={
              <>
                <SilenceTag>47d silent</SilenceTag>
                <RateTag>USD 3,200/hr</RateTag>
              </>
            }
          />
          {!compact && (
            <AppVisualCard
              title="Helio Media"
              subtitle="By Helio Media"
              badge={vipBadge}
              tags={<RateTag>USD 1,800/hr</RateTag>}
            />
          )}
        </div>
      </div>

      <div className="space-y-4">
        <GroupHeading>Active Retainers</GroupHeading>
        <div className={cn("grid gap-5", compact ? "grid-cols-2" : "grid-cols-3")}>
          <AppVisualCard
            title="Kite Legal"
            subtitle="By Kite Legal"
            badge={standardBadge}
            tags={<RateTag>USD 1,500/mo</RateTag>}
          />
          <AppVisualCard
            title="Orbit Press"
            subtitle="By Orbit Press"
            badge={standardBadge}
            tags={<RateTag>3h 20m this week</RateTag>}
          />
          {!compact && (
            <AppVisualCard
              title="Cobalt Co"
              subtitle="By Cobalt Co"
              badge={standardBadge}
              tags={<SilenceTag>62d silent</SilenceTag>}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* /dashboard/time-tracker */
export function TimeView() {
  const entries = [
    { d: "Homepage hero section", p: "Website redesign", t: "Fri, Oct 9", s: "01:12:30" },
    { d: "Focus Session", p: "Brand system", t: "Fri, Oct 9", s: "00:48:05" },
    { d: "Retainer sync", p: "Monthly retainer", t: "Thu, Oct 8", s: "01:05:00" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 pb-1">
        <PageTitle
          title="Time"
          subtitle="Start the clock, stop it, and the hours are ready to bill. It keeps counting even if you close the tab or switch devices."
        />
        <IconButton label="Refresh" />
      </div>

      <div className="space-y-4 rounded-xl border border-[#28282a] bg-[#161617] p-6 shadow-xl">
        <div className="grid grid-cols-3 items-center gap-4">
          <div>
            <label className="text-xs font-semibold text-[#a19d98]">Project</label>
            <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-[#28282a] bg-[#0e0e0f] px-3 py-2 text-sm text-[#f0efed]">
              <span className="min-w-0 truncate">Website redesign</span>
              <ChevronDown className="size-4 shrink-0 text-[#a19d98]" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#a19d98]">
              What are you doing?
            </label>
            <div className="mt-1 truncate rounded-lg border border-[#28282a] bg-[#0e0e0f] px-3 py-2 text-sm text-[#6f6b66]">
              e.g. Building the homepage
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="font-mono text-3xl font-bold text-[#6ea8dc]">02:40:11</span>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#28282a] px-3 text-sm text-[#f0efed]">
                <Pause className="size-4" />
                Pause
              </span>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#d46b28] px-3 text-sm font-semibold text-white">
                <Square className="size-4" />
                Stop &amp; Save
              </span>
            </div>
          </div>
        </div>
        <p className="border-t border-[#28282a] pt-3 text-xs text-[#6f6b66]">
          Tracking <span className="font-medium text-[#f0efed]">Website redesign</span> •
          gets billed • saving every second
        </p>
      </div>

      <div className="space-y-3">
        {entries.map((e) => (
          <div
            key={e.d}
            className="flex items-center justify-between rounded-xl border border-[#28282a] bg-[#161617] p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="rounded-xl bg-[#6ea8dc]/10 p-2.5 text-[#6ea8dc]">
                <Clock className="size-5" />
              </span>
              <div className="min-w-0">
                <h4 className="truncate text-sm font-semibold text-[#f0efed]">{e.d}</h4>
                <p className="truncate text-xs text-[#a19d98]">
                  {e.p} • {e.t}
                </p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-sm font-semibold text-[#6ea8dc]">
              {e.s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Invoices panel (InvoicesPanel.tsx) */
export function MoneyView() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageTitle
          title="Invoices & Billing"
          subtitle="Draft, send and chase payments without leaving the roster."
        />
        <div className="flex shrink-0 items-center gap-2.5">
          <IconButton label="Refresh" />
          <AccentButton>
            <span>Issue Invoice</span>
          </AccentButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <RosterCount>12 Total Invoices</RosterCount>
        <span className="hidden font-mono text-xs text-[#a19d98] sm:inline">
          across 4 categories
        </span>
      </div>

      <div className="space-y-4">
        <GroupHeading>Overdue Payments</GroupHeading>
        <div className="grid grid-cols-3 gap-4">
          <AppVisualCard
            title="INV-023"
            subtitle="Client: Nova Studio"
            badge={<Amount>$3,000</Amount>}
            tags={
              <>
                <StatusTag tone="overdue">Overdue</StatusTag>
                <DueTag>Due 09/28/2026</DueTag>
              </>
            }
          />
          <AppVisualCard
            title="INV-019"
            subtitle="Client: Kite Legal"
            badge={<Amount>$1,450</Amount>}
            tags={
              <>
                <StatusTag tone="overdue">Overdue</StatusTag>
                <DueTag>Due 09/15/2026</DueTag>
              </>
            }
          />
          <AppVisualCard
            title="INV-021"
            subtitle="Client: Orbit Press"
            badge={<Amount>$640</Amount>}
            tags={<StatusTag tone="sent">Sent to Client</StatusTag>}
          />
        </div>
      </div>

      <div className="space-y-4">
        <GroupHeading>Paid &amp; Settled</GroupHeading>
        <div className="grid grid-cols-3 gap-4">
          <AppVisualCard
            title="INV-024"
            subtitle="Client: Acme Corp"
            badge={<Amount>$1,200</Amount>}
            tags={<StatusTag tone="paid">★ Paid</StatusTag>}
          />
          <AppVisualCard
            title="INV-022"
            subtitle="Client: Helio Media"
            badge={<Amount>$800</Amount>}
            tags={<StatusTag tone="paid">★ Paid</StatusTag>}
          />
          <AppVisualCard
            title="INV-018"
            subtitle="Client: Cobalt Co"
            badge={<Amount>$2,300</Amount>}
            tags={<StatusTag tone="paid">★ Paid</StatusTag>}
          />
        </div>
      </div>
    </div>
  );
}

/* Projects panel (ProjectsPanel.tsx) */
export function ProjectsView() {
  return (
    <div className="space-y-6">
      <PanelHeader
        title="Projects & Deliverables"
        badge="7 Total Projects"
        subtitle="Run each job seamlessly: deliverables, milestones, budget burn, and e-signatures."
        actions={
          <>
            <IconButton label="Refresh" />
            <AccentButton>
              <span>Add Project</span>
            </AccentButton>
          </>
        }
      />

      <AppSubTabs
        active={0}
        tabs={[
          { label: "Active Projects", count: 5 },
          { label: "Archived", count: 2 },
        ]}
      />

      <div className="space-y-4">
        <GroupHeading>Fullstack Web Apps</GroupHeading>
        <div className="grid grid-cols-2 gap-5">
          <AppVisualCard
            title="Website redesign"
            subtitle="By Acme Corp"
            badge={<Fraction current={3} total={5} />}
            tags={
              <>
                <Pill tone="sky">In Progress</Pill>
                <Pill tone="accent" mono>
                  $4,500
                </Pill>
                <Pill tone="warn" mono>
                  6d left
                </Pill>
                <Pill tone="accent" mono>
                  12h unbilled
                </Pill>
              </>
            }
          />
          <AppVisualCard
            title="Booking flow"
            subtitle="By Nova Studio"
            badge={<Fraction current={1} total={4} />}
            tags={
              <>
                <Pill tone="amber">Planning</Pill>
                <Pill tone="accent" mono>
                  $2,800
                </Pill>
                <Pill tone="danger" mono>
                  2d overdue
                </Pill>
              </>
            }
          />
        </div>
      </div>

      <div className="space-y-4">
        <GroupHeading>Ongoing Retainers</GroupHeading>
        <div className="grid grid-cols-2 gap-5">
          <AppVisualCard
            title="Design system v2"
            subtitle="By Helio Media"
            badge={<Fraction current={4} total={4} />}
            tags={
              <>
                <Pill tone="emerald">Completed</Pill>
                <Pill tone="accent" mono>
                  $1,500
                </Pill>
              </>
            }
          />
          <AppVisualCard
            title="Monthly support"
            subtitle="By Orbit Press"
            badge={<Fraction current={2} total={6} />}
            tags={
              <>
                <Pill tone="sky">In Progress</Pill>
                <Pill tone="accent" mono>
                  $900
                </Pill>
                <Pill tone="accent" mono>
                  4h unbilled
                </Pill>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

/* Contracts panel (ContractsPanel.tsx) — the versioned-document surface. */
export function ContractsView() {
  return (
    <div className="space-y-6">
      <PanelHeader
        title="Contracts"
        badge="6 Total Contracts"
        subtitle="Send legally binding proposals, agreements, and contracts with real-time signature audit logs."
        actions={
          <>
            <IconButton label="Refresh" />
            <AccentButton>
              <span>Draft Contract</span>
            </AccentButton>
          </>
        }
      />

      <div className="space-y-4">
        <GroupHeading>Awaiting Signature</GroupHeading>
        <div className="grid grid-cols-2 gap-4">
          <AppVisualCard
            title="Brand refresh SOW"
            subtitle="By Client: Acme Corp"
            badge={<Fraction current="★" total="Signed" />}
            tags={
              <>
                <Pill tone="emerald" strong>
                  ★ Executed
                </Pill>
                <Pill tone="accent" mono>
                  v3
                </Pill>
                <Pill tone="neutral" mono>
                  awaiting 2d
                </Pill>
              </>
            }
          />
          <AppVisualCard
            title="Retainer agreement"
            subtitle="By Client: Nova Studio"
            badge={<Fraction current={1} total="Viewed" />}
            tags={
              <>
                <Pill tone="warn">Viewed by Client</Pill>
                <Pill tone="warn" mono strong>
                  expires in 2d
                </Pill>
                <Pill tone="accent" mono>
                  v2
                </Pill>
              </>
            }
          />
        </div>
      </div>

      <div className="space-y-4">
        <GroupHeading>Featured</GroupHeading>
        <div className="grid grid-cols-2 gap-4">
          <AppVisualCard
            title="Master service agreement"
            subtitle="By Client: Helio Media"
            badge={<Fraction current={0} total="Sent" />}
            tags={
              <>
                <Pill tone="sky">Sent</Pill>
                <Pill tone="neutral" mono>
                  awaiting 5d
                </Pill>
              </>
            }
          />
          <AppVisualCard
            title="Scope add-on"
            subtitle="By Client: Kite Legal"
            badge={<Fraction current={0} total="Draft" />}
            tags={<Pill tone="neutral">Draft</Pill>}
          />
        </div>
      </div>
    </div>
  );
}

/* Automations panel (AutomationsPanel.tsx, inside Settings → Automations). */
export function AutomationsView() {
  const bullets = [
    {
      lead: "When an invoice goes unpaid past its due date",
      rest: "— a friendly reminder is emailed automatically, then repeated on a schedule you control.",
    },
    {
      lead: "Before a booked meeting",
      rest: "— the client gets an email 24 hours out, so fewer slots go cold.",
    },
    {
      lead: "Overdue invoices are flagged",
      rest: "— on the dashboard the moment a due date passes.",
    },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-md text-sm text-[#a19d98]">
          FreelanceBook works in the background for you — it emails payment reminders and
          meeting reminders, so you don&apos;t have to.
        </p>
        <AppChip tone="green">
          <span className="size-1.5 rounded-full bg-[#22c55e]" />
          Running
        </AppChip>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <AppStatCard
          label="Late invoices"
          value="3"
          icon={Receipt}
          rows={[
            { text: "$5,090.00 past due", dot: "danger" },
            { text: "Checked automatically every day", dot: "ok" },
          ]}
        />
        <AppStatCard
          label="Payment reminders"
          value="3"
          icon={Mail}
          rows={[
            { text: "3 invoice(s) not paid yet", dot: "info" },
            { text: "Emailed 4d after due date", dot: "ok" },
          ]}
        />
        <AppStatCard
          label="Meeting reminders"
          value="2"
          icon={CalendarClock}
          rows={[
            { text: "2 booking(s) in the next 7 days", dot: "info" },
            { text: "Clients emailed 24h before", dot: "ok" },
          ]}
        />
        <AppStatCard
          label="Email delivery"
          value="Live"
          icon={Zap}
          rows={[{ text: "Emails are being sent", dot: "ok" }]}
        />
      </div>

      <AppCard>
        <div className="mb-3 flex items-center gap-2.5">
          <ShieldCheck className="size-5 text-[#f0efed]" />
          <h2 className="text-[17px] font-medium text-[#f0efed]">
            What happens automatically
          </h2>
        </div>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-[#a19d98]">
          {bullets.map((b) => (
            <li key={b.lead}>
              <span className="font-semibold text-[#f0efed]">{b.lead}</span>
              {b.rest}
            </li>
          ))}
        </ul>
      </AppCard>
    </div>
  );
}
