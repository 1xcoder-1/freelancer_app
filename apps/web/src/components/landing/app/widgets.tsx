"use client";

import * as React from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  LayoutGrid,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  Unplug,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Amount } from "./primitives";

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
    <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#303034] bg-[#161617] shadow-2xl">
      <div className="flex items-center gap-2.5 border-b border-[#28282a] px-4 py-3.5">
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
                <span className="block truncate text-sm font-semibold text-[#f0efed]">
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
        <Amount>$3,000.00</Amount>
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
