"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Eye, ArrowUpRight, TrendingUp, Link2, Globe } from "@/components/animated-icons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLinkPageStats, getMyLinkPageStats, type LinkPageStats } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";

// Chart chunk loads async with a skeleton that matches its exact slot, so the
// page frame paints instantly and the graph never shifts the layout.
const LinkPageDailyChart = dynamic(() => import("./LinkPageDailyChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full rounded-xl" />,
});

const RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
] as const;

/**
 * Live analytics fed by the link_events stream — for one page (pageId set)
 * or aggregated across every page of the workspace.
 * Follows /impeccable operate guidelines: clean, minimal, zero filler copy,
 * high-contrast mono tabular numbers, and contained micro-visuals.
 */
export function LinkPageStatsPanel({
  compact = false,
  pageId,
  hideTotals = false,
}: {
  compact?: boolean;
  pageId?: string;
  hideTotals?: boolean;
}) {
  const [days, setDays] = useState<number>(30);

  const cacheKey = pageId ? `linkpage:stats:${pageId}:${days}` : `linkpage:stats:${days}`;
  const { data: stats, loading, error } = useApiData<LinkPageStats | null>(
    cacheKey,
    async (token) =>
      pageId
        ? getLinkPageStats(pageId, days, token).catch(() => null)
        : getMyLinkPageStats(days, token).catch(() => null),
    { reportContext: "link-page-stats", pollMs: 20_000 }
  );

  const noPage = error !== null || (stats === null && !loading);

  return (
    <Card className="bg-card border-line p-5 sm:p-6 space-y-5">
      {/* Header Bar: Clean title, visual legend indicators, and compact segmented range selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-line/40">
        <div className="flex items-center gap-3.5">
          <h3 className="text-sm font-semibold text-fg tracking-tight">Analytics</h3>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted font-medium select-none">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]" />
              Views
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted font-medium select-none">
              <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.35)]" />
              Clicks
            </span>
          </div>
        </div>

        {/* Segmented Range Selector */}
        <div className="inline-flex items-center p-0.5 rounded-lg bg-surface/60 border border-line/70 self-start sm:self-auto">
          {RANGES.map((r) => {
            const active = days === r.days;
            return (
              <button
                key={r.days}
                type="button"
                onClick={() => setDays(r.days)}
                className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all cursor-pointer select-none ${
                  active
                    ? "bg-card text-fg font-semibold shadow-xs border border-line/60"
                    : "text-muted hover:text-fg hover:bg-surface/50"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {noPage ? (
        <div className="py-10 text-center text-xs text-muted space-y-1">
          <p className="font-medium text-fg">No page analytics available</p>
          <p className="text-faint">Publish your link page to start receiving live visitor metrics.</p>
        </div>
      ) : loading && !stats ? (
        <div className="space-y-4">
          {!hideTotals && (
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          )}
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ) : stats ? (
        <>
          {/* Totals (rendered when not already presented by parent stat cards) */}
          {!hideTotals && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-line bg-surface/40 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Views</span>
                </div>
                <div className="text-xl font-mono font-semibold text-fg tabular-nums">
                  {stats.totals.views.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-line bg-surface/40 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                  <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Clicks</span>
                </div>
                <div className="text-xl font-mono font-semibold text-fg tabular-nums">
                  {stats.totals.clicks.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-line bg-surface/40 p-3.5 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  <span>CTR</span>
                </div>
                <div className="text-xl font-mono font-semibold text-fg tabular-nums">
                  {stats.totals.ctr}%
                </div>
              </div>
            </div>
          )}

          {/* Daily series area chart */}
          <LinkPageDailyChart daily={stats.daily} compact={compact} />

          {/* Bottom Breakdown Panels: Top Links & Traffic Sources */}
          <div className={compact ? "space-y-4 pt-1" : "grid grid-cols-1 md:grid-cols-2 gap-4 pt-1"}>
            {/* Top Links Panel */}
            <div className="rounded-xl border border-line/60 bg-surface/20 p-4 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-line/30">
                <div className="flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                  <h4 className="text-xs font-semibold text-fg">Top Links</h4>
                </div>
                <span className="text-[11px] font-mono text-muted">
                  {stats.items.length} {stats.items.length === 1 ? "link" : "links"}
                </span>
              </div>

              {stats.items.length > 0 ? (
                <div className="space-y-2">
                  {stats.items.slice(0, 5).map((row, idx) => {
                    const maxClicks = Math.max(...stats.items.map((i) => i.clicks), 1);
                    const pct = Math.max(6, Math.round((row.clicks / maxClicks) * 100));
                    return (
                      <div
                        key={row.id}
                        className="rounded-lg border border-line/40 bg-card/60 p-2.5 space-y-1.5 hover:border-line transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[10px] text-faint shrink-0 w-3.5 text-center">
                              {idx + 1}
                            </span>
                            <span className="text-fg font-medium truncate text-xs">
                              {row.label || "Untitled Link"}
                            </span>
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 tabular-nums">
                            {row.clicks.toLocaleString()} {row.clicks === 1 ? "click" : "clicks"}
                          </span>
                        </div>
                        {/* Micro-bar contained inside row */}
                        <div className="h-1 w-full rounded-full bg-surface overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-400/80 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted flex flex-col items-center justify-center gap-1.5">
                  <Link2 className="w-4 h-4 text-faint" />
                  <p className="text-faint">No link clicks recorded yet</p>
                </div>
              )}
            </div>

            {/* Traffic Sources / Referrers Panel */}
            <div className="rounded-xl border border-line/60 bg-surface/20 p-4 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-line/30">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <h4 className="text-xs font-semibold text-fg">Traffic Sources</h4>
                </div>
                <span className="text-[11px] font-mono text-muted">
                  {stats.top_referrers.length} {stats.top_referrers.length === 1 ? "source" : "sources"}
                </span>
              </div>

              {stats.top_referrers.length > 0 ? (
                <div className="space-y-2">
                  {stats.top_referrers.slice(0, 5).map((r, idx) => {
                    const maxViews = Math.max(...stats.top_referrers.map((i) => i.views), 1);
                    const pct = Math.max(6, Math.round((r.views / maxViews) * 100));
                    const isDirect = !r.referrer || r.referrer.toLowerCase() === "direct";
                    const displaySource = isDirect ? "Direct / Bookmarks" : r.referrer;

                    return (
                      <div
                        key={r.referrer || idx}
                        className="rounded-lg border border-line/40 bg-card/60 p-2.5 space-y-1.5 hover:border-line transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[10px] text-faint shrink-0 w-3.5 text-center">
                              {idx + 1}
                            </span>
                            <span className="text-fg font-medium truncate text-xs">
                              {displaySource}
                            </span>
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tabular-nums">
                            {r.views.toLocaleString()} {r.views === 1 ? "view" : "views"}
                          </span>
                        </div>
                        {/* Micro-bar contained inside row */}
                        <div className="h-1 w-full rounded-full bg-surface overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500/80 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted flex flex-col items-center justify-center gap-1.5">
                  <Globe className="w-4 h-4 text-faint" />
                  <p className="text-faint">No traffic sources recorded yet</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </Card>
  );
}
