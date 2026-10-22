"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, Phone, Video } from "@/components/animated-icons";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { setAppointmentStatus, BookingAppointment } from "@/lib/api";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { fmtWhen, invalidateBookingCaches, STATUS_TONE } from "@/components/dashboard/booking/utils";

/* The Calls side of the module: every appointment a client took, with the
   outcome controls. */
export function BookingCallsPanel({
  appointments,
  loading,
}: {
  appointments: BookingAppointment[];
  loading: boolean;
}) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const changeStatus = async (appt: BookingAppointment, next: "confirmed" | "cancelled" | "no_show" | "completed") => {
    if (next === "no_show") {
      const ok = await confirmDialog({
        title: "Mark as no-show",
        message: "This counts as a missed call against this person's strike limit.",
        confirmLabel: "Mark no-show",
        danger: true,
      });
      if (!ok) return;
    }
    try {
      const token = (await getToken()) || undefined;
      await setAppointmentStatus(appt.id, next, token);
      invalidateBookingCaches();
      toast.success(next === "completed" ? "Call completed — client record created" : "Call updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the call");
    }
  };

  if (loading && appointments.length === 0) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[120px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
        ))}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <Card className="bg-card border-dashed border-line rounded-2xl p-12 text-center">
        <Phone className="w-12 h-12 text-faint mx-auto mb-3" />
        <h3 className="font-display text-lg font-medium text-fg mb-1">No calls booked yet</h3>
        <p className="text-muted text-sm max-w-sm mx-auto">
          Share a service link and the bookings land here with live status and a meeting link.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((appt) => (
        <SpotlightCard
          key={appt.id}
          radius={420}
          onClick={() => router.push(`/dashboard/booking/calls/${appt.id}`)}
          className="rounded-2xl border border-line bg-card p-5 transition-all duration-200 hover:border-accent/50 hover:shadow-md cursor-pointer group"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-[15px] font-semibold text-fg group-hover:text-accent transition-colors flex items-center gap-1.5">
                  {appt.client_name}
                  <ChevronRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </h4>
                <Badge className={`${STATUS_TONE[appt.status] || "bg-surface text-muted border-line"} text-[10px] uppercase`}>
                  {appt.status}
                </Badge>
                {appt.no_show && <Badge className="bg-danger/10 text-danger border-danger/30 text-[10px] uppercase">no-show</Badge>}
              </div>

              <p className="text-xs text-fg font-mono">
                {fmtWhen(appt.appointment_time)}
                <span className="text-muted"> · {appt.consultation_title}</span>
              </p>
              <p className="text-xs text-muted">{appt.client_email}</p>

              {appt.notes && (
                <p className="text-xs text-muted italic line-clamp-1">&ldquo;{appt.notes}&rdquo;</p>
              )}
              {appt.reschedule_count > 0 && (
                <p className="text-[11px] text-faint">Rescheduled {appt.reschedule_count}×</p>
              )}
            </div>

            <div
              className="flex shrink-0 flex-col items-start gap-2 lg:items-end"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap gap-1.5">
                {appt.meeting_link && (
                  <a
                    href={appt.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-fg hover:text-accent hover:border-accent/40 transition-colors"
                  >
                    <Video className="w-3 h-3" /> Join
                  </a>
                )}
                {appt.token && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copy(appt.id, `${window.location.origin}/reschedule/${appt.token}`);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-muted transition-colors hover:text-fg"
                  >
                    {copiedKey === appt.id && <CheckCircle2 className="w-3 h-3 text-accent" />}
                    {copiedKey === appt.id ? "Copied" : "Reschedule link"}
                  </button>
                )}
              </div>

              {["pending", "confirmed"].includes(appt.status) && (
                <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {appt.status === "pending" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        changeStatus(appt, "confirmed");
                      }}
                      className="rounded-lg border border-accent/30 bg-accent-soft px-2.5 py-1 text-xs text-accent cursor-pointer hover:bg-accent/20"
                    >
                      Confirm
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      changeStatus(appt, "completed");
                    }}
                    className="rounded-lg border border-ok/30 bg-ok/10 px-2.5 py-1 text-xs text-ok cursor-pointer hover:bg-ok/20"
                  >
                    Complete
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      changeStatus(appt, "no_show");
                    }}
                    className="rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1 text-xs text-danger cursor-pointer hover:bg-danger/20"
                  >
                    No-show
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      changeStatus(appt, "cancelled");
                    }}
                    className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-muted cursor-pointer hover:text-fg"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </SpotlightCard>
      ))}
    </div>
  );
}
