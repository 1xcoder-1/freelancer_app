"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  ArrowUpRight,
  ExternalLink,
  Eye,
  Globe,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";
import { StatCard } from "@/components/dashboard/patterns";
import {
  createLinkPagePreviewToken,
  deleteLinkPage,
  getMyLinkPages,
  getMyLinkPageStats,
  type LinkPage,
  type LinkPageStats,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { LINK_TEMPLATES } from "@/components/link-page/template-constants";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { logHandledError } from "@/lib/log-error";

const MAX_PAGES = 3;

/* Overview — real-time headline metric cards at the top, action buttons below them,
   followed by the link tree roster cards (max 3). */
export default function LinkPageOverview() {
  const { getToken } = useAuth();
  const router = useRouter();

  // 30s polling keeps aggregate analytics fresh; switching back to the tab
  // triggers an instant refresh via the focus listener below.
  const { data: pages, loading, refresh } = useApiData<LinkPage[]>(
    "linkpage:my",
    async (token) => getMyLinkPages(token),
    { reportContext: "link-page-overview", pollMs: 30_000 }
  );

  // Real-time aggregate analytics for recent 30 days
  const { data: statsData, refresh: refreshStats } = useApiData<LinkPageStats | null>(
    "linkpage:my:stats:30",
    async (token) => getMyLinkPageStats(30, token).catch(() => null),
    { reportContext: "link-page-overview-stats", pollMs: 30_000 }
  );

  const list = pages ?? [];
  const atLimit = list.length >= MAX_PAGES;

  // 1. Calculate per-page live metrics (unifying direct item counters & event stream breakdown)
  const aggregateViews = Number(statsData?.totals?.views) || 0;
  const aggregateClicks = Math.max(
    Number(statsData?.totals?.clicks) || 0,
    (statsData?.items ?? []).reduce((sum, i) => sum + (Number(i.clicks) || 0), 0)
  );

  const pageMetrics = list.map((page) => {
    const cardClicksFromStats = (statsData?.items ?? [])
      .filter((si) => page.items.some((pi) => pi.id === si.id || pi.label === si.label))
      .reduce((sum, si) => sum + (Number(si.clicks) || 0), 0);
    const cardClicksFromItems = page.items.reduce(
      (s, i) => s + (Number(i.clicks_count) || 0),
      0
    );
    const cardClicks = Math.max(cardClicksFromItems, cardClicksFromStats);

    const cardViews = Math.max(
      Number(page.views_count) || 0,
      list.length === 1 ? aggregateViews : 0
    );

    return { page, cardViews, cardClicks };
  });

  // 2. Real-time aggregated totals across all link pages (always 100% in sync with the cards below)
  const totalViews = Math.max(
    pageMetrics.reduce((sum, m) => sum + m.cardViews, 0),
    aggregateViews,
    list.reduce((sum, p) => sum + (Number(p.views_count) || 0), 0)
  );

  const totalClicks = Math.max(
    pageMetrics.reduce((sum, m) => sum + m.cardClicks, 0),
    aggregateClicks,
    list.reduce((sum, p) => sum + (p.items || []).reduce((s, i) => s + (Number(i.clicks_count) || 0), 0), 0)
  );

  // Integer percentage (no decimal point) e.g. 0%, 20%, 40%
  const rawCtr = totalViews > 0 ? (totalClicks / totalViews) * 100 : (Number(statsData?.totals?.ctr) || 0);
  const ctrInt = Math.round(rawCtr);
  const livePages = list.filter((p) => p.published).length;

  const refreshAll = async (notify = false) => {
    invalidateCache("linkpage:my");
    invalidateCache("linkpage:my:stats:30");
    invalidateCache("linkpage:stats:30");
    await Promise.all([refresh(true), refreshStats(true)]);
    if (notify) toast.success("Real-time data refreshed");
  };

  // Live preview opens at the same public URL as the published page
  // (/p/{slug}?preview={token}) in a new tab, fed by the editor's WS stream.
  const openPreview = async (page: LinkPage) => {
    const previewTab = window.open("", "_blank");
    try {
      const { token } = await createLinkPagePreviewToken(page.id, (await getToken()) || undefined);
      if (previewTab) {
        previewTab.location.href = `/p/${page.slug}?preview=${encodeURIComponent(token)}`;
      } else {
        toast.error("Please allow pop-ups for this site to open the preview.");
      }
    } catch (e) {
      logHandledError("Preview launch failed:", e);
      previewTab?.close();
      toast.error("Could not open the preview. Please try again.");
    }
  };

  // Instant real-time refresh whenever user switches back from viewing public page in another tab
  useEffect(() => {
    const handleSync = () => {
      invalidateCache("linkpage:my");
      invalidateCache("linkpage:my:stats:30");
      invalidateCache("linkpage:stats:30");
      void refresh(false);
      void refreshStats(false);
    };
    window.addEventListener("focus", handleSync);
    window.addEventListener("visibilitychange", handleSync);
    return () => {
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("visibilitychange", handleSync);
    };
  }, [refresh, refreshStats]);

  const removeTree = async (page: LinkPage) => {
    const ok = await confirmDialog({
      title: "Delete link page",
      message: `"${page.name}" and its ${page.items.length} link${page.items.length === 1 ? "" : "s"} go offline immediately at /p/${page.slug}. Its analytics history is removed too.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteLinkPage(page.id, token);
      invalidateCache("linkpage:my");
      invalidateCache("linkpage:my:stats:30");
      invalidateCache("linkpage:stats:30");
      toast.success("Link page deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the link page");
    }
  };

  return (
    <div className="space-y-6 enter-stagger animate-in fade-in duration-300">

      {/* 4 Compact Metric Cards — Top Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {loading && list.length === 0 ? (
          <>
            <Skeleton className="h-[145px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[145px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[145px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[145px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
          </>
        ) : (
          <>
            {/* Card 1: Total Views */}
            <StatCard
              label="Total Views"
              value={totalViews.toLocaleString()}
              icon={Eye}
              className="min-h-[145px] p-5"
              rows={[
                {
                  text: livePages > 0 ? `${livePages} live page${livePages === 1 ? "" : "s"}` : "No live pages",
                  dot: livePages > 0 ? "ok" : "warn",
                },
              ]}
            />

            {/* Card 2: Total Clicks */}
            <StatCard
              label="Total Clicks"
              value={totalClicks.toLocaleString()}
              icon={ArrowUpRight}
              className="min-h-[145px] p-5"
              rows={[
                {
                  text: `${totalClicks} link clicks`,
                  dot: totalClicks > 0 ? "ok" : "info",
                },
              ]}
            />

            {/* Card 3: Click Rate (CTR) */}
            <StatCard
              label="Click Rate (CTR)"
              value={`${ctrInt}%`}
              icon={TrendingUp}
              className="min-h-[145px] p-5"
              rows={[
                {
                  text: `${ctrInt}% CTR`,
                  dot: ctrInt > 0 ? "ok" : "info",
                },
              ]}
            />

            {/* Card 4: Link Pages Quota */}
            <StatCard
              label="Link Pages"
              value={`${list.length} of ${MAX_PAGES}`}
              icon={Globe}
              className="min-h-[145px] p-5"
              rows={[
                {
                  text: atLimit ? "Maximum quota used" : `${MAX_PAGES - list.length} slot${MAX_PAGES - list.length === 1 ? "" : "s"} left`,
                  dot: atLimit ? "warn" : "ok",
                },
              ]}
            />

          </>
        )}
      </div>

      {/* Roster Section Header with Action Buttons in the same row */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <h2 className="text-sm font-medium text-fg">Your link pages</h2>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshAll(true)}
            disabled={loading}
            className="rounded-xl bg-card border-line text-fg w-8 h-8 p-0 flex items-center justify-center shrink-0 hover:bg-surface"
            title="Refresh stats"
            aria-label="Refresh stats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Link
            href="/dashboard/link-page/new"
            aria-disabled={atLimit}
            title={atLimit ? "Limit of 3 reached — delete one to add another" : "Create a link page"}
          >
            <Button
              size="sm"
              disabled={atLimit}
              className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New page
            </Button>
          </Link>
        </div>
      </div>

      {/* If no pages exist yet, show the onboarding prompt */}
      {!loading && list.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-line bg-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
            <Globe className="w-7 h-7 text-accent" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            No link pages yet
          </h2>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">
            Pick a handle, choose one of six designs and drop in your links —
            publishing puts it live at /p/your-handle instantly.
          </p>
          <Link href="/dashboard/link-page/new" className="mt-6 inline-flex">
            <Button size="sm" className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New page
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          {/* The trees — roster-style cards, click one to open its dashboard */}
          <div className="space-y-3 mt-2.5">

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6 stagger-grid">
              {loading && list.length === 0
                ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-[210px] w-full rounded-2xl" />)
                : list.map((page) => {
                  const templateName = LINK_TEMPLATES.find((t) => t.key === page.template)?.name ?? page.template;
                  return (
                    <CategoryVisualCard
                      key={page.id}
                      title={page.name || page.display_name}
                      subtitle={page.display_name || "Profile"}
                      onClick={() => router.push(`/dashboard/link-page/${page.id}`)}
                      icon={<Link2 className="w-4 h-4 text-accent" />}
                      topRightContent={
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <span
                            className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border capitalize ${page.published
                                ? "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/25"
                                : "bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/25"
                              }`}
                          >
                            {page.published ? "Live" : "Draft"}
                          </span>
                          <button
                            type="button"
                            onClick={() => void openPreview(page)}
                            className="w-7 h-7 rounded-lg border border-line bg-surface/60 dark:bg-white/5 flex items-center justify-center text-muted hover:text-fg hover:border-line-strong transition-colors cursor-pointer"
                            title="Preview link page in new tab"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {page.published && (
                            <a
                              href={`/p/${page.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-7 h-7 rounded-lg border border-line bg-surface/60 dark:bg-white/5 flex items-center justify-center text-muted hover:text-fg hover:border-line-strong transition-colors cursor-pointer"
                              title="Open live page"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => void removeTree(page)}
                            className="w-7 h-7 rounded-lg border border-line bg-surface/60 dark:bg-white/5 flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 hover:border-danger/30 transition-colors cursor-pointer"
                            title="Delete link page"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      }
                      tags={
                        <div className="flex flex-wrap items-center gap-1.5 pt-2">
                          <span className="text-[11px] font-mono font-medium text-orange-700 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/20 dark:border-orange-500/25">
                            {templateName}
                          </span>
                        </div>
                      }
                    />
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
