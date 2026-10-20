"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Pause,
  Pencil,
  Play,
  Trash2,
  Video,
} from "@/components/animated-icons";
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
import { useWorkspaceCurrency } from "@/hooks/use-workspace-currency";
import { formatMoney } from "@/lib/currency";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { DAY_LABELS } from "@/components/dashboard/booking/ConsultationForm";
import { fmtWhen, invalidateBookingCaches, STATUS_TONE } from "@/components/dashboard/booking/utils";
import { logHandledError } from "@/lib/log-error";

export default function ServiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const serviceId = String(params?.id || "");
  const { getToken } = useAuth();
  const { currency } = useWorkspaceCurrency();

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
          price: service.price,
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
  const formattedPrice =
    service.price > 0
      ? formatMoney(service.price, currency, service.price % 1 === 0 ? 0 : 2)
      : "Free";

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6 enter-stagger">
      {/* Top Navigation & Header Row */}
      <div className="space-y-4 pb-4 border-b border-line">
        <Link
          href="/dashboard/booking/services"
          className="group inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-all duration-200 active:scale-95 cursor-pointer w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-1 text-muted group-hover:text-fg" />
          <span>Back to Services</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg capitalize mr-1">
                {service.title}
              </h1>

              {/* Status Pill */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors duration-200 ${
                  service.is_active
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                    : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    service.is_active ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                  }`}
                />
                {service.is_active ? "Live" : "Paused"}
              </span>
            </div>

            {service.description && (
              <p className="text-xs sm:text-sm text-muted font-normal max-w-2xl leading-relaxed">
                {service.description}
              </p>
            )}
          </div>

          {/* Action Buttons Toolbar: 1st Pause/Resume, 2nd Copy, 3rd Preview, 4th Edit, 5th Delete */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 1. Pause / Resume */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleActive}
              disabled={toggling}
              className={`text-xs rounded-xl h-9 px-3 border border-line bg-card hover:bg-surface cursor-pointer transition-all duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.97] hover:shadow-xs group ${
                service.is_active
                  ? "text-amber-600 dark:text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/10"
                  : "text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10"
              }`}
              title={service.is_active ? "Pause bookings" : "Resume bookings"}
            >
              {service.is_active ? (
                <>
                  <Pause className="w-3.5 h-3.5 mr-1.5 transition-transform duration-200 group-hover:scale-110" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-1.5 transition-transform duration-200 group-hover:scale-110" />
                  <span>Resume</span>
                </>
              )}
            </Button>

            {/* 2. Copy */}
            <Button
              variant="outline"
              size="sm"
              onClick={copyBookingUrl}
              className="text-xs rounded-xl h-9 px-3 border border-line bg-card hover:bg-surface hover:border-accent/40 text-fg hover:text-accent cursor-pointer transition-all duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.97] hover:shadow-xs group"
              title="Copy public booking link"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-accent animate-in zoom-in-50 duration-200" />
                  <span className="text-accent font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1.5 text-muted group-hover:text-accent transition-colors duration-200 group-hover:scale-110" />
                  <span>Copy</span>
                </>
              )}
            </Button>

            {/* 3. Preview public link */}
            <a
              href={`/booking/${linkKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-line bg-card hover:bg-surface hover:border-accent/40 text-muted hover:text-accent transition-all duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.97] hover:shadow-xs shrink-0 group"
              title="Preview public booking page"
            >
              <ExternalLink className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
            </a>

            {/* 4. Edit */}
            <Link href={`/dashboard/booking/${service.id}/edit`}>
              <Button
                variant="outline"
                size="sm"
                className="text-xs rounded-xl h-9 px-3.5 border border-line bg-card hover:bg-surface hover:border-accent/40 text-fg hover:text-accent cursor-pointer transition-all duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.97] hover:shadow-xs group"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5 transition-transform duration-200 group-hover:rotate-12 group-hover:text-accent" />
                <span>Edit</span>
              </Button>
            </Link>

            {/* 5. Delete */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs rounded-xl h-9 px-2.5 text-muted hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/25 cursor-pointer transition-all duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.97] hover:shadow-xs group"
              title="Delete Service"
            >
              <Trash2 className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110 text-muted group-hover:text-danger" />
            </Button>
          </div>
        </div>
      </div>

      {/* 3 Metric Cards: Bookings, Rate (No Decimals), Duration */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Card 1: Bookings */}
        <div className="group relative p-5 rounded-2xl border border-line bg-card hover:border-line-strong hover:bg-surface/30 hover:shadow-md motion-safe:hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.04] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between gap-2">
            <h3 className="font-display text-base sm:text-lg font-medium tracking-wide text-fg leading-tight">
              Bookings
            </h3>
            <div className="p-1.5 rounded-xl bg-surface/70 border border-line/60 group-hover:border-accent/30 group-hover:bg-accent/10 transition-all duration-300">
              <CalendarDays className="w-4 h-4 text-muted group-hover:text-accent group-hover:scale-110 transition-all duration-300" />
            </div>
          </div>

          <div className="relative z-10 my-2.5">
            <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
              {service.appointments_count ?? serviceAppointments.length}
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-3 pt-1 text-xs text-muted/90 font-sans">
            <div className="flex items-center gap-1.5">
              <span>{upcomingCount} Upcoming</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0 animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5">
              <span>{completedCount} Completed</span>
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block shrink-0" />
            </div>
          </div>
        </div>

        {/* Card 2: Rate (clean integer, e.g. Rs 100) */}
        <div className="group relative p-5 rounded-2xl border border-line bg-card hover:border-line-strong hover:bg-surface/30 hover:shadow-md motion-safe:hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.04] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between gap-2">
            <h3 className="font-display text-base sm:text-lg font-medium tracking-wide text-fg leading-tight">
              Rate
            </h3>
            <div className="p-1.5 rounded-xl bg-surface/70 border border-line/60 group-hover:border-accent/30 group-hover:bg-accent/10 transition-all duration-300">
              <CreditCard className="w-4 h-4 text-muted group-hover:text-accent group-hover:scale-110 transition-all duration-300" />
            </div>
          </div>

          <div className="relative z-10 my-2.5">
            <div className="font-display text-2xl sm:text-3xl font-mono font-medium tracking-tight text-fg truncate transition-transform duration-300 group-hover:translate-x-0.5">
              {formattedPrice}
            </div>
          </div>

          <div className="relative z-10 pt-1 text-xs text-muted/90 font-sans">
            <span>Per booked consultation</span>
          </div>
        </div>

        {/* Card 3: Duration */}
        <div className="group relative p-5 rounded-2xl border border-line bg-card hover:border-line-strong hover:bg-surface/30 hover:shadow-md motion-safe:hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.04] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between gap-2">
            <h3 className="font-display text-base sm:text-lg font-medium tracking-wide text-fg leading-tight">
              Duration
            </h3>
            <div className="p-1.5 rounded-xl bg-surface/70 border border-line/60 group-hover:border-accent/30 group-hover:bg-accent/10 transition-all duration-300">
              <Clock className="w-4 h-4 text-muted group-hover:text-accent group-hover:scale-110 transition-all duration-300" />
            </div>
          </div>

          <div className="relative z-10 my-2.5">
            <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
              {service.duration_minutes}m
            </div>
          </div>

          <div className="relative z-10 pt-1 text-xs text-muted/90 font-sans">
            <span>+{service.buffer_minutes ?? 0}m buffer time</span>
          </div>
        </div>
      </div>

      {/* Main Details Grid (8 cols Main Appointments, 4 cols Clean Availability Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Booked Appointments */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4 shadow-xs transition-shadow duration-300 hover:shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-accent" />
                <h2 className="font-display text-base sm:text-lg font-medium tracking-wide text-fg">
                  Booked Appointments
                </h2>
              </div>
              <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
                {serviceAppointments.length} Total
              </Badge>
            </div>

            {serviceAppointments.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-sm text-muted">No appointments booked for this service yet.</p>
                <p className="text-xs text-faint">
                  Click &ldquo;Copy&rdquo; in the top bar to share your booking page with clients.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {serviceAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-line/70 bg-surface/30 hover:bg-surface/80 hover:border-line-strong hover:shadow-xs motion-safe:hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-fg group-hover:text-accent transition-colors duration-200">{appt.client_name}</span>
                        <Badge
                          className={`${
                            STATUS_TONE[appt.status] || "bg-surface text-muted"
                          } text-[10px] uppercase transition-transform duration-200 group-hover:scale-105`}
                        >
                          {appt.status}
                        </Badge>
                        <Badge
                          className={`text-[10px] uppercase transition-transform duration-200 group-hover:scale-105 ${
                            appt.payment_status === "paid"
                              ? "bg-ok/10 text-ok border-ok/30"
                              : "bg-surface text-muted border-line"
                          }`}
                        >
                          {appt.payment_status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted font-mono">
                        {fmtWhen(appt.appointment_time)} · {appt.client_email}
                      </div>
                    </div>

                    {appt.meeting_link && (
                      <a
                        href={appt.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg border border-line bg-card hover:bg-accent hover:border-accent hover:text-accent-fg font-medium active:scale-95 transition-all duration-200 group/btn shadow-xs self-start sm:self-auto shrink-0"
                      >
                        <Video className="w-3.5 h-3.5 text-accent group-hover/btn:text-accent-fg group-hover/btn:scale-110 transition-all duration-200" />
                        <span>Join Call</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column (4 cols): Single, Simple, Clean Availability Card */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4 shadow-xs transition-shadow duration-300 hover:shadow-sm">
            <h2 className="font-display text-base font-medium tracking-wide text-fg pb-2.5 border-b border-line">
              Availability & Details
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface/60 transition-colors duration-150">
                <span className="text-muted">Working Hours</span>
                <span className="font-mono font-medium text-fg">
                  {formatMinutesToTime(service.start_minute)} – {formatMinutesToTime(service.end_minute)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface/60 transition-colors duration-150">
                <span className="text-muted">Active Days</span>
                <span className="font-medium text-fg">
                  {activeDays.length > 0 ? activeDays.join(", ") : "None configured"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface/60 transition-colors duration-150">
                <span className="text-muted">Minimum Notice</span>
                <span className="text-fg font-medium">
                  {service.min_lead_hours ?? 1} hours before
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface/60 transition-colors duration-150">
                <span className="text-muted">Advance Booking</span>
                <span className="text-fg font-medium">
                  Up to {service.max_advance_days ?? 30} days
                </span>
              </div>

              {service.no_show_limit ? (
                <div className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface/60 transition-colors duration-150">
                  <span className="text-muted">Strike Limit</span>
                  <span className="text-fg font-medium">
                    {service.no_show_limit} missed calls
                  </span>
                </div>
              ) : null}

              <div className="pt-2.5 border-t border-line flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-surface/60 transition-colors duration-150">
                <span className="text-muted">Platform</span>
                <span className="text-fg font-medium capitalize">
                  {service.meeting_provider === "google_meet"
                    ? "Google Meet"
                    : service.meeting_provider || "Video"}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Link href={`/dashboard/booking/${service.id}/edit`} className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="group w-full text-xs rounded-xl h-9 border border-line bg-surface/50 hover:bg-accent hover:border-accent hover:text-accent-fg font-medium active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-xs"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5 transition-transform duration-200 group-hover:rotate-12" />
                  <span>Edit Schedule & Days Off</span>
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
