"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Wallet,
  RefreshCw,
  AlertTriangle,
  PiggyBank,
  TrendingDown,
  CalendarDays,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCashflowSummary,
  updateInvoiceStatus,
  type CashflowSummary,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { toast } from "sonner";

const money = (n: number, currency: string) =>
  `${currency === "USD" ? "$" : `${currency} `}${n.toLocaleString(undefined, { maximumFractionDigits: 0})}`;

export function CashflowPanel() {
  const { getToken } = useAuth();
  const [markingId, setMarkingId] = useState<string | null>(null);

  const { data: summary, loading, refresh } = useApiData<CashflowSummary>(
    "cashflow:summary",
    async (token) => getCashflowSummary(token),
    { reportContext: "cashflow" }
  );

  const currency = summary?.currency ?? "USD";

  const handleMarkPaid = async (invoiceId: string) => {
    setMarkingId(invoiceId);
    try {
      const token = (await getToken()) || undefined;
      await updateInvoiceStatus(invoiceId, "paid", token);
      invalidateCache("cashflow:summary");
      invalidateCache("invoices:data");
      invalidateCache("dashboard:data");
      refresh();
      toast.success("Invoice marked as paid");
    } catch (err) {
      console.error("Error marking invoice paid:", err);
      toast.error("Could not update invoice");
    } finally {
      setMarkingId(null);
    }
  };

  if (loading && !summary) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card border-line p-4 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-28" />
            </Card>
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (!summary) {
    return (
      <Card className="bg-card border-line p-10 text-center">
        <Wallet className="w-10 h-10 text-accent mx-auto mb-3" />
        <h3 className="font-display text-lg font-bold text-fg">Money view is unavailable</h3>
        <p className="text-muted text-sm mt-1 mb-4">
          We couldn&apos;t reach the numbers. Your data is safe — just try again.
        </p>
        <Button onClick={() => refresh(true)} className="bg-accent hover:bg-accent-hi text-accent-fg">
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Try Again
        </Button>
      </Card>
    );
  }

  // One merged series so the chart shows history AND the 90-day outlook.
  const chartData = [
    ...summary.history_6m.map((h) => ({
      month: h.month.slice(5),
      collected: h.collected,
      expenses: h.expenses,
      expected: null as number | null,
    })),
    ...summary.forecast_90d.map((f) => ({
      month: f.month.slice(5),
      collected: null as number | null,
      expenses: null as number | null,
      expected: f.total_expected,
    })),
  ];

  const agingBars = [
    { key: "not_due_yet", label: "Not due yet", tone: "bg-info" },
    { key: "days_1_15", label: "1–15 days late", tone: "bg-warn" },
    { key: "days_16_30", label: "16–30 days late", tone: "bg-warn" },
    { key: "days_31_plus", label: "31+ days late", tone: "bg-danger" },
  ] as const;
  const agingMax = Math.max(1, ...Object.values(summary.aging).map((b) => b.amount));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold tracking-tight text-fg">Money in & out</h2>
            <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs">Live</Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Who owes you, when the money lands, and what you can safely spend.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={loading} className="border-line text-fg">
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border-line p-4">
          <div className="flex items-center gap-2 text-muted text-xs font-semibold">
            <Wallet className="w-3.5 h-3.5 text-accent" /> Owed to you
          </div>
          <p className="text-xl font-bold text-fg mt-1.5">{money(summary.receivables_total, currency)}</p>
          <p className="text-[11px] text-muted mt-0.5">not paid yet</p>
        </Card>
        <Card className={`bg-card border-line p-4 ${summary.at_risk_total > 0 ? "border-danger/40" : ""}`}>
          <div className="flex items-center gap-2 text-muted text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5 text-danger" /> Very late (31+ days)
          </div>
          <p className="text-xl font-bold text-fg mt-1.5">{money(summary.at_risk_total, currency)}</p>
          <p className="text-[11px] text-muted mt-0.5">time to call them</p>
        </Card>
        <Card className="bg-card border-line p-4">
          <div className="flex items-center gap-2 text-muted text-xs font-semibold">
            <PiggyBank className="w-3.5 h-3.5 text-ok" /> Safe to spend
          </div>
          <p className="text-xl font-bold text-ok mt-1.5">{money(summary.safe_to_spend_next_30d, currency)}</p>
          <p className="text-[11px] text-muted mt-0.5">in the next 30 days</p>
        </Card>
        <Card className="bg-card border-line p-4">
          <div className="flex items-center gap-2 text-muted text-xs font-semibold">
            <CalendarDays className="w-3.5 h-3.5 text-info" /> Days to get paid
          </div>
          <p className="text-xl font-bold text-fg mt-1.5">
            {summary.avg_days_to_payment !== null ? `${summary.avg_days_to_payment}d` : "—"}
          </p>
          <p className="text-[11px] text-muted mt-0.5">average, invoice → money in</p>
        </Card>
      </div>

      {/* Income vs expenses + forecast chart */}
      <Card className="bg-card border-line p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-bold text-fg">Money in vs money out — and what&apos;s coming</h2>
          {summary.income_volatility_pct > 50 && (
            <Badge className="bg-warn/10 text-warn border-transparent font-mono text-[10px]">
              <TrendingDown className="w-3 h-3 mr-1" /> UP & DOWN {summary.income_volatility_pct}%
            </Badge>
          )}
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "var(--fg)",
                }}
                formatter={(value) => (typeof value === "number" ? money(value, currency) : value)}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
              <Bar dataKey="collected" name="Money in" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="expenses" name="Money out" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={28} opacity={0.7} />
              <Line
                type="monotone"
                dataKey="expected"
                name="Expected income"
                stroke="var(--info)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted mt-2">
          Bars show what really happened. The dashed line shows money likely coming in:
          open invoices plus deals close to closing ({money(summary.weighted_pipeline_value, currency)}).
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Receivables aging */}
        <Card className="bg-card border-line p-5">
          <h2 className="font-display text-base font-bold text-fg mb-4">How late are payments?</h2>
          <div className="space-y-3">
            {agingBars.map((bucket) => {
              const cell = summary.aging[bucket.key];
              const pct = Math.round((cell.amount / agingMax) * 100);
              return (
                <div key={bucket.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-muted">{bucket.label}</span>
                    <span className="font-mono text-fg">
                      {money(cell.amount, currency)} · {cell.count} invoice{cell.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface overflow-hidden">
                    <div
                      className={`h-full rounded-full ${bucket.tone} transition-all duration-500`}
                      style={{ width: `${Math.max(pct, cell.amount > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {summary.receivables_total === 0 && (
            <p className="text-[11px] text-muted mt-3">Nothing unpaid right now — nice.</p>
          )}
        </Card>

        {/* Overdue action list */}
        <Card className="bg-card border-line p-5">
          <h2 className="font-display text-base font-bold text-fg mb-1">Get paid now</h2>
          <p className="text-[11px] text-muted mb-4">Overdue invoices, oldest first. Reminder emails go out on their own too.</p>
          {summary.overdue_invoices.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-ok bg-ok/5 border border-dashed border-ok/30 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4" />
              Nothing overdue. Great!
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {summary.overdue_invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg truncate flex items-center gap-1.5">
                      {inv.days_overdue >= 31 && <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" />}
                      {inv.invoice_number}
                    </p>
                    <p className="text-[11px] text-muted">
                      {inv.days_overdue} days late · due {new Date(inv.due_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-mono font-bold text-fg">{money(inv.amount, currency)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkPaid(inv.id)}
                      disabled={markingId === inv.id}
                      className="border-line text-fg h-7 px-2.5 text-xs"
                      title="Mark this invoice as paid"
                    >
                      {markingId === inv.id ? "Saving…" : "Paid"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
