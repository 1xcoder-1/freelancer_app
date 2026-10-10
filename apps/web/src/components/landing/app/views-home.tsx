"use client";

import * as React from "react";
import {
  Calendar,
  ChevronRight,
  DollarSign,
  LayoutGrid,
  Receipt,
  RefreshCw,
  TrendingDown,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppChip, AppStatCard, IconButton, PageTitle } from "./primitives";

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
