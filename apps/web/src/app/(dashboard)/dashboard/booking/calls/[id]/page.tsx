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
  ExternalLink,
  Phone,
  Trash2,
  Users,
  Video,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { StatCard } from "@/components/dashboard/patterns";
import {
  getBookingAppointments,
  setAppointmentStatus,
  type BookingAppointment,
} from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { fmtWhen, invalidateBookingCaches, STATUS_TONE } from "@/components/dashboard/booking/utils";
import { logHandledError } from "@/lib/log-error";

export default function CallDetailPage() {
  const router = useRouter();
  const params = useParams();
  const callId = String(params?.id || "");
  const { getToken } = useAuth();

  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Fetch appointments for this workspace
  const { data: appointmentsData, loading, refresh } = useApiData(
    "booking:appointments:all",
    async (token) => getBookingAppointments(undefined, token).catch(() => []),
    { reportContext: "call-detail", pollMs: 15_000 }
  );

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
  const appt = allAppointments.find((a) => a.id === callId);

  const copyRescheduleLink = () => {
    if (!appt?.token) return;
    const url = `${window.location.origin}/reschedule/${appt.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Reschedule link copied to clipboard");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleStatusChange = async (next: "confirmed" | "cancelled" | "no_show" | "completed") => {
    if (!appt) return;
    if (next === "no_show") {
      const ok = await confirmDialog({
        title: "Mark as no-show",
        message: "This counts as a missed call against this person's strike limit.",
        confirmLabel: "Mark no-show",
        danger: true,
      });
      if (!ok) return;
    }
    setUpdating(true);
    try {
      const token = (await getToken()) || undefined;
      await setAppointmentStatus(appt.id, next, token);
      invalidateBookingCaches();
      toast.success(next === "completed" ? "Call marked as completed" : `Call ${next}`);
      await refresh();
    } catch (err) {
      logHandledError(err);
      toast.error(err instanceof Error ? err.message : "Could not update the call");
    } finally {
      setUpdating(false);
    }
  };

  if (loading && allAppointments.length === 0) {
    return (
      <div className="space-y-6 animate-pulse enter-stagger">
        <Skeleton className="h-5 w-32 rounded-lg" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-9 w-40 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!loading && !appt) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard/booking"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Calls</span>
          </Link>
        </div>
        <Card className="bg-card border-dashed border-line rounded-2xl p-12 text-center">
          <Phone className="w-12 h-12 text-faint mx-auto mb-3" />
          <h3 className="font-display text-lg font-medium text-fg mb-1">Call not found</h3>
          <p className="text-muted text-sm max-w-sm mx-auto mb-4">
            The booked call or consultation you are looking for does not exist or may have been removed.
          </p>
          <Link href="/dashboard/booking">
            <Button size="sm" variant="outline" className="border-line text-fg">
              Return to Calls
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (!appt) return null;

  const apptDate = new Date(appt.appointment_time);
  const timeFormatted = !isNaN(apptDate.getTime())
    ? apptDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : appt.appointment_time;
  const dateFormatted = !isNaN(apptDate.getTime())
    ? apptDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })
    : "Scheduled";

  return (
    <div className="space-y-6 enter-stagger">
      {/* Top back navigation */}
      <div>
        <Link
          href="/dashboard/booking"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors mb-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Calls</span>
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge className={`${STATUS_TONE[appt.status] || "bg-surface text-muted border-line"} text-[10px] uppercase font-bold tracking-wide`}>
              {appt.status}
            </Badge>
            {appt.no_show && (
              <Badge className="bg-danger/10 text-danger border-danger/30 text-[10px] uppercase font-bold tracking-wide">
                No-Show
              </Badge>
            )}
            {appt.reschedule_count > 0 && (
              <span className="text-[11px] text-muted font-mono">
                Rescheduled {appt.reschedule_count}×
              </span>
            )}
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            {appt.client_name}
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-0.5">
            {appt.consultation_title || "Consultation Call"}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {appt.meeting_link && (
            <a href={appt.meeting_link} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-xs">
                <Video className="w-3.5 h-3.5 mr-1.5" />
                Join Meeting
              </Button>
            </a>
          )}

          {appt.token && (
            <Button
              size="sm"
              variant="outline"
              onClick={copyRescheduleLink}
              className="border-line text-fg hover:bg-surface"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-accent" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
              {copied ? "Copied" : "Reschedule Link"}
            </Button>
          )}

          {["pending", "confirmed"].includes(appt.status) && (
            <div className="flex items-center gap-1.5">
              {appt.status === "pending" && (
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("confirmed")}
                  disabled={updating}
                  className="bg-accent-soft text-accent border border-accent/30 hover:bg-accent/20"
                >
                  Confirm
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => handleStatusChange("completed")}
                disabled={updating}
                className="bg-ok/10 text-ok border border-ok/30 hover:bg-ok/20"
              >
                Complete
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange("no_show")}
                disabled={updating}
                className="border-danger/30 text-danger hover:bg-danger/10"
              >
                No-show
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange("cancelled")}
                disabled={updating}
                className="border-line text-muted hover:text-fg"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 4 Overview Headline Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          label="Scheduled Time"
          value={timeFormatted}
          icon={Clock}
          subtext={dateFormatted}
        />
        <StatCard
          label="Client Info"
          value={appt.client_name}
          icon={Users}
          subtext={appt.client_email}
          href={appt.client_id ? `/dashboard/clients/${appt.client_id}` : undefined}
          rows={appt.client_id ? [{ text: "View client profile", dot: "info", href: `/dashboard/clients/${appt.client_id}` }] : undefined}
        />
        <StatCard
          label="Service / Type"
          value={appt.consultation_title || "Consultation"}
          icon={CalendarDays}
          subtext="Bookable service"
          href={appt.consultation_id ? `/dashboard/booking/${appt.consultation_id}` : undefined}
          rows={appt.consultation_id ? [{ text: "View service settings", dot: "ok", href: `/dashboard/booking/${appt.consultation_id}` }] : undefined}
        />
        <StatCard
          label="Meeting Channel"
          value={appt.meeting_link ? "Google Meet" : "Phone Call"}
          icon={Video}
          subtext={appt.meeting_link ? "Video link available" : "Direct phone session"}
          rows={appt.meeting_link ? [{ text: "Open call link", dot: "info" }] : undefined}
        />
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Meeting Notes & Agenda */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-line rounded-2xl p-6">
            <h3 className="font-display text-base font-semibold text-fg mb-3 flex items-center gap-2">
              <Phone className="w-4 h-4 text-accent" />
              <span>Call Agenda & Client Notes</span>
            </h3>

            {appt.notes ? (
              <div className="bg-surface/60 rounded-xl p-4 border border-line text-sm text-fg leading-relaxed whitespace-pre-wrap">
                {appt.notes}
              </div>
            ) : (
              <div className="text-center py-8 text-muted text-xs">
                No extra notes or questions submitted with this booking.
              </div>
            )}
          </Card>

          {/* Quick Shortcuts */}
          <Card className="bg-card border-line rounded-2xl p-6">
            <h3 className="font-display text-base font-semibold text-fg mb-4">Quick Shortcuts</h3>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/dashboard/calendar">
                <Button size="sm" variant="outline" className="border-line text-fg hover:bg-surface">
                  <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-accent" />
                  Open in Calendar
                </Button>
              </Link>
              {appt.client_id && (
                <Link href={`/dashboard/clients/${appt.client_id}`}>
                  <Button size="sm" variant="outline" className="border-line text-fg hover:bg-surface">
                    <Users className="w-3.5 h-3.5 mr-1.5 text-accent" />
                    Open Client Roster
                  </Button>
                </Link>
              )}
              {appt.consultation_id && (
                <Link href={`/dashboard/booking/${appt.consultation_id}`}>
                  <Button size="sm" variant="outline" className="border-line text-fg hover:bg-surface">
                    <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-accent" />
                    Manage Service
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Appointment Metadata Card */}
        <div className="space-y-6">
          <Card className="bg-card border-line rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-fg">Call Metadata</h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-line">
                <span className="text-muted">Status</span>
                <span className="font-semibold text-fg capitalize">{appt.status}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-line">
                <span className="text-muted">Client Email</span>
                <span className="font-mono text-fg">{appt.client_email}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-line">
                <span className="text-muted">Booked At</span>
                <span className="font-mono text-fg">
                  {new Date(appt.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-line">
                <span className="text-muted">Reschedule Count</span>
                <span className="font-mono text-fg">{appt.reschedule_count}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted">Missed / No-Show</span>
                <span className={`font-semibold ${appt.no_show ? "text-danger" : "text-ok"}`}>
                  {appt.no_show ? "Yes" : "No"}
                </span>
              </div>
            </div>

            {appt.meeting_link && (
              <div className="pt-2">
                <a
                  href={appt.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs transition-colors shadow-xs"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Join Meeting Room</span>
                </a>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
