"use client";

import Link from "next/link";
import { CalendarDays, Pause, Phone, Plus, RefreshCw } from "@/components/animated-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/patterns";
import { BookingServicesPanel } from "@/components/dashboard/panels/BookingServicesPanel";
import { getBookings, getBookingAppointments, type BookingAppointment } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";

/* Services — the things a client can book. Each one owns its own link,
   opening hours and days off, so they all live on this page. */
export default function BookingServicesPage() {
  const { data, loading, refresh } = useApiData(
    "booking:services-overview",
    async (token) => {
      const [services, appointments] = await Promise.all([
        getBookings(token).catch(() => []),
        getBookingAppointments(undefined, token).catch(() => []),
      ]);

      const safeAppointments: BookingAppointment[] = Array.isArray(appointments)
        ? appointments
        : Array.isArray((appointments as unknown as { appointments?: BookingAppointment[] })?.appointments)
          ? (appointments as unknown as { appointments: BookingAppointment[] }).appointments
          : [];

      return {
        services: Array.isArray(services) ? services : [],
        appointments: safeAppointments,
      };
    },
    { reportContext: "booking-services", pollMs: 25_000 }
  );

  const services = data?.services ?? [];
  const appointments = data?.appointments ?? [];

  // Card 1: Services setup breakdown
  const googleMeetCount = services.filter((s) => !s.meeting_provider || s.meeting_provider === "google_meet").length;
  const withIntakeCount = services.filter((s) => Boolean(s.intake_form_id)).length;

  // Card 2: Live services breakdown
  const activeServices = services.filter((s) => s.is_active);
  const active = activeServices.length;
  const activePaid = activeServices.filter((s) => s.price > 0).length;
  const activeFree = activeServices.filter((s) => s.price === 0).length;

  // Card 3: Calls booked breakdown (real-time from appointments)
  const bookedTotal = services.reduce((sum, s) => sum + (s.appointments_count ?? 0), 0);
  const totalCalls = Math.max(appointments.length, bookedTotal);
  const upcomingCalls = appointments.length > 0
    ? appointments.filter((a) => a.status === "confirmed" || a.status === "pending").length
    : totalCalls;
  const completedCalls = appointments.filter((a) => a.status === "completed").length;

  // Card 4: Paused services breakdown
  const pausedServices = services.filter((s) => !s.is_active);
  const paused = pausedServices.length;
  const pausedPaid = pausedServices.filter((s) => s.price > 0).length;
  const pausedFree = pausedServices.filter((s) => s.price === 0).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 4 Headline Metric Cards at the top — concise, non-duplicative, real-time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 enter-stagger">
        {loading && !data ? (
          [1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
          ))
        ) : (
          <>
            <StatCard
              label="Services"
              value={services.length}
              icon={CalendarDays}
              rows={[
                { text: `${googleMeetCount} Google Meet`, dot: "info" },
                { text: `${withIntakeCount} with intake`, dot: "ok" },
              ]}
            />
            <StatCard
              label="Live now"
              value={active}
              icon={Phone}
              rows={[
                { text: `${activePaid} paid`, dot: "info" },
                { text: `${activeFree} free`, dot: "ok" },
              ]}
            />
            <StatCard
              label="Calls booked"
              value={totalCalls}
              icon={CalendarDays}
              rows={[
                { text: `${upcomingCalls} upcoming`, dot: "ok" },
                { text: `${completedCalls} completed`, dot: "info" },
              ]}
            />
            <StatCard
              label="Paused"
              value={paused}
              icon={Pause}
              rows={[
                { text: `${pausedPaid} paid`, dot: pausedPaid > 0 ? "warn" : "ok" },
                { text: `${pausedFree} free`, dot: "ok" },
              ]}
            />
          </>
        )}
      </div>

      {/* Action Controls Row (below the 4 main cards) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-2">
          <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
            {services.length} Total Service{services.length === 1 ? "" : "s"}
          </Badge>
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
            href="/dashboard/booking/new"
            className="press group relative inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-[#ff7a29] to-[#ea580c] hover:from-[#ff883d] hover:to-[#f97316] text-white font-medium text-xs sm:text-[13px] px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.25),0_0_12px_rgba(234,88,12,0.3)] hover:shadow-[0_2px_5px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35),0_0_16px_rgba(234,88,12,0.45)] border border-orange-400/40 active:scale-95 transition-all duration-150 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-white transition-transform duration-200 group-hover:rotate-90" />
            <span>New service</span>
          </Link>
        </div>
      </div>

      <BookingServicesPanel consultations={services} loading={loading} />
    </div>
  );
}
