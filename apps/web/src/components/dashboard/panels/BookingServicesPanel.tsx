"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Pause,
  PenLine,
  Phone,
  Play,
  Plus,
  Trash2,
  Users,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { deleteBooking, updateBooking, BookingConsultation } from "@/lib/api";
import { invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { ServiceDaysOffEditor } from "@/components/dashboard/booking/ServiceDaysOffEditor";
import { DAY_LABELS } from "@/components/dashboard/booking/ConsultationForm";
import { invalidateBookingCaches } from "@/components/dashboard/booking/utils";

/* Services grid — what clients can book. Days off live inside each card, so a
   service and its exceptions stay on one screen. */
export function BookingServicesPanel({
  consultations,
  loading,
}: {
  consultations: BookingConsultation[];
  loading: boolean;
}) {
  const { getToken } = useAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openDaysOffId, setOpenDaysOffId] = useState<string | null>(null);

  const copyLink = (item: BookingConsultation) => {
    const key = item.token || item.id;
    navigator.clipboard.writeText(`${window.location.origin}/booking/${key}`);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDelete = async (item: BookingConsultation) => {
    const ok = await confirmDialog({
      title: "Delete service",
      message: `"${item.title}" will be removed. Clients can no longer book it.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteBooking(item.id, token);
      invalidateCache("dashboard:data");
      invalidateBookingCaches();
      toast.success("Service deleted");
    } catch (err) {
      console.error("Failed to delete booking:", err);
      toast.error("Could not delete service");
    }
  };

  const toggleActive = async (item: BookingConsultation) => {
    try {
      const token = (await getToken()) || undefined;
      await updateBooking(item.id, {
        title: item.title,
        description: item.description,
        duration_minutes: item.duration_minutes,
        price: item.price,
        meeting_provider: item.meeting_provider || "google_meet",
        is_active: !item.is_active,
        weekday_mask: item.weekday_mask,
        start_minute: item.start_minute,
        end_minute: item.end_minute,
        timezone: item.timezone,
        min_lead_hours: item.min_lead_hours,
        max_advance_days: item.max_advance_days,
        buffer_minutes: item.buffer_minutes,
        intake_form_id: item.intake_form_id,
        no_show_limit: item.no_show_limit,
      }, token);
      invalidateBookingCaches();
      toast.success(item.is_active ? "Service paused" : "Service is live again");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update service");
    }
  };

  if (loading && consultations.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-[220px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
        ))}
      </div>
    );
  }

  if (consultations.length === 0) {
    return (
      <Card className="bg-card border-dashed border-line rounded-2xl p-12 text-center">
        <Phone className="w-12 h-12 text-faint mx-auto mb-4" />
        <h3 className="font-display text-lg font-medium text-fg mb-1">No services yet</h3>
        <p className="text-muted text-sm max-w-md mx-auto mb-6">
          A service is the thing a client books — a paid strategy session, a free discovery call.
          Create one and you get a public link with conflict-free times.
        </p>
        <Link
          href="/dashboard/booking/new"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-sm shadow-xs active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Create your first service
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {consultations.map((item) => {
        const openDays = DAY_LABELS.filter((_, i) => item.weekday_mask?.[i] === "1").join(" ") || "—";
        const hours = `${String(item.start_minute / 60).padStart(2, "0")}:${String(item.start_minute % 60).padStart(2, "0")}–${String(Math.floor(item.end_minute / 60)).padStart(2, "0")}:${String(item.end_minute % 60).padStart(2, "0")}`;
        const linkKey = item.token || item.id;
        const daysOffOpen = openDaysOffId === item.id;

        return (
          <SpotlightCard
            key={item.id}
            radius={380}
            className="flex flex-col rounded-2xl border border-line bg-card p-5 transition-colors duration-300 hover:border-line-strong"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[15px] font-semibold text-fg">{item.title}</h3>
                  {!item.is_active && (
                    <span className="shrink-0 rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-faint">
                      paused
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted line-clamp-2">
                  {item.description || "Client 1-on-1 consultation session."}
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-accent-soft px-2.5 py-1 font-mono text-sm font-semibold text-accent">
                {item.price > 0 ? `$${item.price.toFixed(2)}` : "Free"}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1">
                <Clock className="w-3 h-3 text-info" /> {item.duration_minutes} min
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1">
                <CalendarDays className="w-3 h-3 text-info" /> {openDays}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 font-mono">
                {hours}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1">
                <Users className="w-3 h-3 text-info" /> {item.appointments_count} booked
              </span>
            </div>

            {item.price > 0 && (
              <p className="mt-3 text-[11px] text-warn">Paid — the call confirms once payment lands.</p>
            )}

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/dashboard/booking/${item.id}/edit`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-bg px-2.5 text-xs text-fg transition-colors hover:bg-surface"
                >
                  <PenLine className="w-3.5 h-3.5" /> Edit
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyLink(item)}
                  className="h-8 gap-1.5 px-2.5 text-xs text-muted hover:bg-surface hover:text-fg"
                  title="Copy booking link"
                >
                  {copiedId === linkKey ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedId === linkKey ? "Copied" : "Copy link"}
                </Button>
                <a
                  href={`/booking/${linkKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-bg text-muted transition-colors hover:bg-surface hover:text-fg"
                  title="Open public booking page"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleActive(item)}
                  className="h-8 w-8 p-0 text-faint hover:bg-surface hover:text-fg"
                  title={item.is_active ? "Pause bookings" : "Resume bookings"}
                >
                  {item.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(item)}
                  className="h-8 w-8 p-0 text-faint hover:bg-danger/10 hover:text-danger"
                  title="Delete service"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="mt-3 border-t border-line/60 pt-3">
              <button
                type="button"
                onClick={() => setOpenDaysOffId(daysOffOpen ? null : item.id)}
                className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-fg"
              >
                {daysOffOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Days off
              </button>
              {daysOffOpen && (
                <div className="mt-3">
                  <ServiceDaysOffEditor consultationId={item.id} />
                </div>
              )}
            </div>
          </SpotlightCard>
        );
      })}
    </div>
  );
}
