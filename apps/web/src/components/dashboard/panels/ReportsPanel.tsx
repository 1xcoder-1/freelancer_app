"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  ShieldAlert,
  Target,
  Repeat,
  TrendingUp,
  Users,
  RefreshCw,
  Receipt,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard, FilterPill } from "@/components/dashboard/patterns";
import { getReportsSummary, type ReportsSummary } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
import { useWorkspaceCurrency } from "@/hooks/use-workspace-currency";
import { formatMoney } from "@/lib/currency";

const WINDOWS = [3, 6, 12];

// The stage keys are the stored values; the labels are what the lead pages
// show, so this page reads like the rest of the app instead of the schema.
const STAGE_LABELS: { key: string; label: string; tone: string }[] = [
  { key: "new", label: "New", tone: "bg-info" },
  { key: "contacted", label: "Contacted", tone: "bg-accent" },
  { key: "proposal", label: "Proposal", tone: "bg-violet" },
  { key: "negotiation", label: "Talking Price", tone: "bg-warn" },
  { key: "won", label: "Won", tone: "bg-ok" },
  { key: "lost", label: "Lost", tone: "bg-danger" },
];

function monthLabel(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  if (!year || !month) return ym;
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

export function ReportsPanel() {
  const [months, setMonths] = useState(6);

  const { data, loading, error, refresh } = useApiData<ReportsSummary>(
    `reports:summary:${months}`,
    async (token) => getReportsSummary(months, token),
    { reportContext: "reports" }
  );

  const { currency: wsCurrency } = useWorkspaceCurrency();
  const currency = wsCurrency || data?.revenue_at_stake?.currency || "USD";
  const money = (n: number) => formatMoney(n ?? 0, currency, 0);

  const revenueTotal = useMemo(
    () => (data?.revenue_by_month ?? []).reduce((sum, row) => sum + row.total, 0),
    [data]
  );
  const topClientTotal = data?.revenue_by_client?.[0]?.total ?? 0;
  const bestMonth = useMemo(() => {
    const rows = data?.revenue_by_month ?? [];
    return rows.length ? rows.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  }, [data]);
  const monthsWithData = (data?.revenue_by_month ?? []).filter((row) => row.total > 0).length;

  // One shared maximum keeps the revenue bars and the client bars honest
  // against each other.
  const barMax = Math.max(
    1,
    ...(data?.revenue_by_month ?? []).map((row) => row.total),
    ...(data?.revenue_by_client ?? []).map((row) => row.total)
  );

  const funnelMax = Math.max(
    1,
    ...Object.values(data?.lead_funnel?.stages ?? { new: 1 })
  );

  if (loading && !data) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[180px] w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="bg-card border-line p-8 rounded-2xl text-center">
        <ShieldAlert className="w-8 h-8 text-warn mx-auto mb-3" />
        <h3 className="font-display text-lg font-medium text-fg">Reports could not load</h3>
        <p className="text-sm text-muted mt-1">{error.message}</p>
        <Button variant="outline" size="sm" onClick={() => refresh(true)} className="mt-4 border-line text-fg">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      </Card>
    );
  }

  const atStake = data?.revenue_at_stake;
  const invoices = data?.invoices;
  const funnel = data?.lead_funnel;

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">Reports</h2>
            <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
              Last {months} months
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            What the book is actually worth: money collected, money at risk, deals in flight, and
            the rate you burn it at.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {WINDOWS.map((w) => (
            <FilterPill key={w} active={months === w} onClick={() => setMonths(w)}>
              {w}m
            </FilterPill>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh(true)}
            disabled={loading}
            className="border-line text-fg bg-card hover:bg-surface w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Headline Numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Collected"
          value={money(revenueTotal)}
          icon={DollarSign}
          rows={[
            { text: `${monthsWithData} of ${months} months paid`, dot: "ok" },
            { text: bestMonth ? `Best: ${monthLabel(bestMonth.month)} ${money(bestMonth.total)}` : "No payments yet", dot: "info" },
          ]}
        />
        <StatCard
          label="At stake"
          value={money(atStake?.totals?.total_at_stake ?? 0)}
          icon={ShieldAlert}
          rows={[
            { text: `${money(atStake?.totals?.unpaid_invoices_value ?? 0)} Unpaid`, dot: "danger" },
            { text: `${money(atStake?.totals?.unbilled_value ?? 0)} Unbilled`, dot: "warn" },
          ]}
        />
        <StatCard
          label="Open pipeline"
          value={money(funnel?.pipeline_value ?? 0)}
          icon={Target}
          rows={[
            {
              text: funnel?.win_rate != null
                ? `${Math.round(funnel.win_rate * 100)}% win rate`
                : "Nothing closed yet",
              dot: "ok",
            },
            { text: `${atStake?.totals?.unsigned_contracts_value ? money(atStake.totals.unsigned_contracts_value) : money(0)} Unsigned`, dot: "warn" },
          ]}
        />
        <StatCard
          label="Monthly burn"
          value={money(data?.expenses?.recurring_run_rate ?? 0)}
          icon={Repeat}
          rows={[
            { text: `${money(data?.expenses?.one_time_this_month ?? 0)} One-off this month`, dot: "info" },
            {
              text: revenueTotal > 0
                ? `${money((revenueTotal / months) - (data?.expenses?.recurring_run_rate ?? 0))} Net per month`
                : "No revenue to compare",
              dot: (revenueTotal / months) - (data?.expenses?.recurring_run_rate ?? 0) >= 0 ? "ok" : "danger",
            },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue by month */}
        <Card className="bg-card border-line p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-medium text-fg flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" /> Revenue by month
            </h3>
            <span className="text-[11px] font-mono text-faint">cash in</span>
          </div>

          {data && data.revenue_by_month.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">
              No payments recorded in this window. Money shows up here the moment an invoice is paid.
            </p>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {(data?.revenue_by_month ?? []).map((row) => (
                <div key={row.month} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-mono text-faint truncate">
                    {row.total > 0 ? money(row.total) : ""}
                  </span>
                  <div className="w-full flex-1 flex items-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(2, (row.total / barMax) * 100)}%` }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className="w-full rounded-t-md bg-accent/70 border border-accent/40"
                      title={`${row.month}: ${money(row.total)}`}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted truncate w-full text-center">
                    {monthLabel(row.month)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top clients */}
        <Card className="bg-card border-line p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-medium text-fg flex items-center gap-2">
              <Users className="w-4 h-4 text-accent" /> Top clients
            </h3>
            <span className="text-[11px] font-mono text-faint">paid, this window</span>
          </div>

          {(data?.revenue_by_client ?? []).length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">No settled invoices yet.</p>
          ) : (
            <div className="space-y-3">
              {data!.revenue_by_client.map((row) => (
                <div key={row.client} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-fg truncate">{row.client}</span>
                    <span className="font-mono text-xs text-muted">{money(row.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(row.total / barMax) * 100}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className={`h-full rounded-full ${
                        revenueTotal > 0 && row.total / revenueTotal > 0.5 ? "bg-warn" : "bg-accent"
                      }`}
                      title={
                        revenueTotal > 0
                          ? `${Math.round((row.total / revenueTotal) * 100)}% of collected revenue`
                          : undefined
                      }
                    />
                  </div>
                </div>
              ))}
              {revenueTotal > 0 && topClientTotal / revenueTotal > 0.5 && (
                <p className="text-[11px] text-warn">
                  Over half your collected revenue comes from one client — worth a second account in the pipeline.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Lead funnel */}
        <Card className="bg-card border-line p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-medium text-fg flex items-center gap-2">
              <Target className="w-4 h-4 text-accent" /> Lead funnel
            </h3>
            <span className="text-[11px] font-mono text-faint">
              {funnel?.win_rate != null ? `${Math.round(funnel.win_rate * 100)}% won` : "no closes"}
            </span>
          </div>

          <div className="space-y-2.5">
            {STAGE_LABELS.map((stage) => {
              const count = funnel?.stages?.[stage.key] ?? 0;
              return (
                <div key={stage.key} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-muted shrink-0">{stage.label}</span>
                  <div className="flex-1 h-6 rounded-md bg-surface overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / funnelMax) * 100}%` }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className={`h-full ${stage.tone} opacity-70`}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-xs text-fg shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Invoice health */}
        <Card className="bg-card border-line p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-medium text-fg flex items-center gap-2">
              <Receipt className="w-4 h-4 text-accent" /> Invoice health
            </h3>
            <span className="text-[11px] font-mono text-faint">all time</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted">Paid</p>
              <p className="text-xl font-bold font-mono text-ok mt-1">{money(invoices?.paid_total ?? 0)}</p>
              <p className="text-[11px] text-faint mt-0.5">{invoices?.paid_count ?? 0} invoices</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted">Overdue</p>
              <p className="text-xl font-bold font-mono text-danger mt-1">{money(invoices?.overdue_total ?? 0)}</p>
              <p className="text-[11px] text-faint mt-0.5">{invoices?.overdue_count ?? 0} invoices</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted">Awaiting payment</p>
              <p className="text-xl font-bold font-mono text-warn mt-1">{money(invoices?.awaiting_total ?? 0)}</p>
              <p className="text-[11px] text-faint mt-0.5">{invoices?.awaiting_count ?? 0} invoices</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted">Hours not billed</p>
              <p className="text-xl font-bold font-mono text-fg mt-1">
                {(atStake?.totals?.unbilled_hours ?? 0).toFixed(1)}
              </p>
              <p className="text-[11px] text-faint mt-0.5">{money(atStake?.totals?.unbilled_value ?? 0)} unbilled</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Where the risk sits */}
      {(atStake?.at_risk_projects?.length ?? 0) > 0 && (
        <Card className="bg-card border-line p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-medium text-fg flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-danger" /> Where the money is exposed
            </h3>
            <span className="text-[11px] font-mono text-faint">
              {money(atStake!.totals.total_at_stake)} total
            </span>
          </div>

          <div className="space-y-2">
            {atStake!.at_risk_projects
              .slice()
              .sort((a, b) => b.total_at_risk - a.total_at_risk)
              .slice(0, 6)
              .map((p) => (
                <div
                  key={p.project_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg truncate">{p.project_title}</p>
                    <p className="text-xs text-muted truncate">{p.client_name ?? "No client linked"}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    {p.unbilled_value > 0 && <span className="text-warn">{money(p.unbilled_value)} unbilled</span>}
                    {p.unpaid_value > 0 && <span className="text-danger">{money(p.unpaid_value)} unpaid</span>}
                    {p.unsigned_contract_value > 0 && (
                      <span className="text-info">{money(p.unsigned_contract_value)} unsigned</span>
                    )}
                    <span className="text-fg font-bold">{money(p.total_at_risk)}</span>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
