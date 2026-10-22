"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { TextMorph } from "torph/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Pause,
  Pencil,
  Play,
  Trash2,
  Video,
} from "@/components/animated-icons";
import { ChevronRight, Calendar, Timer, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getBookings,
  getBookingAppointments,
  deleteBooking,
  updateBooking,
  type BookingConsultation,
  type BookingAppointment,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { DAY_LABELS } from "@/components/dashboard/booking/ConsultationForm";
import { fmtWhen, invalidateBookingCaches, STATUS_TONE } from "@/components/dashboard/booking/utils";
import { logHandledError } from "@/lib/log-error";
import { usePlanCapacity } from "@/components/dashboard/PlanLimit";

export default function ServiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const serviceId = String(params?.id || "");
  const { getToken } = useAuth();

  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch services roster
  const { data: consultations, loading, refresh } = useApiData<BookingConsultation[]>(
    "booking:services",
    async (token) => getBookings(token).catch(() => []),
    { reportContext: "service-detail" }
  );

  // Fetch appointments for this workspace
  const { data: appointmentsData } = useApiData(
    "booking:appointments:all",
    async (token) => getBookingAppointments(undefined, token).catch(() => []),
    { reportContext: "service-detail-appointments", pollMs: 30_000 }
  );

  const serviceList = Array.isArray(consultations) ? consultations : [];
  const service = serviceList.find((s) => s.id === serviceId);
  const capacity = usePlanCapacity("services");

  // Guarantee an array under all conditions
  const getSafeAppointments = (data: unknown): BookingAppointment[] => {
    if (Array.isArray(data)) return data;
    if (
      data &&
      typeof data === "object" &&
      "appointments" in data &&
      Array.isArray((data as { appointments: unknown }).appointments)
    ) {
      return (data as { appointments: BookingAppointment[] }).appointments;
    }
    return [];
  };

  const allAppointments = getSafeAppointments(appointmentsData);

  // If this ID is an appointment rather than a service, smoothly redirect to the call detail page
  React.useEffect(() => {
    if (!loading && consultations && consultations.length >= 0 && !service) {
      if (allAppointments.some((a) => a.id === serviceId)) {
        router.replace(`/dashboard/booking/calls/${serviceId}`);
      }
    }
  }, [loading, consultations, service, allAppointments, serviceId, router]);

  // Filter appointments for this service
  const serviceAppointments = allAppointments.filter(
    (a) => a.consultation_id === serviceId || (service && a.consultation_title === service.title)
  );

  const completedCount = serviceAppointments.filter((a) => a.status === "completed").length;
  const upcomingCount = serviceAppointments.filter((a) => a.status === "confirmed" || a.status === "pending").length;

  const copyBookingUrl = () => {
    if (!service) return;
    const key = service.token || service.id;
    const url = `${window.location.origin}/booking/${key}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Booking link copied to clipboard");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleToggleActive = async () => {
    if (!service || toggling) return;
    setToggling(true);
    try {
      const token = (await getToken()) || undefined;
      await updateBooking(
        service.id,
        {
          title: service.title,
          description: service.description,
          duration_minutes: service.duration_minutes,
          meeting_provider: service.meeting_provider || "google_meet",
          is_active: !service.is_active,
          weekday_mask: service.weekday_mask,
          start_minute: service.start_minute,
          end_minute: service.end_minute,
          timezone: service.timezone,
          min_lead_hours: service.min_lead_hours,
          max_advance_days: service.max_advance_days,
          buffer_minutes: service.buffer_minutes,
          intake_form_id: service.intake_form_id,
          no_show_limit: service.no_show_limit,
        },
        token
      );
      invalidateCache("booking:services");
      invalidateBookingCaches();
      await refresh(true);
      toast.success(service.is_active ? "Service paused" : "Service is now live");
    } catch (err) {
      logHandledError("Toggle service status error:", err);
      toast.error("Could not update service status");
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!service || deleting) return;
    const ok = await confirmDialog({
      title: "Delete Service",
      message: `Are you sure you want to delete "${service.title}"? Clients will no longer be able to book this session.`,
      confirmLabel: "Delete Service",
      danger: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const token = (await getToken()) || undefined;
      await deleteBooking(service.id, token);
      invalidateCache("booking:services");
      invalidateCache("dashboard:data");
      invalidateBookingCaches();
      toast.success("Service deleted");
      router.push("/dashboard/booking/services");
    } catch (err) {
      logHandledError("Delete service error:", err);
      toast.error("Could not delete service");
      setDeleting(false);
    }
  };

  const formatMinutesToTime = (min?: number) => {
    if (min == null) return "09:00";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  if (loading && !service) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pt-2 px-3 sm:px-6">
        <Skeleton className="h-6 w-36 rounded-lg" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="max-w-5xl mx-auto pt-6 px-3 sm:px-6">
        <Card className="bg-card border-dashed border-line rounded-2xl p-12 text-center space-y-4">
          <CalendarDays className="w-12 h-12 text-faint mx-auto" />
          <h3 className="font-display text-xl font-medium text-fg">Service not found</h3>
          <p className="text-muted text-sm max-w-sm mx-auto">
            This service does not exist or may have been deleted.
          </p>
          <Link
            href="/dashboard/booking/services"
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Services
          </Link>
        </Card>
      </div>
    );
  }

  const linkKey = service.token || service.id;
  const activeDays = DAY_LABELS.filter((_, i) => service.weekday_mask?.[i] === "1");

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6 enter-stagger">
      {/* Top Breadcrumb & Quick Nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/booking/services"
          className="group inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-fg transition-colors cursor-pointer"
        >
          <span className="w-6 h-6 rounded-lg bg-surface border border-line/70 flex items-center justify-center transition-all group-hover:bg-surface-elevated group-hover:border-line-strong group-hover:-translate-x-0.5">
            <ArrowLeft className="w-3.5 h-3.5 text-muted group-hover:text-fg" />
          </span>
          <span className="text-muted/80">Services</span>
          <span className="text-faint">/</span>
          <span className="text-fg font-medium capitalize">{service.title}</span>
        </Link>
      </div>

      {/* Main Header Card: Title, Status, Description & Sleek Action Toolbar */}
      <div className="relative overflow-hidden rounded-2xl border border-line/70 bg-gradient-to-b from-card to-card/90 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-fg capitalize">
                {service.title}
              </h1>

              {/* Status Pill with Ambient Glow */}
              {service.is_active ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.12)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                  <span>Paused</span>
                </span>
              )}
            </div>

            {service.description && (
              <p className="text-xs sm:text-sm text-muted/90 font-normal max-w-2xl leading-relaxed">
                {service.description}
              </p>
            )}
          </div>

          {/* Unified Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0">
            {/* Primary Action: Copy Link */}
            <Button
              variant="outline"
              size="sm"
              onClick={copyBookingUrl}
              className="h-9 px-3.5 rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent/20 text-accent text-xs font-medium flex items-center gap-1.5 transition-all active:scale-[0.96] shadow-[0_0_16px_rgba(212,107,40,0.12)] group cursor-pointer"
              title="Copy public booking link"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent animate-in zoom-in-50 duration-200" />
                  <span className="font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
                  <span>Copy Link</span>
                </>
              )}
            </Button>

            {/* Preview Public Page */}
            <a
              href={`/booking/${linkKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 rounded-xl border border-line bg-surface/50 hover:bg-surface-elevated hover:border-line-strong text-muted hover:text-fg text-xs font-medium flex items-center gap-1.5 transition-all active:scale-[0.96] shadow-2xs group shrink-0"
              title="Preview public booking page"
            >
              <ExternalLink className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110 text-muted group-hover:text-fg" />
              <span>Preview</span>
            </a>

            {/* Edit */}
            <Link href={`/dashboard/booking/${service.id}/edit`}>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 rounded-xl border border-line bg-surface/50 hover:bg-surface-elevated hover:border-line-strong text-muted hover:text-fg text-xs font-medium flex items-center gap-1.5 transition-all active:scale-[0.96] shadow-2xs group cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-muted group-hover:text-fg transition-colors" />
                <span>Edit</span>
              </Button>
            </Link>

            {/* Pause / Resume */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleActive}
              disabled={toggling}
              className={`h-9 px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all active:scale-[0.96] shadow-2xs group cursor-pointer ${
                service.is_active
                  ? "border-line bg-surface/50 hover:bg-amber-500/10 hover:border-amber-500/30 text-muted hover:text-amber-500"
                  : "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-400"
              }`}
              title={service.is_active ? "Pause bookings" : "Resume bookings"}
            >
              {service.is_active ? (
                <>
                  <Pause className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
                  <span>Resume</span>
                </>
              )}
            </Button>

            {/* Delete */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="h-9 w-9 p-0 rounded-xl text-muted/60 hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/25 transition-all active:scale-[0.96] cursor-pointer"
              title="Delete Service"
            >
              <Trash2 className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
            </Button>
          </div>
        </div>
      </div>

      {/* 3 Metric Cards: Bookings, Upcoming, Duration */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Card 1: Bookings */}
        <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-accent/5 blur-2xl group-hover:bg-accent/15 transition-all duration-500 pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
              Total Bookings
            </span>
            <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-accent group-hover:border-accent/30 transition-all duration-200">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>

          <div className="relative z-10 my-3">
            <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
              <TextMorph numbers className="tabular-nums">
                {service.appointments_count ?? serviceAppointments.length}
              </TextMorph>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-1.5 pt-1 text-xs text-muted font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block shrink-0" />
            <span>{completedCount} Completed</span>
          </div>
        </div>

        {/* Card 2: Upcoming */}
        <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/15 transition-all duration-500 pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
              Upcoming
            </span>
            <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all duration-200">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="relative z-10 my-3">
            <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
              <TextMorph numbers className="tabular-nums">{upcomingCount}</TextMorph>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-1.5 pt-1 text-xs text-muted font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0 animate-pulse" />
            <span>Confirmed ahead</span>
          </div>
        </div>

        {/* Card 3: Duration */}
        <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-accent/5 blur-2xl group-hover:bg-accent/15 transition-all duration-500 pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
              Call Duration
            </span>
            <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-accent group-hover:border-accent/30 transition-all duration-200">
              <Timer className="w-4 h-4" />
            </div>
          </div>

          <div className="relative z-10 my-3">
            <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
              <TextMorph numbers className="tabular-nums">{`${service.duration_minutes}m`}</TextMorph>
            </div>
          </div>

          <div className="relative z-10 pt-1 text-xs text-muted font-mono">
            <span>+{service.buffer_minutes ?? 0}m buffer padding</span>
          </div>
        </div>
      </div>

      {/* Main Details Grid (8 cols Appointments, 4 cols Availability & Rules) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Booked Appointments */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-2xl border border-line/70 bg-card p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-line/60">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center border border-line/60 text-accent">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <h2 className="font-display text-base font-medium tracking-wide text-fg">
                  Booked Appointments
                </h2>
              </div>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-surface border border-line text-muted font-medium">
                {serviceAppointments.length} Total
              </span>
            </div>

            {serviceAppointments.length === 0 ? (
              <div className="py-12 px-4 text-center rounded-xl border border-dashed border-line/60 bg-surface/20 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-surface border border-line/80 mx-auto flex items-center justify-center text-faint">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-fg">No appointments yet</p>
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    Share your booking link with clients to start receiving calls.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyBookingUrl}
                  className="text-xs rounded-xl h-8 px-3 border border-line hover:border-accent/40 text-fg hover:text-accent font-medium cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  <span>Copy Public Link</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {serviceAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 rounded-xl border border-line/60 bg-surface/30 hover:bg-surface/70 hover:border-line-strong hover:shadow-2xs transition-all duration-200"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Client Initials Badge */}
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-surface-elevated to-surface border border-line/80 flex items-center justify-center text-xs font-semibold text-fg tracking-wide shrink-0 shadow-2xs group-hover:border-accent/30 transition-colors">
                        {appt.client_name ? appt.client_name.slice(0, 2).toUpperCase() : "??"}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-fg group-hover:text-accent transition-colors truncate">
                            {appt.client_name}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono uppercase font-semibold tracking-wider border ${
                              STATUS_TONE[appt.status] || "bg-surface text-muted border-line"
                            }`}
                          >
                            {appt.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted font-mono">
                          <span>{fmtWhen(appt.appointment_time)}</span>
                          <span className="text-faint">·</span>
                          <span className="truncate max-w-[220px] sm:max-w-none text-muted/80">{appt.client_email}</span>
                        </div>
                      </div>
                    </div>

                    {appt.meeting_link && (
                      <a
                        href={appt.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl border border-accent/40 bg-accent/10 hover:bg-accent hover:text-white text-accent font-medium active:scale-95 transition-all shadow-2xs shrink-0 self-start sm:self-auto"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join Call</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Availability & Rules Specification */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-line/70 bg-card p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-line/60">
              <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center border border-line/60 text-muted">
                <Clock className="w-4 h-4" />
              </div>
              <h2 className="font-display text-base font-medium tracking-wide text-fg">
                Availability & Rules
              </h2>
            </div>

            <div className="space-y-3">
              {/* Working Hours */}
              <div className="flex items-center justify-between py-1.5 border-b border-line/40 text-xs">
                <span className="text-muted flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-muted/70" />
                  <span>Working Hours</span>
                </span>
                <span className="font-mono font-medium text-fg">
                  {formatMinutesToTime(service.start_minute)} – {formatMinutesToTime(service.end_minute)}
                </span>
              </div>

              {/* Active Days (Visual 7-Day Mini Pills) */}
              <div className="py-2 border-b border-line/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-muted/70" />
                    <span>Active Days</span>
                  </span>
                  <span className="text-[11px] font-mono text-muted">
                    {activeDays.length} / 7 days
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1 pt-0.5">
                  {DAY_LABELS.map((day, i) => {
                    const isActive = service.weekday_mask?.[i] === "1";
                    return (
                      <div
                        key={day}
                        title={`${day}: ${isActive ? "Bookable" : "Off"}`}
                        className={`py-1 text-center rounded-lg text-[10px] font-mono transition-all select-none ${
                          isActive
                            ? "bg-accent/15 text-accent border border-accent/30 font-semibold shadow-2xs"
                            : "bg-surface/40 text-faint border border-line/30"
                        }`}
                      >
                        {day.slice(0, 2)}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Minimum Notice */}
              <div className="flex items-center justify-between py-1.5 border-b border-line/40 text-xs">
                <span className="text-muted flex items-center gap-2">
                  <Timer className="w-3.5 h-3.5 text-muted/70" />
                  <span>Minimum Notice</span>
                </span>
                <span className="text-fg font-medium font-mono">
                  {service.min_lead_hours ?? 1} hours before
                </span>
              </div>

              {/* Advance Booking */}
              <div className="flex items-center justify-between py-1.5 border-b border-line/40 text-xs">
                <span className="text-muted flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5 text-muted/70" />
                  <span>Advance Booking</span>
                </span>
                <span className="text-fg font-medium font-mono">
                  Up to {service.max_advance_days ?? 30} days
                </span>
              </div>

              {/* Strike Limit (if configured) */}
              {service.no_show_limit ? (
                <div className="flex items-center justify-between py-1.5 border-b border-line/40 text-xs">
                  <span className="text-muted">Strike Limit</span>
                  <span className="text-fg font-medium font-mono">
                    {service.no_show_limit} missed calls
                  </span>
                </div>
              ) : null}

              {/* Meeting Platform */}
              <div className="flex items-center justify-between py-1.5 text-xs">
                <span className="text-muted flex items-center gap-2">
                  <Video className="w-3.5 h-3.5 text-muted/70" />
                  <span>Platform</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface border border-line text-fg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {service.meeting_provider === "google_meet"
                    ? "Google Meet"
                    : service.meeting_provider || "Video Call"}
                </span>
              </div>
            </div>

            {/* Edit Schedule CTA Button */}
            <div className="pt-2">
              <Link href={`/dashboard/booking/${service.id}/edit`} className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-9 rounded-xl border border-line bg-surface/60 hover:bg-surface-elevated hover:border-line-strong text-fg text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-2xs group cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors" />
                  <span>Edit Schedule & Rules</span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted/60 group-hover:text-fg group-hover:translate-x-0.5 transition-all ml-auto" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
