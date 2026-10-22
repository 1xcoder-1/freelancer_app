"use client";

import Link from "next/link";
import { TextMorph } from "torph/react";
import { CalendarDays, Lock, Pause, Phone, Plus, RefreshCw } from "@/components/animated-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  const withIntakeCount = services.filter((s) => Boolean(s.intake_form_id)).length;

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
      {/* 4 Headline Metric Cards at the top — concise, vibrant, real-time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 enter-stagger">
        {loading && !data ? (
          [1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl bg-card border border-line" />
          ))
        ) : (
          <>
            {/* Card 1: Total Services */}
            <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-accent/5 blur-2xl group-hover:bg-accent/15 transition-all duration-500 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
                  Services
                </span>
                <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-accent group-hover:border-accent/30 transition-all duration-200">
                  <CalendarDays className="w-4 h-4" />
                </div>
              </div>
              <div className="relative z-10 my-2.5">
                <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
                  <TextMorph numbers className="tabular-nums">{services.length}</TextMorph>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 pt-1 text-xs text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block shrink-0" />
                <span>{googleMeetCount} Google Meet</span>
              </div>
            </div>

            {/* Card 2: Live Now */}
            <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/15 transition-all duration-500 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
                  Live
                </span>
                <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all duration-200">
                  <Phone className="w-4 h-4" />
                </div>
              </div>
              <div className="relative z-10 my-2.5">
                <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
                  <TextMorph numbers className="tabular-nums">{active}</TextMorph>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 pt-1 text-xs text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0 animate-pulse" />
                <span>{paused > 0 ? `${paused} paused` : "All active"}</span>
              </div>
            </div>

            {/* Card 3: Calls Booked */}
            <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-accent/5 blur-2xl group-hover:bg-accent/15 transition-all duration-500 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
                  Calls Booked
                </span>
                <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-accent group-hover:border-accent/30 transition-all duration-200">
                  <CalendarDays className="w-4 h-4" />
                </div>
              </div>
              <div className="relative z-10 my-2.5">
                <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
                  <TextMorph numbers className="tabular-nums">{totalCalls}</TextMorph>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 pt-1 text-xs text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block shrink-0" />
                <span>{upcomingCalls} upcoming</span>
              </div>
            </div>

            {/* Card 4: Completed Calls */}
            <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/15 transition-all duration-500 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
                  Completed
                </span>
                <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all duration-200">
                  <Pause className="w-4 h-4" />
                </div>
              </div>
              <div className="relative z-10 my-2.5">
                <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
                  <TextMorph numbers className="tabular-nums">{completedCalls}</TextMorph>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 pt-1 text-xs text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                <span>{completedCalls} finished</span>
              </div>
            </div>
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
