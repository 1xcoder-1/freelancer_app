"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Pencil,
  RefreshCw,
  TrendingUp,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/patterns";
import { LINK_TEMPLATES } from "@/components/link-page/template-constants";
import { getMyLinkPages, getLinkPageStats, type LinkPage, type LinkPageStats } from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { LinkPageStatsPanel } from "@/components/link-page/LinkPageStatsPanel";

/* Dashboard for one link tree — its live URL, 4 real-time headline cards,
   and windowed analytics panel. Header structure mirrors the client project detail page. */
export default function LinkTreeDashboard() {
  const params = useParams();
  const pageId = (params?.id as string) || "";

  const { data: pages, loading, refresh } = useApiData<LinkPage[]>(
    "linkpage:my",
    async (token) => getMyLinkPages(token),
    { reportContext: "link-page-tree", pollMs: 3_000, ttlMs: 0 }
  );

  // Real-time windowed analytics for this specific link page (recent 30 days)
  const { data: statsData, refresh: refreshStats } = useApiData<LinkPageStats | null>(
    `linkpage:stats:${pageId}:30`,
    async (token) => getLinkPageStats(pageId, 30, token).catch(() => null),
    { reportContext: "link-page-tree-stats", pollMs: 3_000, ttlMs: 0 }
  );

  const page = (pages ?? []).find((p) => p.id === pageId);

  const refreshTree = async (notify = true) => {
    invalidateCache("linkpage:my");
    invalidateCache(`linkpage:stats:${pageId}:30`);
    invalidateCache(`linkpage:stats:${pageId}:7`);
    invalidateCache(`linkpage:stats:${pageId}:90`);
    await Promise.all([refresh(true), refreshStats(true)]);
    if (notify) toast.success("Real-time stats refreshed");
  };

  // Instant real-time refresh whenever user switches back from viewing public page in another tab
  useEffect(() => {
    const handleSync = () => {
      invalidateCache("linkpage:my");
      invalidateCache(`linkpage:stats:${pageId}:30`);
      invalidateCache(`linkpage:stats:${pageId}:7`);
      invalidateCache(`linkpage:stats:${pageId}:90`);
      void refresh(false);
      void refreshStats(false);
    };
    window.addEventListener("focus", handleSync);
    window.addEventListener("visibilitychange", handleSync);
    return () => {
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("visibilitychange", handleSync);
    };
  }, [pageId, refresh, refreshStats]);

  const copyPublicUrl = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`);
      toast.success("Public link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  if (loading && !page) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <Skeleton className="h-[140px] w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <Skeleton className="h-[180px] w-full rounded-2xl" />
          <Skeleton className="h-[180px] w-full rounded-2xl" />
          <Skeleton className="h-[180px] w-full rounded-2xl" />
          <Skeleton className="h-[180px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="space-y-4 text-center py-16">
        <h1 className="font-display text-xl font-medium text-fg">This link page doesn&apos;t exist</h1>
        <p className="text-sm text-muted">It may have been deleted from another surface.</p>
        <Link
          href="/dashboard/link-page"
          className="text-sm font-medium text-accent hover:text-accent-hi transition-colors"
        >
          Back to your link pages
        </Link>
      </div>
    );
  }

  // 1. Unified Real-Time Views (merging page lifetime counter & event stream)
  const viewsFromPage = Number(page.views_count) || 0;
  const viewsFromStats = Number(statsData?.totals?.views) || 0;
  const totalViews = Math.max(viewsFromPage, viewsFromStats);

  // 2. Unified Real-Time Clicks (merging direct item click counters & event stream)
  const clicksFromItems = (page.items ?? []).reduce(
    (s, i) => s + (Number(i.clicks_count) || 0),
    0
  );
  const clicksFromStats = Number(statsData?.totals?.clicks) || 0;
  const clicksFromStatsItems = (statsData?.items ?? []).reduce(
    (sum, i) => sum + (Number(i.clicks) || 0),
    0
  );
  const totalClicks = Math.max(clicksFromItems, clicksFromStats, clicksFromStatsItems);

  // 3. Unified Real-Time CTR (rounded integer percentage)
  const rawCtr = totalViews > 0
    ? (totalClicks / totalViews) * 100
    : (Number(statsData?.totals?.ctr) || 0);
  const ctrInt = Math.round(rawCtr);

  // 4. Unified Active Links & Total Links
  const configuredActiveCount = (page.items ?? []).filter((i) => i.active !== false).length;
  const configuredTotalCount = (page.items ?? []).length;
  const statsItemsCount = (statsData?.items ?? []).length;
  const totalLinks = Math.max(configuredTotalCount, statsItemsCount);
  const activeItemsCount = configuredTotalCount > 0
    ? configuredActiveCount
    : statsItemsCount;

  // 5. Top Item by Clicks
  const topStatsItem = statsData?.items?.[0];
  const topConfiguredItem = [...(page.items ?? [])]
    .filter((i) => (Number(i.clicks_count) || 0) > 0)
    .sort((a, b) => (Number(b.clicks_count) || 0) - (Number(a.clicks_count) || 0))[0];
  const topItemLabel = topConfiguredItem?.label || topStatsItem?.label || null;
  const templateName = LINK_TEMPLATES.find((t) => t.key === page.template)?.name ?? page.template;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6 animate-in fade-in duration-300">
      {/* Top Header — Clean & To The Point */}
      <div className="space-y-3 pb-4 border-b border-line">
        <Link
          href="/dashboard/link-page"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to link pages</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg capitalize">
                {page.name || page.display_name}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                  page.published
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                    : "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25"
                }`}
              >
                {page.published ? "Live" : "Draft"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void copyPublicUrl(page.slug)}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-muted hover:text-accent transition-colors cursor-pointer"
              title="Copy public link"
            >
              <span>/p/{page.slug}</span>
              <Copy className="w-3 h-3 opacity-60" />
            </button>
          </div>

          {/* Action Buttons — Clean & To the point */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshTree()}
              className="text-xs rounded-xl h-9 w-9 p-0 border-line text-muted hover:text-fg hover:bg-surface cursor-pointer"
              title="Refresh stats"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Link href={`/dashboard/link-page/preview/${page.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="text-xs rounded-xl h-9 w-9 p-0 border-line text-muted hover:text-fg hover:bg-surface cursor-pointer transition-colors"
                title="Preview link page"
                aria-label="Preview link page"
              >
                <Eye className="w-3.5 h-3.5" />
              </Button>
            </Link>
            {page.published && (
              <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-xl h-9 px-3.5 border-line text-muted hover:text-fg hover:bg-surface cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open
                </Button>
              </a>
            )}
            <Link href={`/dashboard/link-page/edit/${page.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="text-xs rounded-xl h-9 px-3.5 border-line hover:border-line-strong bg-card hover:bg-surface text-fg font-medium cursor-pointer transition-all shadow-xs"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5 text-accent" />
                <span>Edit page</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* The 4 Stat Cards — Simple, Clean & Real-Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          label="Profile Views"
          value={totalViews.toLocaleString()}
          icon={Eye}
          rows={[
            {
              text: page.published ? "Page is live" : "Draft mode",
              dot: page.published ? "ok" : "warn",
            },
          ]}
        />

        <StatCard
          label="Link Clicks"
          value={totalClicks.toLocaleString()}
          icon={ArrowUpRight}
          subtext={topItemLabel ? `Top: "${topItemLabel}"` : undefined}
        />

        <StatCard
          label="Click Rate"
          value={`${ctrInt}%`}
          icon={TrendingUp}
          subtext={totalViews > 0 ? `${totalClicks} clicks / ${totalViews} views` : undefined}
        />

        <StatCard
          label="Active Links"
          value={activeItemsCount.toLocaleString()}
          icon={Globe}
        />
      </div>

      <LinkPageStatsPanel pageId={page.id} hideTotals={true} />
    </div>
  );
}
