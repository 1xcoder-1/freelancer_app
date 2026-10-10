"use client";

import * as React from "react";
import {
  ChevronRight,
  Clock,
  Home,
  Pause,
  Receipt,
  Search,
  Square,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { T } from "./app/tokens";

/* ------------------------------------------------------------------
   Phone showcase screens — a purpose-built mobile app UI, not the
   desktop dashboard shrunk down. Design width 360 rendered at a fixed
   scale into the 264px bezel: large readable type, roomy cards,
   bottom tab bar and a home indicator, like a real native build.
------------------------------------------------------------------- */

const DW = 360;

type TabId = "home" | "clients" | "time" | "money" | "settings";

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "clients", label: "Clients", icon: Users },
  { id: "time", label: "Time", icon: Clock },
  { id: "money", label: "Money", icon: Wallet },
  { id: "settings", label: "Settings", icon: Receipt },
];

function StatusBar() {
  return (
    <div className="relative flex h-10 shrink-0 items-center justify-between px-5 text-[12px] font-semibold text-white">
      <span className="tabular-nums">9:41</span>
      <span
        aria-hidden
        className="absolute left-1/2 top-1.5 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black"
      />
      <span className="flex items-center gap-1.5">
        <span className="flex items-end gap-[2px]" aria-hidden>
          <span className="h-[5px] w-[3px] rounded-[1px] bg-white/70" />
          <span className="h-[7px] w-[3px] rounded-[1px] bg-white/70" />
          <span className="h-[9px] w-[3px] rounded-[1px] bg-white/80" />
          <span className="h-[11px] w-[3px] rounded-[1px] bg-white/40" />
        </span>
        <span className="h-[10px] w-[20px] rounded-[3px] border border-white/50 p-px" aria-hidden>
          <span className="block h-full w-3/4 rounded-[1.5px] bg-emerald-400" />
        </span>
      </span>
    </div>
  );
}

function BottomTabs({ active }: { active: TabId }) {
  return (
    <div className="shrink-0 border-t border-[#232325] bg-[#131314]/95 px-3 pb-1.5 pt-2">
      <div className="flex items-start justify-between">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <span
              key={t.id}
              className={cn(
                "flex w-[58px] flex-col items-center gap-1 rounded-xl py-1.5",
                isActive ? "bg-[#261912]" : "opacity-80"
              )}
            >
              <t.icon className={cn("size-4.5", isActive ? "text-[#e07730]" : "text-[#7a7671]")} />
              <span
                className={cn(
                  "text-[9px] font-semibold",
                  isActive ? "text-[#e07730]" : "text-[#7a7671]"
                )}
              >
                {t.label}
              </span>
            </span>
          );
        })}
      </div>
      <span aria-hidden className="mx-auto mt-1.5 block h-1 w-[110px] rounded-full bg-white/25" />
    </div>
  );
}

function MobileApp({
  active,
  title,
  subtitle,
  scale = 0.705,
  children,
}: {
  active: TabId;
  title: string;
  subtitle: string;
  scale?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: T.bg }}>
      <div
        className="absolute inset-0 flex origin-top-left flex-col text-[#f0efed]"
        style={{
          width: DW,
          // stretch the design canvas to the bezel's real height so the
          // tab bar always pins to the bottom of the screen
          height: `calc(100% / ${scale})`,
          transform: `scale(${scale})`,
        }}
      >
        <StatusBar />
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <div className="min-w-0">
            <h2 className="truncate text-[22px] font-semibold tracking-tight text-white">
              {title}
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-[#a19d98]">{subtitle}</p>
          </div>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#d46b28]/40 bg-[#261912] font-mono text-[10px] font-bold text-[#e07730]">
            fb
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-4">{children}</div>
        <BottomTabs active={active} />
      </div>
    </div>
  );
}

/* ------------------------------- screens ------------------------------- */

