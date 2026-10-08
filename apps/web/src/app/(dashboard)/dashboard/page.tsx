"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useUser, useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  DollarSign,
  Receipt,
  Plus,
  Calendar,
  RefreshCw,
  LayoutGrid,
  CalendarDays,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
} from "@/components/animated-icons";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard, StatChip } from "@/components/dashboard/patterns";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import {
  getDashboardStats,
  getDashboardOverview,
  getActiveTimer,
  getCalendarEvents,
  getExpenses,
  getLeads,
  getIntakeForms,
  getContracts,
  getBookings,
  getBookingAppointments,
  type TimerSession,
  type CalendarFeedItem,
} from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";

/* ------------------------------------------------------------------
   Home is deliberately simple: a greeting, the four numbers every
   freelancer cares about, a row of small coloured context cards,
   and one tabbed list (Today / My Projects / Recent Invoices /
   Time). The main cards carry the headline; the small cards carry
   the supporting metrics — nothing shows twice.
------------------------------------------------------------------- */

type TabKey = "today" | "projects" | "invoices" | "time";

export default function DashboardPage() {
  const { user } = useUser();
  const [tab, setTab] = useState<TabKey>("today");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { data: dashboardData, loading, error, refresh: loadData } = useApiData(
    "dashboard:data",
    async (token) => {
      // Primary data + supporting metrics for headline cards & capsule chips
      const [
        statsRes,
        overviewRes,
        expensesRes,
        leadsRes,
        intakeRes,
        contractsRes,
        bookingsRes,
        appointmentsRes,
      ] = await Promise.all([
        getDashboardStats(token),
        getDashboardOverview(token),
        getExpenses(token).catch(() => []),
        getLeads(token).catch(() => []),
        getIntakeForms(token).catch(() => []),
        getContracts(undefined, token).catch(() => []),
        getBookings(token).catch(() => []),
        getBookingAppointments(undefined, token).catch(() => []),
      ]);
      return {
        stats: statsRes,
        overview: overviewRes,
        expenses: expensesRes,
        leads: leadsRes,
        intakeForms: intakeRes,
        contracts: contractsRes,
        bookings: bookingsRes,
        appointments: appointmentsRes,
      };
    },
    { reportContext: "dashboard" }
  );

  const stats = dashboardData?.stats ?? null;
  const overview = dashboardData?.overview ?? null;
  const expenses = dashboardData?.expenses ?? [];
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const recurringExpenses = expenses.filter((e) => e.is_recurring).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const expensesCount = expenses.length;

  const leads = dashboardData?.leads ?? [];
  const pendingLeadsCount = leads.filter((l) => l.stage !== "won" && l.stage !== "lost").length;

  const intakeForms = dashboardData?.intakeForms ?? [];
  const pendingIntakeCount = intakeForms.length;

  const contracts = dashboardData?.contracts ?? [];
  const waitingContractsCount = contracts.filter(
    (c) => c.status === "sent" || c.status === "viewed" || c.status === "draft" || c.status === "signed"
  ).length;

  const appointments = dashboardData?.appointments ?? [];
  const pendingBookingsCount = appointments.length > 0
    ? appointments.filter((a) => a.status !== "completed" && a.status !== "cancelled").length
    : (dashboardData?.bookings?.length ?? 0);

  // Today's schedule — same feed the calendar uses, window = today only.
  const { data: todayEvents, loading: todayLoading } = useApiData<CalendarFeedItem[]>(
    "dashboard:today",
    async (token) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return getCalendarEvents(start.toISOString(), end.toISOString(), token);
    },
    { reportContext: "dashboard-today" }
  );

  const firstName = (user?.firstName || user?.fullName || "").trim();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const usd = (n: number | undefined) =>
    `$${Math.round(n ?? 0).toLocaleString("en-US")}`;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "projects", label: "My Projects" },
    { key: "invoices", label: "Recent Invoices" },
    { key: "time", label: "Time Entries" },
  ];

  return (
    <div className="space-y-6 enter-stagger">
      {/* Greeting + one-line summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg" suppressHydrationWarning>
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-muted text-sm mt-1" suppressHydrationWarning>{todayLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading}
            className="rounded-xl bg-card border-line text-fg w-9 h-9 p-0 flex items-center justify-center shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            onClick={() => setCalendarOpen(true)}
            className="rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            <CalendarDays className="w-3.5 h-3.5 mr-1" />
            Calendar
          </Button>
        </div>
      </div>

      {/* Data unreachable: show a retry strip instead of silent zeros. */}
      {!loading && error && !dashboardData && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-warn min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {(error as { status?: number }).status === 401
                ? "Session expired — click Retry to sign in again."
                : `Couldn't reach the server — ${error.message}`}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            className="rounded-lg bg-surface border-line text-fg shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* The 4 Headline Cards — Reference Design with App Domain Content */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {loading || (!dashboardData && error) ? (
          <>
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
          </>
        ) : (
          <>
            <StatCard
              label="Earned"
              value={usd(stats?.monthly_revenue)}
              icon={DollarSign}
              rows={[
                {
                  text: stats?.revenue_growth_pct != null
                    ? `${stats.revenue_growth_pct >= 0 ? "+" : ""}${Math.round(stats.revenue_growth_pct)}% vs last month`
                    : "Cleared this month",
                  dot: "ok",
                },
                { text: `${usd(stats?.pending_invoices_amount)} Pending`, dot: "danger" },
              ]}
            />
            <StatCard
              label="Expenses"
              value={usd(totalExpenses)}
              icon={TrendingDown}
              rows={[
                { text: `${expensesCount} Recorded`, dot: "ok" },
                { text: `${usd(recurringExpenses)} Recurring`, dot: "danger" },
              ]}
            />
            <StatCard
              label="Projects"
              value={stats?.active_projects_count ?? 0}
              icon={LayoutGrid}
              rows={[
                { text: `${stats?.active_projects_count ?? 0} Total`, dot: "ok" },
                { text: `${stats?.active_projects_count ?? 0} In Progress`, dot: "danger" },
              ]}
            />
            <StatCard
              label="Active Clients"
              value={stats?.active_clients_count ?? 0}
              icon={Users}
              rows={[
                { text: `${stats?.active_clients_count ?? 0} Retainers`, check: true },
                { text: `${stats?.active_clients_count ?? 0} Ongoing`, dot: "danger" },
              ]}
            />
          </>
        )}
      </div>

      {/* The Capsule Rating & Context Badges — Reference Design with App Domain Content */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 pt-1">
        <StatChip tone="green">
          <span className="font-semibold">{String(stats?.pending_invoices_count || 0)}</span>
          <span>Invoices waiting</span>
        </StatChip>
        <StatChip tone="blue">
          <span className="font-semibold">{String(pendingLeadsCount)}</span>
          <span>Pending leads</span>
        </StatChip>
        <StatChip tone="purple">
          <span className="font-semibold">{String(pendingIntakeCount)}</span>
          <span>Pending intake forms</span>
        </StatChip>
        <StatChip tone="red">
          <span className="font-semibold">{String(waitingContractsCount)}</span>
          <span>Contracts waiting</span>
        </StatChip>
        <StatChip tone="violet">
          <span className="font-semibold">{String(pendingBookingsCount)}</span>
          <span>Pending bookings</span>
        </StatChip>
      </div>

      {/* One small tabbed area — pick a label, see a short list */}
      <div className="bg-card border border-line rounded-xl p-5">
        <div className="flex items-center gap-5 border-b border-line mb-4 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`py-2.5 px-1 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
                tab === t.key
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
        {tab === "today" && (
          todayLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : todayEvents && todayEvents.length > 0 ? (
            <div className="divide-y divide-line">
              {todayEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-xs font-mono text-muted w-16 shrink-0">
                    {new Date(ev.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    ev.event_type === "deadline" ? "bg-danger"
                      : ev.event_type === "meeting" ? "bg-info"
                      : ev.event_type === "client_work" ? "bg-accent" : "bg-faint"
                  }`} />
                  <span className="text-sm text-fg truncate">{ev.title}</span>
                  <span className="text-[10px] uppercase tracking-wide text-faint ml-auto shrink-0">{ev.event_type.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          ) : (
            <SimpleEmpty
              icon={Calendar}
              title="Nothing scheduled today"
              desc="Add a meeting or deadline in the calendar to see it here."
              action={
                <Button size="sm" variant="outline" onClick={() => setCalendarOpen(true)} className="rounded-lg border-line text-fg mt-4">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Open Calendar
                </Button>
              }
            />
          )
        )}

        {tab === "projects" && (
          loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : overview?.recent_projects && overview.recent_projects.length > 0 ? (
            <div className="divide-y divide-line">
              {overview.recent_projects.slice(0, 4).map((proj) => (
                <Link
                  key={proj.id}
                  href="/dashboard/projects"
                  className="flex items-center gap-4 py-3 hover:bg-surface/60 rounded-lg transition-colors px-2 -mx-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-fg truncate">{proj.title}</p>
                    <p className="text-xs text-muted">{proj.client_name}</p>
                  </div>
                  <div className="w-28 shrink-0 hidden sm:block">
                    <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                      <div className="bg-accent h-full rounded-full" style={{ width: `${proj.progress_pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-muted font-mono w-12 text-right">{proj.progress_pct}%</span>
                  <ChevronRight className="w-4 h-4 text-faint shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <SimpleEmpty
              icon={LayoutGrid}
              title="No projects yet"
              desc="Create your first project to organize tasks and track time."
              action={
                <Link href="/dashboard/projects" className="inline-block mt-4">
                  <Button size="sm" className="rounded-lg bg-accent hover:bg-accent-hi text-accent-fg">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Create Project
                  </Button>
                </Link>
              }
            />
          )
        )}

        {tab === "invoices" && (
          loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : overview?.recent_invoices && overview.recent_invoices.length > 0 ? (
            <div className="divide-y divide-line">
              {overview.recent_invoices.slice(0, 4).map((inv) => (
                <Link
                  key={inv.id}
                  href="/dashboard/projects?tab=invoices"
                  className="flex items-center gap-4 py-3 hover:bg-surface/60 rounded-lg transition-colors px-2 -mx-2"
                >
                  <div className="p-2 rounded-full bg-accent-soft text-accent shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-fg truncate">{inv.number}</p>
                    <p className="text-xs text-muted">{inv.client} • {inv.issue_date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-fg font-mono">${inv.amount.toFixed(2)}</p>
                    <span
                      className={`text-[10px] font-mono font-semibold ${
                        inv.status === "paid" ? "text-ok" : inv.status === "overdue" ? "text-danger" : "text-warn"
                      }`}
                    >
                      {inv.status.toUpperCase()}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-faint shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <SimpleEmpty
              icon={Receipt}
              title="No invoices yet"
              desc="Invoices now live inside Projects — create one and send it in minutes."
              action={
                <Link href="/dashboard/projects?tab=invoices" className="inline-block mt-4">
                  <Button size="sm" className="rounded-lg bg-accent hover:bg-accent-hi text-accent-fg">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Create Invoice
                  </Button>
                </Link>
              }
            />
          )
        )}

        {tab === "time" && (
          loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-lg" />
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <LiveFocusWidget />
              {overview?.recent_time_entries && overview.recent_time_entries.length > 0 ? (
                <div className="divide-y divide-line">
                  {overview.recent_time_entries.slice(0, 4).map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-fg truncate">{t.task}</p>
                        <p className="text-xs text-muted">{t.project} • {t.date}</p>
                      </div>
                      <span className="font-mono text-sm text-fg font-semibold shrink-0 ml-3">{t.duration}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-faint text-center py-4">
                  No time tracked yet.{" "}
                  <Link href="/dashboard/time-tracker" className="text-accent font-semibold hover:underline">
                    Start the timer
                  </Link>
                </p>
              )}
            </div>
          )
        )}
        </motion.div>
        </AnimatePresence>
      </div>

      {/* Live dashboard calendar: meetings, client work, deadlines + optional Google Calendar sync */}
      <DashboardCalendar open={calendarOpen} onClose={() => setCalendarOpen(false)} />
    </div>
  );
}

function SimpleEmpty({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-8 text-center">
      <Icon className="w-8 h-8 text-faint mx-auto mb-3" />
      <h3 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">{title}</h3>
      <p className="text-xs text-muted mt-1 max-w-sm mx-auto leading-relaxed">{desc}</p>
      {action}
    </div>
  );
}

/* Filled-tone context card used under the four headline numbers */
const smallTones: Record<string, { bg: string; text: string }> = {
  ok: { bg: "bg-ok/10 border-ok/20", text: "text-ok" },
  warn: { bg: "bg-warn/10 border-warn/20", text: "text-warn" },
  danger: { bg: "bg-danger/10 border-danger/20", text: "text-danger" },
  info: { bg: "bg-info/10 border-info/20", text: "text-info" },
  violet: { bg: "bg-violet/10 border-violet/20", text: "text-violet" },
  accent: { bg: "bg-accent/10 border-accent/20", text: "text-accent" },
};

function SmallStatCard({
  tone = "info",
  label,
  value,
  sub,
}: {
  tone?: keyof typeof smallTones | string;
  label: string;
  value: string;
  sub?: string;
}) {
  const t = smallTones[tone] ?? smallTones.info;
  return (
    <div className={`rounded-2xl border ${t.bg} p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between min-h-[110px]`}>
      <p className={`text-[11px] sm:text-[12px] font-mono font-semibold uppercase tracking-wider ${t.text} truncate`}>
        {label}
      </p>
      <div className="my-1">
        <p className="font-display text-[22px] sm:text-[24px] font-medium tracking-wide text-fg leading-none truncate">
          {value}
        </p>
      </div>
      {sub && <p className="text-xs text-muted truncate">{sub}</p>}
    </div>
  );
}

function LiveFocusWidget() {
  const { getToken } = useAuth();
  const [session, setSession] = useState<TimerSession | null>(null);
  const [drift, setDrift] = useState(0);

  const pull = useCallback(async () => {
    try {
      const token = (await getToken()) || undefined;
      const s = await getActiveTimer(token);
      setSession(s);
      setDrift(0);
    } catch {
      // A poll failure shouldn't blank the widget; keep the last known state.
    }
  }, [getToken]);

  // Restore on mount and periodically re-sync against the server clock.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const token = (await getToken()) || undefined;
      try {
        const s = await getActiveTimer(token);
        if (mounted) {
          setSession(s);
          setDrift(0);
        }
      } catch {
        // ignore; the interval will retry
      }
    })();
    const id = setInterval(() => void pull(), 15000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [pull, getToken]);

  // Smooth local ticking while a run is active.
  useEffect(() => {
    if (!session?.is_running) return;
    const id = setInterval(() => setDrift((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [session?.is_running]);

  if (!session) return null;

  const total = session.elapsed_seconds + (session.is_running ? drift : 0);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const fmt = `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

  return (
    <div className="bg-surface border border-line rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${session.is_running ? "bg-accent-soft text-accent" : "bg-card text-muted"}`}>
          <Clock className={`w-5 h-5 ${session.is_running ? "animate-pulse" : ""}`} />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-faint">
            {session.is_running ? "Currently focused on" : "Paused session"}
          </p>
          <h4 className="text-sm font-semibold text-fg">{session.project_title || "Untitled project"}</h4>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-xl font-bold text-accent">{fmt}</span>
        <Link href="/dashboard/time-tracker">
          <Button size="sm" variant="outline" className="rounded-lg border-line text-fg">
            Open Timer
          </Button>
        </Link>
      </div>
    </div>
  );
}
