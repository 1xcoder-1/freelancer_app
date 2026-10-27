"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { showWelcomeToast } from "@/components/dashboard/WelcomeToast";


import {
  Clock,
  DollarSign,
  Receipt,
  Plus,
  Calendar,
  RefreshCw,
  LayoutGrid,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronRight,
  TrendingDown,
  Users,
  AlertTriangle,
  Inbox,
  Video,
} from "@/components/animated-icons";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard, StatChip } from "@/components/dashboard/patterns";
import { CalendarEventDetailModal } from "@/components/dashboard/CalendarEventModals";
import {
  getDashboardStats,
  getDashboardOverview,
  getCalendarEvents,
  getExpenses,
  getProjects,
  getClients,
  getLeads,
  getIntakeForms,
  getContracts,
  getBookings,
  getBookingAppointments,
  type CalendarFeedItem,
  type Project,
  type Client,
  type TodayTaskItem,
} from "@/lib/api";
import { PRIORITY_META, dueStatus, formatDueDate } from "@/components/dashboard/tasks/task-ui";
import { useApiData } from "@/hooks/use-api-data";
import { useLiveNotifications } from "@/hooks/use-live-notifications";
import { useWorkspaceCurrency } from "@/hooks/use-workspace-currency";
import { formatMoney } from "@/lib/currency";
import {
  humanizeInvoiceNumber,
  formatHumanDate,
  humanizeCalendarTitle,
  humanizeEventType,
} from "@/lib/humanize";

/* ------------------------------------------------------------------
   Home is deliberately simple: a greeting, the four numbers every
   freelancer cares about, a row of small coloured context cards,
   and one tabbed list (Today / My Projects / Recent Invoices /
   Time). The main cards carry the headline; the small cards carry
   the supporting metrics — nothing shows twice.
------------------------------------------------------------------- */

