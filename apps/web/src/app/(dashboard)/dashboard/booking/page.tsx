"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  RefreshCw,
} from "@/components/animated-icons";
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
    .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
  const past = appointments
    .filter((a) => !isOpen(a.status))
    .sort((a, b) => b.appointment_time.localeCompare(a.appointment_time));
  const ordered = [...upcoming, ...past];

  const pendingCount = appointments.filter((a) => a.status === "pending").length;
  const unpaidCount = appointments.filter((a) => a.payment_status === "unpaid" && isOpen(a.status)).length;

  const nextCallWhen = !agenda?.next_call
    ? null
    : agenda.hours_to_next != null && agenda.hours_to_next < 24
      ? `in ${Math.max(0, Math.round(agenda.hours_to_next))}h`
      : `in ${Math.ceil((agenda.hours_to_next ?? 0) / 24)} days`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">Calls</h1>
          <p className="text-muted text-sm mt-1">
            Every call a client booked — confirm it, mark the outcome, or send a reschedule link.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <Link
            href="/dashboard/booking/services"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-line bg-card px-3.5 text-xs font-medium text-fg transition-colors hover:bg-surface"
          >
            Services
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
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
                      { text: agenda.next_call.consultation_title || "Consultation", dot: "ok" },
                    ]
                  : [{ text: "Nothing booked yet" }]
              }
            />
            <StatCard
              label="Upcoming"
              value={upcoming.length}
              icon={CalendarDays}
              rows={[
                { text: `${agenda?.today_calls.length ?? 0} today`, dot: "ok" },
                { text: `${agenda?.week_booked ?? 0} in the next 7 days`, dot: "info" },
              ]}
            />
            <StatCard
              label="Needs you"
              value={pendingCount + unpaidCount}
              icon={CheckCircle2}
              rows={[
                { text: `${pendingCount} to confirm`, dot: pendingCount ? "warn" : "ok" },
                { text: `${unpaidCount} awaiting payment`, dot: unpaidCount ? "warn" : "ok" },
              ]}
            />
            <StatCard
              label="No-shows"
              value={agenda?.no_show_count ?? 0}
              icon={AlertTriangle}
              rows={[
                { text: "counted against strike limits", dot: "danger" },
                { text: `${agenda?.week_available ?? 0} open slots this week`, dot: "ok" },
              ]}
            />
          </>
        )}
      </div>

      <BookingCallsPanel appointments={ordered} loading={loading} />
    </div>
  );
}
