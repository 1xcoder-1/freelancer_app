"use client";

import { useCallback, useState } from "react";
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
  Pencil,
  Palmtree,
  ArrowRight,
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
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SubTabs, type SubTab } from "@/components/dashboard/SubTabs";
import {
  getCashflowSummary,
  updateInvoiceStatus,
  updateWorkspaceSettings,
  type CashflowSummary,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { toast } from "sonner";

const money = (n: number, currency: string) =>
  `${currency === "USD" ? "$" : `${currency} `}${n.toLocaleString(undefined, { maximumFractionDigits: 0})}`;

// The gauge tops out at one quarter of runway; beyond that the number is
// shown as "26+" — a freelancer acting on 40-week precision doesn't need a
// fuller arc, and the scale keeps differences in the danger zone readable.
const GAUGE_MAX_WEEKS = 26;

function runwayTone(weeks: number): { stroke: string; label: string } {
  if (weeks < 4) return { stroke: "var(--danger)", label: "Cut spending now" };
  if (weeks < 8) return { stroke: "var(--warn)", label: "Tight — chase invoices" };
  if (weeks < 13) return { stroke: "var(--info)", label: "Stable" };
  return { stroke: "var(--ok)", label: "Healthy" };
}

/** Semicircle weeks-of-runway gauge (roadmap 1.2). */
function RunwayGauge({ summary }: { summary: CashflowSummary }) {
  const current = summary.runway_weeks;
  const withIncoming = summary.runway_weeks_with_incoming;

  if (current === null || withIncoming === null) {
    return (
      <div className="flex flex-col items-center justify-center h-56 text-center">
        <TrendingDown className="w-8 h-8 text-faint mb-3" />
        <p className="text-sm font-semibold text-fg">Runway needs expense history</p>
        <p className="text-[11px] text-muted mt-1 max-w-56">
          Log your monthly costs once and the burn rate, gauge and reserve goal unlock automatically.
        </p>
      </div>
    );
  }

  // Arc geometry: radius 50, half-circle length ≈ 157.
  const ARC = 157;
  const pct = Math.min(1, current / GAUGE_MAX_WEEKS);
  const pctIncoming = Math.min(1, withIncoming / GAUGE_MAX_WEEKS);
  const tone = runwayTone(current);
  const fmtWeeks = (w: number) => (w >= GAUGE_MAX_WEEKS ? `${GAUGE_MAX_WEEKS}+` : w.toFixed(1));

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-52">
        <svg viewBox="0 0 140 78" className="w-full">
          {/* track */}
          <path d="M 20 72 A 50 50 0 0 1 120 72" fill="none" stroke="var(--line)" strokeWidth={10} strokeLinecap="round" />
          {/* projected reach if 60-day receivables arrive (ghost arc) */}
          {pctIncoming > pct && (
            <path
              d="M 20 72 A 50 50 0 0 1 120 72"
              fill="none"
              stroke="var(--info)"
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${ARC * pctIncoming} ${ARC}`}
              strokeDashoffset={-ARC * pct}
              opacity={0.22}
            />
          )}
          {/* current runway */}
          <path
            d="M 20 72 A 50 50 0 0 1 120 72"
            fill="none"
            stroke={tone.stroke}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${ARC * pct} ${ARC}`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-1 text-center">
          <p className="text-2xl font-bold text-fg leading-none">{fmtWeeks(current)}</p>
          <p className="text-[11px] text-muted mt-0.5">weeks of runway</p>
        </div>
      </div>
      <p className="text-xs font-semibold mt-2" style={{ color: tone.stroke }}>{tone.label}</p>
      <p className="text-[11px] text-muted mt-1.5">
        Burn {money(summary.weekly_burn_rate, summary.currency)}/wk ·{" "}
        {money(summary.monthly_burn_rate, summary.currency)}/mo average
      </p>
      <p className="text-[11px] text-info mt-1">
        Up to {fmtWeeks(withIncoming)} weeks if open invoices land on time
      </p>
    </div>
  );
}

type SubTabValue = "today" | "runway" | "getting-paid" | "billed-paid";

/**
 * Money In & Out is split into four small sub-pages so nothing looks
 * overwhelming: Today (3 big cards), Runway (gauge + savings), Getting paid
 * (late invoices), Billed vs paid (the chart + aging). One shared live
 * fetch keeps every sub-page in sync.
 */
export function CashflowPanel() {
  const { getToken } = useAuth();
  const [subTab, setSubTab] = useState<SubTabValue>("today");
  const [markingId, setMarkingId] = useState<string | null>(null);

  // Bank balance quick-edit (roadmap 1.1)
  const [editingBank, setEditingBank] = useState(false);
  const [bankInput, setBankInput] = useState("");
  const [savingBank, setSavingBank] = useState(false);

  // Live view: the server recomputes from real invoice/expense data; pollMs
  // keeps the numbers fresh while the page is open (deduped, paused on
  // hidden tabs) so marking an invoice paid here or in Invoices updates the
  // whole panel within one tick — no refresh button required.
  const { data: summary, loading, refresh } = useApiData<CashflowSummary>(
    "cashflow:summary",
    getCashflowSummary,
    { reportContext: "cashflow", pollMs: 15_000, ttlMs: 10_000 }
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

  const startBankEdit = useCallback(() => {
    if (!summary) return;
    setBankInput(String(summary.bank_balance));
    setEditingBank(true);
  }, [summary]);

  const handleSaveBank = async () => {
    // "" and text like "1,000"/"1.5k" come out of a type=number input as an
    // empty string; Number("") === 0 would silently zero the saved balance.
    const raw = bankInput.trim();
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value) || value < -10_000_000 || value > 100_000_000) {
      toast.error("Enter a plain number (no commas) within the allowed range");
      return;
    }
    if (savingBank) return;
    setSavingBank(true);
    try {
      const token = (await getToken()) || undefined;
      await updateWorkspaceSettings({ bank_balance: Math.round(value * 100) / 100 }, token);
      invalidateCache("cashflow:summary");
      setEditingBank(false);
      refresh();
      toast.success("Cash in bank updated");
    } catch (err) {
      console.error("Error saving bank balance:", err);
      toast.error("Could not save — try again");
    } finally {
      setSavingBank(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-full max-w-md rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card border-line p-4 space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-28" />
            </Card>
          ))}
        </div>
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

  // ------ derived pieces each sub-page uses -------------
  const finalize = (v: string) => setSubTab(v as SubTabValue);
  const tabs: readonly SubTab[] = [
    { value: "today", label: "Today" },
    { value: "runway", label: "Runway" },
    { value: "getting-paid", label: "Getting paid", count: summary.overdue_invoices.length },
    { value: "billed-paid", label: "Billed vs paid" },
  ] as const;

  // One merged series so the chart shows history AND the 90-day outlook.
  const chartData = [
    ...summary.history_6m.map((h) => ({
      month: h.month.slice(5),
      invoiced: h.invoiced,
      collected: h.collected,
      expenses: h.expenses,
      expected: null as number | null,
    })),
    ...summary.forecast_90d.map((f) => ({
      month: f.month.slice(5),
      invoiced: null as number | null,
      collected: null as number | null,
      expenses: null as number | null,
      expected: f.total_expected,
    })),
  ];

  // Cleared-rate headline for the in-progress month (history_6m ends with
  // the current calendar month; money landing now often pays older bills).
  // Cap at 100% so a good collection month doesn't read as a broken "800%".
  const lastMonth = summary.history_6m[summary.history_6m.length - 1];
  const clearRatePct =
    lastMonth && lastMonth.invoiced > 0
      ? Math.min(100, Math.round((lastMonth.collected / lastMonth.invoiced) * 100))
      : null;

  // Total actually late: sum of every past-due aging bucket, so the money
  // figure matches the "N invoices overdue" count (at_risk_total is 31+ only).
  const overdueTotal =
    summary.aging.days_1_15.amount +
    summary.aging.days_16_30.amount +
    summary.aging.days_31_plus.amount;

  const agingBars = [
    { key: "not_due_yet", label: "Not due yet", tone: "bg-info" },
    { key: "days_1_15", label: "1–15 days late", tone: "bg-warn" },
    { key: "days_16_30", label: "16–30 days late", tone: "bg-warn" },
    { key: "days_31_plus", label: "31+ days late", tone: "bg-danger" },
  ] as const;
  const agingMax = Math.max(1, ...Object.values(summary.aging).map((b) => b.amount));

  const reservePct = summary.vacation_reserve_progress_pct;
  const freshness = summary.bank_balance_updated_at
    ? `updated ${new Date(summary.bank_balance_updated_at).toLocaleDateString()}`
    : "not set yet";

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
            Pick a card below — each page shows one simple thing.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh(true)}
          disabled={loading}
          className="border-line text-fg w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <SubTabs tabs={tabs} value={subTab} onChange={finalize} />

      {/* ---------------- Today: the 3 big answers ------------- */}
      {subTab === "today" && (
        <div className="space-y-4">
          {summary.overdue_invoices.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
                <p className="text-sm text-fg">
                  <span className="font-semibold">{money(overdueTotal, currency)}</span>{" "}
                  is {summary.overdue_invoices.length} invoice{summary.overdue_invoices.length === 1 ? "" : "s"}{" "}
                  overdue — clients are late paying you.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => finalize("getting-paid")}
                className="bg-danger text-white hover:bg-danger/90 h-7 px-3 text-xs"
              >
                See who <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cash in bank with inline edit */}
            <Card className="bg-card border-line p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted text-xs font-semibold">
                  <Wallet className="w-4 h-4 text-accent" /> Cash in the bank
                </div>
                {!editingBank && (
                  <button
                    type="button"
                    onClick={startBankEdit}
                    className="text-muted hover:text-fg p-1 rounded"
                    title="Update your bank balance"
                    aria-label="Update bank balance"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {editingBank ? (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={bankInput}
                      onChange={(e) => setBankInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSaveBank();
                        if (e.key === "Escape") setEditingBank(false);
                      }}
                      autoFocus
                      className="w-full min-w-0 bg-bg border border-line rounded-lg px-2 py-1.5 text-sm font-mono text-fg focus:outline-none focus:border-accent"
                      placeholder="0"
                    />
                    <Button size="sm" onClick={() => void handleSaveBank()} disabled={savingBank} className="bg-accent text-accent-fg h-8 px-3 text-xs">
                      {savingBank ? "…" : "Save"}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted">Enter the amount from your bank app.</p>
                </div>
              ) : (
                <>
                  <p className="text-3xl font-bold text-fg mt-3">{money(summary.bank_balance, currency)}</p>
                  <p className="text-[11px] text-muted mt-1">{freshness}</p>
                </>
              )}
            </Card>

            {/* Coming in next 14 days */}
            <Card className="bg-card border-line p-5">
              <div className="flex items-center gap-2 text-muted text-xs font-semibold">
                <CalendarDays className="w-4 h-4 text-info" /> Coming in next 14 days
              </div>
              <p className="text-3xl font-bold text-info mt-3">{money(summary.expected_cash.days_14, currency)}</p>
              <p className="text-[11px] text-muted mt-1">from invoice due dates</p>
              <div className="mt-3 pt-3 border-t border-line flex justify-between text-xs">
                <span className="text-muted">Next 30 days</span>
                <span className="font-mono font-semibold text-fg">{money(summary.expected_cash.days_30, currency)}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-muted">Next 60 days</span>
                <span className="font-mono font-semibold text-fg">{money(summary.expected_cash.days_60, currency)}</span>
              </div>
            </Card>

            {/* Safe to spend */}
            <Card className="bg-card border-line p-5">
              <div className="flex items-center gap-2 text-muted text-xs font-semibold">
                <PiggyBank className="w-4 h-4 text-ok" /> Safe to spend
              </div>
              <p className="text-3xl font-bold text-ok mt-3">{money(summary.safe_to_spend_next_30d, currency)}</p>
              <p className="text-[11px] text-muted mt-1">
                money you can use in the next 30 days without hurting your runway
              </p>
              <button
                type="button"
                onClick={() => finalize("runway")}
                className="mt-3 text-xs font-semibold text-info hover:underline inline-flex items-center"
              >
                How long will my money last? <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </Card>
          </div>

          <Card className="bg-card border-line p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted min-w-0">
              <ShieldAlert className="w-4 h-4 text-danger shrink-0" />
              <span>
                Owed to you right now:{" "}
                <span className="font-mono font-bold text-fg">{money(summary.receivables_total, currency)}</span>
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={() => finalize("getting-paid")} className="border-line text-fg h-7 px-3 text-xs shrink-0">
              Open list <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Card>
        </div>
      )}

      {/* ---------------- Runway: gauge + savings ------------- */}
      {subTab === "runway" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <Card className="bg-card border-line p-5">
            <h3 className="font-display text-base font-bold text-fg mb-1">Financial runway</h3>
            <p className="text-[11px] text-muted mb-3">How many weeks you could survive with no new income.</p>
            <RunwayGauge summary={summary} />
          </Card>
          <Card className="bg-card border-line p-5 flex flex-col">
            <h3 className="font-display text-base font-bold text-fg mb-4">Safe to spend &amp; vacation reserve</h3>
            <div className="flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3">
              <PiggyBank className="w-5 h-5 text-ok shrink-0" />
              <div className="min-w-0">
                <p className="text-lg font-bold text-ok leading-tight">{money(summary.safe_to_spend_next_30d, currency)}</p>
                <p className="text-[11px] text-muted">safe to spend in the next 30 days</p>
              </div>
            </div>
            <div className="mt-4 flex-1">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-1.5 font-semibold text-muted">
                  <Palmtree className="w-3.5 h-3.5 text-info" /> Vacation reserve
                </span>
                <span className="font-mono text-fg">
                  {summary.vacation_reserve_target > 0
                    ? `${money(summary.bank_balance, currency)} / ${money(summary.vacation_reserve_target, currency)}`
                    : "—"}
                </span>
              </div>
              {reservePct === null ? (
                <p className="text-[11px] text-muted">
                  Goal = 3 months of average expenses. Log expenses to unlock the target.
                </p>
              ) : (
                <>
                  <div className="h-2 rounded-full bg-surface overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${reservePct >= 100 ? "bg-ok" : reservePct >= 50 ? "bg-info" : "bg-warn"}`}
                      style={{ width: `${Math.max(reservePct, 2)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted mt-1.5">
                    {reservePct >= 100
                      ? "Fully funded — take the trip guilt-free."
                      : `${reservePct}% of a 3-month burn reserve. Anything above this line is holiday money.`}
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted mt-4 pt-3 border-t border-line">
              <CalendarDays className="w-3.5 h-3.5 text-info" />
              Average time to get paid:{" "}
              <span className="font-mono font-semibold text-fg">
                {summary.avg_days_to_payment !== null ? `${summary.avg_days_to_payment} days` : "—"}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* ---------------- Getting paid: overdue action list ------------- */}
      {subTab === "getting-paid" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <Card className="bg-card border-line p-5">
            <h3 className="font-display text-base font-bold text-fg mb-1">Get paid now</h3>
            <p className="text-[11px] text-muted mb-4">Overdue invoices, oldest first. Tap &ldquo;Paid&rdquo; when money arrives.</p>
            {summary.overdue_invoices.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-ok bg-ok/5 border border-dashed border-ok/30 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4" />
                Nothing overdue. Great!
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
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

          <Card className="bg-card border-line p-5">
            <h3 className="font-display text-base font-bold text-fg mb-4">How late are payments?</h3>
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
        </div>
      )}

      {/* ---------------- Billed vs paid: the chart ------------- */}
      {subTab === "billed-paid" && (
        <Card className="bg-card border-line p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-base font-bold text-fg">Invoiced vs. real cash — and what&apos;s coming</h3>
              {clearRatePct !== null ? (
                <p className="text-[11px] text-muted mt-0.5">
                  This month so far: billed {money(lastMonth.invoiced, currency)}, landed {money(lastMonth.collected, currency)} ({clearRatePct}% of this month&apos;s bills)
                </p>
              ) : (
                <p className="text-[11px] text-muted mt-0.5">Light bars = what you billed. Solid bars = money that actually landed.</p>
              )}
            </div>
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
                <Bar dataKey="invoiced" name="Billed" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={28} opacity={0.25} />
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
      )}
    </div>
  );
}
