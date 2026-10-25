"use client";

import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Lock,
  Phone,
  Plus,
  RefreshCw,
  Video,
} from "@/components/animated-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/patterns";
import { BookingServicesPanel } from "@/components/dashboard/panels/BookingServicesPanel";
import { getBookings, getBookingAppointments, type BookingAppointment } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
import { usePlanCapacity } from "@/components/dashboard/PlanLimit";

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
  const capacity = usePlanCapacity("services");

  // Card 1: Services setup breakdown
  const googleMeetCount = services.filter((s) => !s.meeting_provider || s.meeting_provider === "google_meet").length;

  // Card 2: Live services breakdown
  const activeServices = services.filter((s) => s.is_active);
  const active = activeServices.length;

  // Card 3: Calls booked breakdown (real-time from appointments)
  const bookedTotal = services.reduce((sum, s) => sum + (s.appointments_count ?? 0), 0);
  const totalCalls = Math.max(appointments.length, bookedTotal);
  const upcomingCalls = appointments.length > 0
    ? appointments.filter((a) => a.status === "confirmed" || a.status === "pending").length
    : totalCalls;
  const completedCalls = appointments.filter((a) => a.status === "completed").length;

  // Card 4: Paused services breakdown
  const paused = services.filter((s) => !s.is_active).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 4 Headline Metric Cards at the top — unified StatCard pattern */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 enter-stagger">
        {loading && !data ? (
          [1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[180px] w-full rounded-2xl bg-card border border-line" />
          ))
        ) : (
          <>
            {/* Card 1: Services Roster */}
            <StatCard
              label="Services"
              value={services.length}
              icon={CalendarDays}
              rows={[
                {
                  text: `${googleMeetCount} Google Meet`,
                  dot: "ok",
                },
              ]}
            />

            {/* Card 2: Live Now */}
            <StatCard
              label="Live Services"
              value={active}
              icon={Phone}
              rows={[
                {
                  text: paused > 0 ? `${paused} paused` : "All active",
                  dot: paused > 0 ? "warn" : "ok",
                },
              ]}
            />

            {/* Card 3: Calls Booked */}
            <StatCard
              label="Calls Booked"
              value={totalCalls}
              icon={Video}
              rows={[
                {
                  text: `${upcomingCalls} upcoming`,
                  dot: "info",
                },
              ]}
            />

            {/* Card 4: Completed Calls */}
            <StatCard
              label="Completed"
              value={completedCalls}
              icon={CheckCircle2}
              rows={[
                {
                  text: `${completedCalls} finished`,
                  dot: "ok",
                },
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
            className="border-line text-fg bg-card hover:bg-surface w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95"
            title="Refresh services"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-accent" : ""}`} />
          </Button>
          <Link
            href={capacity.atLimit ? capacity.upgradeHref : "/dashboard/booking/new"}
            title={
              capacity.atLimit
                ? `Service limit reached (${capacity.used}/${capacity.limit})`
                : "New service"
            }
            className={`press group relative inline-flex h-9 items-center justify-center gap-1.5 rounded-xl font-medium text-xs sm:text-[13px] px-3.5 border active:scale-95 transition-all duration-150 cursor-pointer ${
              capacity.atLimit
                ? "bg-warn/15 text-warn border-warn/30 hover:bg-warn/20"
                : "bg-gradient-to-b from-[#ff7a29] to-[#ea580c] hover:from-[#ff883d] hover:to-[#f97316] text-white shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.25),0_0_12px_rgba(234,88,12,0.3)] hover:shadow-[0_2px_5px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35),0_0_16px_rgba(234,88,12,0.45)] border-orange-400/40"
            }`}
          >
            {capacity.atLimit ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-white transition-transform duration-200 group-hover:rotate-90" />
            )}
            <span>{capacity.atLimit ? "Upgrade plan" : "New service"}</span>
          </Link>
        </div>
      </div>

      <BookingServicesPanel consultations={services} loading={loading} />
    </div>
  );
}
