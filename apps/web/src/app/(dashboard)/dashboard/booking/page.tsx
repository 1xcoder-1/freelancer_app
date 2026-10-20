"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  RefreshCw,
} from "@/components/animated-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/patterns";
import { BookingCallsPanel } from "@/components/dashboard/panels/BookingCallsPanel";
import { getBookingAppointments, getBookingAgenda } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";

/* Calls — every appointment a client booked, plus the clock around them.
   Services (what clients can book) is its own page. */
export default function BookingCallsPage() {
  const { data, loading, refresh } = useApiData(
    "booking:calls",
    async (token) => {
      const [appointments, agenda] = await Promise.all([
        getBookingAppointments(undefined, token).catch(() => []),
        getBookingAgenda(token).catch(() => null),
      ]);
      return { appointments, agenda };
    },
    { reportContext: "booking-calls", pollMs: 20_000 }
  );

  const appointments = data?.appointments ?? [];
  const agenda = data?.agenda ?? null;

  const isOpen = (s: string) => s === "pending" || s === "confirmed";
  const upcoming = appointments
    .filter((a) => isOpen(a.status))
    .sort((a, b) => a.appointment_time.localeCompare(a.appointment_time));
  const past = appointments
    .filter((a) => !isOpen(a.status))
    .sort((a, b) => b.appointment_time.localeCompare(a.appointment_time));
  const ordered = [...upcoming, ...past];

  const todayCount = agenda?.today_calls?.length ?? 0;
  const weekBooked = agenda?.week_booked ?? 0;
  const pendingCount = appointments.filter((a) => a.status === "pending").length;
  const unpaidCount = appointments.filter((a) => a.payment_status === "unpaid" && isOpen(a.status)).length;
  const noShowCount = agenda?.no_show_count ?? appointments.filter((a) => a.status === "no_show").length;
  const cancelledCount = appointments.filter((a) => a.status === "cancelled").length;

  const nextCallWhen = !agenda?.next_call
    ? null
    : agenda.hours_to_next != null && agenda.hours_to_next < 24
      ? `in ${Math.max(0, Math.round(agenda.hours_to_next))}h`
      : `in ${Math.ceil((agenda.hours_to_next ?? 0) / 24)}d`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 4 Headline Metric Cards at the top — concise, numbers-driven, real-time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 enter-stagger">
        {loading && !data ? (
          [1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
          ))
        ) : (
          <>
            <StatCard
              label="Next call"
              value={agenda?.next_call ? agenda.next_call.client_name.split(" ")[0] : "—"}
              icon={Clock}
              rows={
                agenda?.next_call
                  ? [
                      { text: nextCallWhen ?? "scheduled", dot: "info" },
                      { text: `${todayCount} today`, dot: todayCount > 0 ? "ok" : "info" },
                    ]
                  : [
                      { text: "0 today", dot: "ok" },
                      { text: "0 upcoming", dot: "ok" },
                    ]
              }
            />
            <StatCard
              label="Upcoming"
              value={upcoming.length}
              icon={CalendarDays}
              rows={[
                { text: `${todayCount} today`, dot: "ok" },
                { text: `${weekBooked} this week`, dot: "info" },
              ]}
            />
            <StatCard
              label="Needs you"
              value={pendingCount + unpaidCount}
              icon={CheckCircle2}
              rows={[
                { text: `${pendingCount} to confirm`, dot: pendingCount ? "warn" : "ok" },
                { text: `${unpaidCount} unpaid`, dot: unpaidCount ? "warn" : "ok" },
              ]}
            />
            <StatCard
              label="No-shows"
              value={noShowCount}
              icon={AlertTriangle}
              rows={[
                { text: `${noShowCount} missed`, dot: noShowCount > 0 ? "danger" : "ok" },
                { text: `${cancelledCount} cancelled`, dot: cancelledCount > 0 ? "warn" : "ok" },
              ]}
            />
          </>
        )}
      </div>

      {/* Action Controls Row (below the 4 main cards) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-2">
          <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
            {ordered.length} Total Call{ordered.length === 1 ? "" : "s"}
          </Badge>
          {upcoming.length > 0 && (
            <span className="text-xs font-mono text-muted hidden sm:inline">
              · {upcoming.length} upcoming
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh(true)}
            disabled={loading}
            className="border-line text-fg bg-card hover:bg-surface w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Link
            href="/dashboard/booking/services"
            className="inline-flex h-9 items-center justify-center rounded-xl border border-line bg-card hover:bg-surface px-3.5 text-xs font-medium text-fg transition-colors"
          >
            Services
          </Link>
        </div>
      </div>

      <BookingCallsPanel appointments={ordered} loading={loading} />
    </div>
  );
}
