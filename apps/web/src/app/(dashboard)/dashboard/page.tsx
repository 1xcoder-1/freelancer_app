"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser, useAuth } from "@clerk/nextjs";
import {
  Clock,
  DollarSign,
  Receipt,
  Plus,
  FolderKanban,
  RefreshCw,
  SquareStack,
  LayoutGrid,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatCard, StatChip } from "@/components/dashboard/patterns";
import { getDashboardStats, getDashboardOverview, type DashboardStats, type DashboardOverview } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";

type TabKey = "projects" | "invoices" | "time";

export default function DashboardPage() {
  const { user } = useUser();
  const [tab, setTab] = useState<TabKey>("projects");

  const { data: dashboardData, loading, refresh: loadData } = useApiData(
    "dashboard:data",
    async (token) => {
      const [statsRes, overviewRes] = await Promise.all([
        getDashboardStats(token).catch(() => null),
        getDashboardOverview(token).catch(() => null),
      ]);
      return { stats: statsRes, overview: overviewRes };
    },
    { reportContext: "dashboard" }
  );

  const stats = dashboardData?.stats ?? null;
  const overview = dashboardData?.overview ?? null;

  const usd = (n: number | undefined) =>
    `$${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "projects", label: "Active Projects", count: overview?.recent_projects?.length || 0 },
    { key: "invoices", label: "Recent Invoices", count: overview?.recent_invoices?.length || 0 },
    { key: "time", label: "Time Entries", count: overview?.recent_time_entries?.length || 0 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your clients, projects and upcoming deadlines."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={loading}
              className="rounded-lg bg-card border-line text-fg"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link href="/dashboard/invoices">
              <Button size="sm" className="rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm">
                <Plus className="w-3.5 h-3.5 mr-1" />
                New Invoice
              </Button>
            </Link>
          </>
        }
      />

      {/* Big-number stat cards (reference style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </>
        ) : (
          <>
            <StatCard
              label="Paid Revenue"
              value={usd(stats?.monthly_revenue)}
              icon={DollarSign}
              rows={[
                { text: `${stats?.pending_invoices_count || 0} unpaid`, dot: "ok" },
                { text: `$${stats?.effective_hourly_rate || 0}/hr effective`, dot: "warn" },
              ]}
            />
            <StatCard
              label="Pending Invoices"
              value={usd(stats?.pending_invoices_amount)}
              icon={Receipt}
              rows={[
                { text: `${stats?.pending_invoices_count || 0} Total`, dot: "ok" },
                { text: "Awaiting payment", dot: "danger" },
              ]}
            />
            <StatCard
              label="Projects"
              value={stats?.active_projects_count || 0}
              icon={LayoutGrid}
              rows={[
                { text: `${stats?.active_projects_count || 0} Active`, dot: "ok" },
                { text: `${stats?.active_clients_count || 0} Clients`, dot: "danger" },
              ]}
            />
            <StatCard
              label="Tracked Hours"
              value={`${stats?.billable_hours_this_month || 0}h`}
              icon={SquareStack}
              rows={[
                { text: "This month", dot: "ok" },
                { text: "Billable", dot: "warn" },
              ]}
            />
          </>
        )}
      </div>

      {/* Tinted pill chips row (reference style) */}
      {!loading && (
        <div className="flex items-center flex-wrap gap-2.5">
          <StatChip tone="ok">{usd(stats?.monthly_revenue)} Earned</StatChip>
          <StatChip tone="info">{stats?.active_clients_count || 0} Active Clients</StatChip>
          <StatChip tone="danger">{usd(stats?.pending_invoices_amount)} Outstanding</StatChip>
          <StatChip tone="violet">{stats?.billable_hours_this_month || 0}h Billable This Month</StatChip>
          <StatChip tone="accent">${stats?.effective_hourly_rate || 0}/hr Effective Rate</StatChip>
        </div>
      )}

      {/* Underline tabs + content (reference style) */}
      <div>
        <div className="flex items-center gap-6 border-b border-line mb-5 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`py-3 px-1 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
                tab === t.key
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {tab === "projects" && (
          loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
          ) : overview?.recent_projects && overview.recent_projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overview.recent_projects.map((proj) => (
                <div
                  key={proj.id}
                  className="bg-card border border-line rounded-xl p-5 hover:border-accent/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <StatChip tone={proj.status === "completed" ? "ok" : "accent"} className="text-[10px]">
                      {proj.status}
                    </StatChip>
                    <span className="text-xs text-muted font-mono">${proj.budget}</span>
                  </div>
                  <h4 className="text-[15px] font-semibold text-fg">{proj.title}</h4>
                  <p className="text-xs text-muted mt-0.5 mb-3">{proj.client_name}</p>
                  <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                    <div className="bg-accent h-full rounded-full" style={{ width: `${proj.progress_pct}%` }} />
                  </div>
                  <div className="text-[11px] text-faint font-mono mt-1.5">{proj.progress_pct}% complete</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FolderKanban}
              title="No Projects Found"
              desc="Create your first client project to organize tasks, track billable hours, and send invoices."
              ctaLabel="Create First Project"
              ctaHref="/dashboard/projects"
            />
          )
        )}

        {tab === "invoices" && (
          loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : overview?.recent_invoices && overview.recent_invoices.length > 0 ? (
            <div className="rounded-xl border border-line bg-card divide-y divide-line overflow-hidden">
              {overview.recent_invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-4 hover:bg-surface/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-accent-soft dark:bg-accent/15 text-accent">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-fg">{inv.number}</h4>
                      <p className="text-xs text-muted">{inv.client} • {inv.issue_date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-fg font-mono">${inv.amount.toFixed(2)}</div>
                    <span
                      className={`text-[10px] font-mono font-semibold ${
                        inv.status === "paid" ? "text-ok" : inv.status === "overdue" ? "text-danger" : "text-warn"
                      }`}
                    >
                      {inv.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Receipt}
              title="No Invoices Created Yet"
              desc="Generate professional itemized invoices and get paid via Stripe or local wallets in minutes."
              ctaLabel="Create First Invoice"
              ctaHref="/dashboard/invoices"
            />
          )
        )}

        {tab === "time" && (
          loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : overview?.recent_time_entries && overview.recent_time_entries.length > 0 ? (
            <div className="rounded-xl border border-line bg-card divide-y divide-line overflow-hidden">
              {overview.recent_time_entries.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-muted" />
                    <div>
                      <h4 className="text-sm font-semibold text-fg">{t.task}</h4>
                      <p className="text-xs text-muted">{t.project} • {t.date}</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm text-fg font-semibold">{t.duration}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Clock}
              title="No Time Tracked Today"
              desc="Track billable hours with 1 click to automatically convert project time into paid invoices."
              ctaLabel="Go to Time Tracker"
              ctaHref="/dashboard/time-tracker"
            />
          )
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  desc,
  ctaLabel,
  ctaHref,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="bg-card border border-dashed border-line-strong rounded-xl p-10 text-center">
      <Icon className="w-9 h-9 text-faint mx-auto mb-3" />
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      <p className="text-xs text-muted mt-1 max-w-sm mx-auto leading-relaxed">{desc}</p>
      <Link href={ctaHref} className="inline-block mt-5">
        <Button size="sm" className="rounded-lg bg-accent hover:bg-accent-hi text-accent-fg">
          <Plus className="w-4 h-4 mr-1.5" />
          {ctaLabel}
        </Button>
      </Link>
    </div>
  );
}