type TabKey = "today" | "projects" | "invoices";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [tab, setTab] = useState<TabKey>("today");
  const [selectedEventDetail, setSelectedEventDetail] = useState<CalendarFeedItem | null>(null);

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
        projectsRes,
        clientsRes,
      ] = await Promise.all([
        getDashboardStats(token),
        getDashboardOverview(token),
        getExpenses(token).catch(() => []),
        getLeads(token).catch(() => []),
        getIntakeForms(token).catch(() => []),
        getContracts(undefined, token).catch(() => []),
        getBookings(token).catch(() => []),
        getBookingAppointments(undefined, token).catch(() => []),
        getProjects(token).catch(() => []),
        getClients(token).catch(() => []),
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
        projects: projectsRes,
        clients: clientsRes,
      };
    },
    { reportContext: "dashboard" }
  );

  const stats = dashboardData?.stats ?? null;
  const overview = dashboardData?.overview ?? null;
  const expenses = dashboardData?.expenses ?? [];
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const recurringExpenses = expenses.filter((e) => e.is_recurring).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const now = new Date();
  // Local-date "YYYY-MM-DD" snapshot for due-chip tinting (same clock basis
  // the task board pages inject into dueStatus()).
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  // Task Management cards due today / overdue — comes inside the overview
  // payload, so it shares the dashboard fetch (no separate request).
  const todayTasks: TodayTaskItem[] = overview?.today_tasks ?? [];
  const thisMonthExpenses = expenses
    .filter((e) => {
      if (!e.created_at) return false;
      const d = new Date(e.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Real live projects metrics (zero dummy repetition)
  const projects: Project[] = dashboardData?.projects ?? [];
  const totalProjects = projects.length > 0 ? projects.length : (stats?.active_projects_count ?? 0);
  const doneProjects = projects.filter((p) => p.status === "completed").length;
  const incompleteProjects = projects.length > 0
    ? projects.filter((p) => p.status !== "completed").length
    : (stats?.active_projects_count ?? 0);

  // Real live clients metrics (zero dummy repetition)
  const clients: Client[] = dashboardData?.clients ?? [];
  const totalClients = clients.length > 0 ? clients.length : (stats?.active_clients_count ?? 0);
  const activeClients = clients.length > 0
    ? clients.filter((c) => c.status !== "archived").length
    : (stats?.active_clients_count ?? 0);
  const inactiveClients = clients.filter((c) => c.status === "archived").length;

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

  // Live via the shared SSE stream — no longer part of the dashboard fetch,
  // so the header badge and chip update the moment a signal lands.
  const unreadCount = useLiveNotifications();

  // Today's schedule — same feed the calendar uses, window = today only.
  const { data: todayEvents, loading: todayLoading, refresh: refreshToday } = useApiData<CalendarFeedItem[]>(
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

  // Sync real-time updates when tasks/events are created, updated, or deleted
  useEffect(() => {
    const handleCalendarUpdate = () => {
      refreshToday(true);
    };
    window.addEventListener("calendar-updated", handleCalendarUpdate);
    return () => window.removeEventListener("calendar-updated", handleCalendarUpdate);
  }, [refreshToday]);

  // Show welcome greeting once per session upon entering the dashboard
  useEffect(() => {
    if (!isLoaded) return;
    const name = (user?.firstName || user?.fullName || "").trim();
    showWelcomeToast(name);
  }, [isLoaded, user]);

  const { currency } = useWorkspaceCurrency();
  const usd = (n: number | undefined) => formatMoney(n ?? 0, currency, 0);
  const num = (n: number | undefined) => (n ?? 0).toLocaleString();

  const tabs: { key: TabKey; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "projects", label: "Projects" },
    { key: "invoices", label: "Recent Invoices" },
  ];

  return (
    <div className="space-y-6 enter-stagger">
      <h1 className="sr-only">Dashboard</h1>

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
              href="/dashboard/cashflow"
              rows={[
                {
                  text: `${num(stats?.monthly_revenue)} This month`,
                  dot: "ok",
                  href: "/dashboard/cashflow",
                },
                {
                  text: `${num(stats?.pending_invoices_amount)} Pending`,
                  dot: (stats?.pending_invoices_amount ?? 0) > 0 ? "warn" : "info",
                  href: "/dashboard/projects?tab=invoices",
                },
              ]}
            />
            <StatCard
              label="Expenses"
              value={usd(totalExpenses)}
              icon={TrendingDown}
              href="/dashboard/cashflow?tab=expenses"
              rows={[
                {
                  text: `${num(thisMonthExpenses)} This month`,
                  dot: "ok",
                  href: "/dashboard/cashflow?tab=expenses",
                },
                {
                  text: `${num(recurringExpenses)} Recurring`,
                  dot: recurringExpenses > 0 ? "warn" : "info",
                  href: "/dashboard/cashflow?tab=expenses",
                },
              ]}
            />
            <StatCard
              label="Projects"
              value={totalProjects}
              icon={LayoutGrid}
              href="/dashboard/projects"
              rows={[
                {
                  text: `${doneProjects} Done`,
                  dot: "ok",
                  href: "/dashboard/projects",
                },
                {
                  text: `${incompleteProjects} Incomplete`,
                  dot: incompleteProjects > 0 ? "warn" : "info",
                  href: "/dashboard/projects",
                },
              ]}
            />
            <StatCard
              label="Active Clients"
              value={totalClients}
              icon={Users}
              href="/dashboard/clients"
              rows={[
                {
                  text: `${activeClients} Active`,
                  dot: "ok",
                  href: "/dashboard/clients",
                },
                {
                  text: `${inactiveClients} Inactive`,
                  dot: inactiveClients > 0 ? "warn" : "info",
                  href: "/dashboard/clients",
                },
              ]}
            />
          </>
        )}
      </div>

      {/* The Capsule Rating & Context Badges — Reference Design with App Domain Content */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 pt-1">
        <StatChip tone="green" href="/dashboard/projects?tab=invoices">
          <span className="font-semibold">{String(stats?.pending_invoices_count || 0)}</span>
          <span>Invoices waiting</span>
        </StatChip>
        <StatChip tone="blue" href="/dashboard/clients?tab=leads">
          <span className="font-semibold">{String(pendingLeadsCount)}</span>
          <span>Pending leads</span>
        </StatChip>
        <StatChip tone="purple" href="/dashboard/clients?tab=forms">
          <span className="font-semibold">{String(pendingIntakeCount)}</span>
          <span>Pending intake forms</span>
        </StatChip>
        <StatChip tone="red" href="/dashboard/contracts">
          <span className="font-semibold">{String(waitingContractsCount)}</span>
          <span>Contracts waiting</span>
        </StatChip>
        <StatChip tone="violet" href="/dashboard/booking">
          <span className="font-semibold">{String(pendingBookingsCount)}</span>
          <span>Pending bookings</span>
        </StatChip>
        <StatChip tone="amber" href="/dashboard/planner/tasks">
          <span className="font-semibold">{String(todayTasks.length)}</span>
          <span>Tasks due</span>
        </StatChip>
        {unreadCount > 0 && (
          <StatChip tone="amber" href="/dashboard/inbox">
            <Inbox className="w-3.5 h-3.5" />
            <span className="font-semibold">{String(unreadCount)}</span>
            <span>New signals</span>
          </StatChip>
        )}
      </div>

      {/* One small tabbed area — pick a label, see a short list */}
      <div className="bg-card border border-line rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 border-b border-line mb-4 pb-2 select-none">
          <div className="flex items-center gap-5 overflow-x-auto no-scrollbar select-none">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`py-2 px-1 text-sm font-semibold border-b-2 -mb-[9px] whitespace-nowrap transition-colors cursor-pointer select-none outline-none focus:outline-none focus-visible:ring-0 ${
                  tab === t.key
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-fg"
                }`}
                style={{ caretColor: "transparent", userSelect: "none" }}
              >
                <span className="select-none pointer-events-none">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Quick Actions in the same row as the tabs */}
          <div className="flex items-center gap-2 shrink-0 select-none">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={loading}
              className="w-9 h-9 rounded-xl border border-line bg-surface/40 hover:bg-surface text-muted hover:text-fg hover:border-line-strong flex items-center justify-center shadow-xs transition-all active:scale-[0.96] cursor-pointer disabled:opacity-50"
              title="Refresh dashboard"
              aria-label="Refresh dashboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-accent" : ""}`} />
            </button>

            <Link
              href="/dashboard/inbox"
              className="relative w-9 h-9 rounded-xl border border-line bg-surface/40 hover:bg-surface text-muted hover:text-fg hover:border-line-strong flex items-center justify-center shadow-xs transition-all active:scale-[0.96] cursor-pointer group"
              title="Inbox"
              aria-label="Open inbox"
            >
              <Inbox className="w-4 h-4 text-muted group-hover:text-fg transition-colors" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#ea580c] text-white text-[9px] font-bold flex items-center justify-center shadow-xs ring-2 ring-card tracking-tight pointer-events-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            {tab === "projects" ? (
              <Link
                href="/dashboard/projects/new"
                className="h-9 px-3.5 rounded-xl border border-line bg-surface/40 hover:bg-surface text-muted hover:text-fg hover:border-line-strong flex items-center gap-2 text-xs font-medium transition-all active:scale-[0.96] shadow-xs cursor-pointer group"
                title="Create New Project"
                aria-label="Create New Project"
              >
                <Plus className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="font-medium text-fg/90 group-hover:text-fg transition-colors">New Project</span>
              </Link>
            ) : tab === "invoices" ? (
              <Link
                href="/dashboard/projects?tab=invoices"
                className="h-9 px-3.5 rounded-xl border border-line bg-surface/40 hover:bg-surface text-muted hover:text-fg hover:border-line-strong flex items-center gap-2 text-xs font-medium transition-all active:scale-[0.96] shadow-xs cursor-pointer group"
                title="View All Invoices"
                aria-label="View All Invoices"
              >
                <Receipt className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="font-medium text-fg/90 group-hover:text-fg transition-colors">Invoices</span>
              </Link>
            ) : (
              <Link
                href="/dashboard/calendar"
                className="h-9 px-3.5 rounded-xl border border-line bg-surface/40 hover:bg-surface text-muted hover:text-fg hover:border-line-strong flex items-center gap-2 text-xs font-medium transition-all active:scale-[0.96] shadow-xs cursor-pointer group"
                title="Open Calendar"
                aria-label="Open Calendar"
              >
                <CalendarDays className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="font-medium text-fg/90 group-hover:text-fg transition-colors">Calendar</span>
              </Link>
            )}
          </div>
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
              <div className="space-y-3">
                {todayLoading || loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-14 rounded-xl" />
                    ))}
                  </div>
                ) : (todayEvents && todayEvents.length > 0) || todayTasks.length > 0 ? (
                  <div className="space-y-2.5">
                    {/* Calendar feed events */}
                    {todayEvents?.map((ev) => {
                      const isDeadline = ev.event_type === "deadline";
                      const isMeeting = ev.event_type === "meeting";
                      const isClientWork = ev.event_type === "client_work";

                      const badgeStyle = isDeadline
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/25"
                        : isMeeting
                          ? "bg-sky-500/10 text-sky-400 border-sky-500/25"
                          : isClientWork
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                            : "bg-purple-500/10 text-purple-400 border-purple-500/25";

                      const dotColor = isDeadline
                        ? "bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.5)]"
                        : isMeeting
                          ? "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.5)]"
                          : isClientWork
                            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                            : "bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.5)]";

                      const timeText = ev.is_all_day
                        ? "All day"
                        : new Date(ev.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

                      return (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedEventDetail(ev)}
                          className="group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-line/70 bg-surface/30 hover:bg-surface/70 hover:border-line transition-all cursor-pointer select-none"
                          title={`View details for ${ev.title}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Compact time badge */}
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface border border-line/80 text-[11px] font-medium text-fg/90 shrink-0">
                              <Clock className="w-3 h-3 text-muted" />
                              <span>{timeText}</span>
                            </div>

                            <p className="text-sm font-medium text-fg truncate group-hover:text-accent transition-colors shrink-0">
                              {humanizeCalendarTitle(ev.title)}
                            </p>

                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium border shrink-0 ${badgeStyle}`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                              {humanizeEventType(ev.event_type)}
                            </span>

                            {ev.client_name && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-surface border border-line text-muted shrink-0 truncate">
                                <Users className="w-3 h-3 text-muted" />
                                <span>Client: {ev.client_name}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            {ev.meeting_link && (
                              <a
                                href={ev.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md bg-accent hover:bg-accent-hi text-accent-fg text-[11px] font-medium transition-all shadow-xs cursor-pointer active:scale-95"
                              >
                                <Video className="w-3 h-3" />
                                <span>Join</span>
                              </a>
                            )}
                            <ChevronRight className="w-4 h-4 text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      );
                    })}

                    {/* Tasks due today */}
                    {todayTasks.map((t) => {
                      const status = dueStatus(t.due_date, todayIso, t.completed);
                      const priority = t.priority ? PRIORITY_META[t.priority] : null;

                      const dueChip =
                        status === "overdue"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/25"
                          : status === "today"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                            : "bg-surface border-line text-muted";

                      return (
                        <Link
                          key={t.id}
                          href={`/dashboard/planner/tasks/${t.board_id}`}
                          className="group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-line/70 bg-surface/30 hover:bg-surface/70 hover:border-line transition-all select-none"
                          title={`Open board: ${t.board_name}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Completed-checkbox visual */}
                            <span
                              className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-all ${
                                t.completed
                                  ? "bg-accent border-accent text-accent-fg"
                                  : "border-line-strong bg-surface"
                              }`}
                              aria-hidden="true"
                            >
                              {t.completed && <Check className="w-3 h-3" />}
                            </span>

                            <p
                              className={`text-sm font-medium truncate group-hover:text-accent transition-colors ${
                                t.completed ? "line-through text-muted" : "text-fg"
                              }`}
                            >
                              {t.title}
                            </p>

                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium border shrink-0 bg-amber-500/10 text-amber-400 border-amber-500/25">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
                              Task
                            </span>

                            {priority && (
                              <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium shrink-0 ${priority.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`} />
                                {priority.label}
                              </span>
                            )}

                            {t.due_date && (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border shrink-0 ${dueChip}`}>
                                <Calendar className="w-3 h-3" />
                                <span>{formatDueDate(t.due_date)}</span>
                              </span>
                            )}

                            {t.list_name && (
                              <span className="hidden md:inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-surface border border-line text-muted shrink-0 truncate max-w-[140px]">
                                {t.list_name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            {t.board_name && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-surface border border-line text-muted shrink-0 truncate max-w-[140px]">
                                <LayoutGrid className="w-3 h-3 text-muted" />
                                <span>{t.board_name}</span>
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <SimpleEmpty
                    icon={Calendar}
                    title="Nothing scheduled today"
                    desc="Add a meeting, client deliverable, or deadline to keep your day on track."
                    action={
                      <Link href="/dashboard/calendar" className="inline-block mt-4">
                        <Button size="sm" className="rounded-lg bg-accent hover:bg-accent-hi text-accent-fg">
                          <Plus className="w-4 h-4 mr-1.5" />
                          Open Calendar
                        </Button>
                      </Link>
                    }
                  />
                )}
              </div>
            )}

            {tab === "projects" && (
              <div className="space-y-2.5">
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-11 rounded-xl" />
                    ))}
                  </div>
                ) : overview?.recent_projects && overview.recent_projects.length > 0 ? (
                  <div className="space-y-2.5">
                    {overview.recent_projects.slice(0, 5).map((proj) => (
                      <Link
                        key={proj.id}
                        href={`/dashboard/projects/${proj.id}`}
                        className="group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-line/70 bg-surface/30 hover:bg-surface/70 hover:border-line transition-all select-none"
                        title={`View project: ${proj.title}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-7 h-7 rounded-lg bg-accent-soft text-accent border border-accent/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <LayoutGrid className="w-3.5 h-3.5" />
                          </div>

                          <p className="text-sm font-medium text-fg truncate group-hover:text-accent transition-colors">
                            {proj.title}
                          </p>

                          {proj.client_name && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-surface border border-line text-muted shrink-0 truncate max-w-[140px]">
                              <Users className="w-3 h-3 text-muted" />
                              <span>{proj.client_name}</span>
                            </span>
                          )}

                          {proj.due_date && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-surface border border-line text-muted shrink-0">
                              <Calendar className="w-3 h-3 text-muted" />
                              <span>Due {formatHumanDate(proj.due_date)}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-2">
                            <div className="w-20 sm:w-28 bg-surface rounded-full h-1.5 overflow-hidden border border-line/60">
                              <div
                                className="bg-accent h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, Math.max(0, proj.progress_pct))}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold text-fg/90 min-w-[32px] text-right font-mono">
                              {proj.progress_pct}%
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <SimpleEmpty
                    icon={LayoutGrid}
                    title="No projects yet"
                    desc="Create your first project to organize tasks and track time."
                    action={
                      <Link href="/dashboard/projects/new" className="inline-block mt-4">
                        <Button size="sm" className="rounded-lg bg-accent hover:bg-accent-hi text-accent-fg">
                          <Plus className="w-4 h-4 mr-1.5" />
                          Create Project
                        </Button>
                      </Link>
                    }
                  />
                )}
              </div>
            )}

            {tab === "invoices" && (
              <div className="space-y-2.5">
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-11 rounded-xl" />
                    ))}
                  </div>
                ) : overview?.recent_invoices && overview.recent_invoices.length > 0 ? (
                  <div className="space-y-2.5">
                    {overview.recent_invoices.slice(0, 5).map((inv) => {
                      const isPaid = inv.status === "paid";
                      const isOverdue = inv.status === "overdue";
                      const statusPill = isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                          Paid
                        </span>
                      ) : isOverdue ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/25 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.5)]" />
                          Overdue
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
                          Pending
                        </span>
                      );

                      const humanTitle = humanizeInvoiceNumber(inv.number);
                      const formattedDate = formatHumanDate(inv.issue_date);

                      return (
                        <Link
                          key={inv.id}
                          href="/dashboard/projects?tab=invoices"
                          className="group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-line/70 bg-surface/30 hover:bg-surface/70 hover:border-line transition-all select-none"
                          title={`View invoice: ${humanTitle}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
                              isPaid
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : isOverdue
                                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                  : "bg-accent-soft text-accent border-accent/20"
                            }`}>
                              <Receipt className="w-3.5 h-3.5" />
                            </div>

                            <p className="text-sm font-medium text-fg truncate group-hover:text-accent transition-colors">
                              {humanTitle}
                            </p>

                            {inv.client && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-surface border border-line text-muted shrink-0 truncate max-w-[140px]">
                                <Users className="w-3 h-3 text-muted" />
                                <span>{inv.client}</span>
                              </span>
                            )}

                            {formattedDate && (
                              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-surface border border-line text-muted shrink-0">
                                <Clock className="w-3 h-3 text-muted" />
                                <span>{formattedDate}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {statusPill}
                            <ChevronRight className="w-4 h-4 text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <SimpleEmpty
                    icon={Receipt}
                    title="No invoices yet"
                    desc="Bill clients and track payments from your projects."
                    action={
                      <Link href="/dashboard/projects?tab=invoices" className="inline-block mt-4">
                        <Button size="sm" className="rounded-lg bg-accent hover:bg-accent-hi text-accent-fg">
                          <Plus className="w-4 h-4 mr-1.5" />
                          Create Invoice
                        </Button>
                      </Link>
                    }
                  />
                )}
              </div>
            )}


          </motion.div>
        </AnimatePresence>
      </div>

      {selectedEventDetail && (
        <CalendarEventDetailModal
          item={selectedEventDetail}
          onClose={() => setSelectedEventDetail(null)}
          onDeleted={() => {
            setSelectedEventDetail(null);
            refreshToday(true);
            loadData(true);
          }}
        />
      )}
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

