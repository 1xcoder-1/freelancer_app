"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Eye, ArrowUpRight, TrendingUp } from "@/components/animated-icons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyLinkPageStats, type LinkPageStats } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";

const RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

const VIEWS_COLOR = "#10b981";
const CLICKS_COLOR = "#6366f1";

function fmtDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Live analytics for the workspace's Link Page, fed by the link_events
 * stream. Polls every 20s while mounted so numbers move in near real time.
 */
export function LinkPageStatsPanel({ compact = false }: { compact?: boolean }) {
  const [days, setDays] = useState(30);

  const { data: stats, loading, error } = useApiData<LinkPageStats | null>(
    `linkpage:stats:${days}`,
    async (token) => getMyLinkPageStats(days, token).catch(() => null)
  );

  const noPage = error !== null || (stats === null && !loading);

  return (
    <Card className="bg-card border-line p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">Link Page Analytics</h3>
          <p className="text-xs text-muted mt-0.5">
            Live views and clicks from your public page · refreshes automatically
          </p>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                days === r.days
                  ? "bg-accent text-accent-fg border-accent"
                  : "bg-surface/60 text-muted border-line hover:text-fg"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {noPage ? (
        <p className="text-xs text-faint py-6 text-center">
          Create and publish your link page to start collecting analytics.
        </p>
      ) : loading && !stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : stats ? (
        <>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-line bg-surface/50 p-3.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-faint">
                <Eye className="w-3.5 h-3.5" style={{ color: VIEWS_COLOR }} /> Views
              </div>
              <div className="text-2xl font-black text-fg mt-1">{stats.totals.views.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-line bg-surface/50 p-3.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-faint">
                <ArrowUpRight className="w-3.5 h-3.5" style={{ color: CLICKS_COLOR }} /> Clicks
              </div>
              <div className="text-2xl font-black text-fg mt-1">{stats.totals.clicks.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-line bg-surface/50 p-3.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-faint">
                <TrendingUp className="w-3.5 h-3.5 text-warn" /> CTR
              </div>
              <div className="text-2xl font-black text-fg mt-1">{stats.totals.ctr}%</div>
            </div>
          </div>

          {/* Daily series */}
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.daily} margin={{ top: 5, right: 5, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="lpViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VIEWS_COLOR} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={VIEWS_COLOR} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lpClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CLICKS_COLOR} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CLICKS_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDay}
                  tick={{ fontSize: 10, fill: "#888893" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis tick={{ fontSize: 10, fill: "#888893" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(l) => fmtDay(String(l))}
                  contentStyle={{
                    background: "#16161a",
                    border: "1px solid rgba(128,128,128,0.25)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                {!compact && <Legend wrapperStyle={{ fontSize: 11 }} />}
                <Area type="monotone" dataKey="views" name="Views" stroke={VIEWS_COLOR} strokeWidth={2} fill="url(#lpViews)" />
                <Area type="monotone" dataKey="clicks" name="Clicks" stroke={CLICKS_COLOR} strokeWidth={2} fill="url(#lpClicks)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className={compact ? "" : "grid grid-cols-1 lg:grid-cols-2 gap-5"}>
            {/* Per-item clicks */}
            {stats.items.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[10px] uppercase tracking-wider text-faint">Top links by clicks</div>
                {stats.items.slice(0, 6).map((row) => {
                  const pct = Math.round((row.clicks / (stats.items[0]?.clicks || 1)) * 100);
                  return (
                    <div key={row.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-fg truncate">{row.label}</span>
                        <span className="text-muted font-mono shrink-0">{row.clicks}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CLICKS_COLOR }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Referrers */}
            {stats.top_referrers.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[10px] uppercase tracking-wider text-faint">Where visitors come from</div>
                {stats.top_referrers.slice(0, 6).map((r) => (
                  <div key={r.referrer} className="flex items-center justify-between gap-3 text-xs border-b border-line/50 pb-1.5 last:border-0">
                    <span className="text-fg font-mono truncate">{r.referrer}</span>
                    <span className="text-muted font-mono shrink-0">{r.views} views</span>
                  </div>
                ))}
              </div>
            )}

            {stats.items.length === 0 && stats.top_referrers.length === 0 && (
              <p className="text-xs text-faint">No clicks recorded in this window yet — share your page to get started.</p>
            )}
          </div>
        </>
      ) : null}
    </Card>
  );
}