const clientRows = [
  {
    name: "Acme Corp",
    initials: "AC",
    tint: "bg-[#261912] text-[#e07730]",
    meta: "USD 5,000/hr · 2 active",
    chip: { text: "VIP", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  },
  {
    name: "Nova Studio",
    initials: "NS",
    tint: "bg-[#082238] text-[#38bdf8]",
    meta: "47d silent · $3,200/hr",
    chip: { text: "Silent", cls: "border-rose-500/25 bg-rose-500/10 text-rose-400" },
  },
  {
    name: "Helio Media",
    initials: "HM",
    tint: "bg-[#240a38] text-[#c084fc]",
    meta: "USD 1,800/hr · retainer",
    chip: { text: "VIP", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  },
  {
    name: "Kite Legal",
    initials: "KL",
    tint: "bg-[#062414] text-[#22c55e]",
    meta: "USD 1,500/mo · steady",
    chip: { text: "Standard", cls: "border-white/10 bg-white/5 text-slate-300" },
  },
];

export function MobileClientsScreen() {
  return (
    <MobileApp active="clients" title="Clients" subtitle="8 across 5 groups">
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-[#28282a] bg-[#161617] px-3 py-2.5 text-[12px] text-[#6f6b66]">
          <Search className="size-3.5" />
          Search the roster…
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-[#d46b28] px-3 py-1 text-[11px] font-semibold text-white">
            All · 8
          </span>
          <span className="rounded-full border border-[#28282a] bg-[#161617] px-3 py-1 text-[11px] text-[#a19d98]">
            VIP · 3
          </span>
          <span className="rounded-full border border-[#28282a] bg-[#161617] px-3 py-1 text-[11px] text-[#a19d98]">
            Retainers · 2
          </span>
        </div>
        <div className="space-y-2.5 pt-1">
          {clientRows.map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-3 rounded-2xl border border-[#28282a] bg-[#161617] p-3.5"
            >
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-2xl text-[13px] font-bold",
                  c.tint
                )}
              >
                {c.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[#f0efed]">{c.name}</p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-[#a19d98]">{c.meta}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  c.chip.cls
                )}
              >
                {c.chip.text}
              </span>
              <ChevronRight className="size-4 shrink-0 text-[#6f6b66]" />
            </div>
          ))}
        </div>
      </div>
    </MobileApp>
  );
}

export function MobileTimerScreen({ scale }: { scale?: number }) {
  return (
    <MobileApp
      active="time"
      title="Time"
      subtitle="One tap to start, billed when you stop"
      scale={scale}
    >
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-[#28282a] bg-gradient-to-b from-[#1a1a1c] to-[#141415] p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-[#082238] text-[#38bdf8]">
              <Clock className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[#f0efed]">
                Website redesign
              </p>
              <p className="truncate text-[11px] text-[#a19d98]">Homepage hero section</p>
            </div>
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Live
            </span>
          </div>
          <p className="mt-4 text-center font-mono text-[40px] font-bold leading-none tracking-tight text-[#6ea8dc]">
            01:12:30
          </p>
          <p className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[#6f6b66]">
            keeps counting offline
          </p>
          <div className="mt-4 flex gap-2">
            <span className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#28282a] bg-[#1d1d1f] text-[13px] font-medium text-[#f0efed]">
              <Pause className="size-4" />
              Pause
            </span>
            <span className="flex h-10 flex-[1.6] items-center justify-center gap-1.5 rounded-xl bg-[#d46b28] text-[13px] font-bold text-white shadow-[0_6px_18px_rgba(212,107,40,0.35)]">
              <Square className="size-4" />
              Stop &amp; Save
            </span>
          </div>
        </div>

        <p className="px-1 pt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#6f6b66]">
          Today · 2h 00m
        </p>
        <div className="space-y-2">
          {[
            { d: "Focus Session", p: "Brand system", s: "00:48:05" },
            { d: "Retainer sync", p: "Monthly retainer", s: "01:05:00" },
          ].map((e) => (
            <div
              key={e.d}
              className="flex items-center gap-3 rounded-2xl border border-[#28282a] bg-[#161617] p-3"
            >
              <span className="flex size-8 items-center justify-center rounded-xl bg-[#6ea8dc]/10 text-[#6ea8dc]">
                <Clock className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[#f0efed]">{e.d}</p>
                <p className="truncate text-[11px] text-[#a19d98]">{e.p}</p>
              </div>
              <span className="shrink-0 font-mono text-[12px] font-semibold text-[#6ea8dc]">
                {e.s}
              </span>
            </div>
          ))}
        </div>
      </div>
    </MobileApp>
  );
}

export function MobileInvoicesScreen() {
  return (
    <MobileApp active="money" title="Invoices" subtitle="Draft, send, chase — from your pocket">
      <div className="space-y-3">
        <div className="rounded-2xl border border-[#28282a] bg-gradient-to-b from-[#1a1a1c] to-[#141415] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#6f6b66]">
            Outstanding
          </p>
          <p className="mt-1 font-mono text-[30px] font-bold leading-none tracking-tight text-[#f0efed]">
            $3,640
          </p>
          <div className="mt-3 flex gap-2">
            <span className="flex-1 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-400">
              2 overdue
            </span>
            <span className="flex-1 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-400">
              $2,000 paid this month
            </span>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {[
            {
              n: "INV-023",
              c: "Nova Studio",
              a: "$3,000",
              status: "Overdue",
              cls: "border-rose-500/25 bg-rose-500/10 text-rose-400",
            },
            {
              n: "INV-021",
              c: "Orbit Press",
              a: "$640",
              status: "Sent",
              cls: "border-sky-500/25 bg-sky-500/10 text-sky-400",
            },
            {
              n: "INV-024",
              c: "Acme Corp",
              a: "$1,200",
              status: "Paid",
              cls: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
            },
          ].map((inv) => (
            <div
              key={inv.n}
              className="flex items-center gap-3 rounded-2xl border border-[#28282a] bg-[#161617] p-3.5"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#261912] text-[#e07730]">
                <Receipt className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[#f0efed]">{inv.n}</p>
                <p className="truncate text-[11px] text-[#a19d98]">{inv.c}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-[14px] font-bold text-[#f0efed]">{inv.a}</p>
                <span
                  className={cn(
                    "mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    inv.cls
                  )}
                >
                  {inv.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MobileApp>
  );
}
