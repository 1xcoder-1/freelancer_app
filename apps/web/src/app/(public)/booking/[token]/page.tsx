"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import {
  Clock,
  Video,
  CheckCircle2,
  AlertCircle,
} from "@/components/animated-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getPublicBooking,
  getPublicBookingSlots,
  schedulePublicBooking,
  PublicBookingConsultation,
  BookingAppointment,
} from "@/lib/api";

const SLOTS_POLL_MS = 15_000;

function fmtDay(iso: string): string {
  return new Date(`${iso}Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtTime(iso: string): string {
  return iso.slice(11, 16);
}

export default function PublicBookingPage() {
  const params = useParams();
  const token = params?.token as string;

  const [consultation, setConsultation] = useState<PublicBookingConsultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [slots, setSlots] = useState<string[]>([]);
  const [pickedDay, setPickedDay] = useState<string>("");
  const [pickedSlot, setPickedSlot] = useState<string>("");

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [confirmedAppt, setConfirmedAppt] = useState<BookingAppointment | null>(null);

  const formValues = useMemo(
    () => ({ clientName, clientEmail, notes }),
    [clientName, clientEmail, notes]
  );

  const applyDraft = useCallback((draft: Record<string, unknown>) => {
    const s = (v: unknown) => (v == null ? null : String(v));
    if (s(draft.clientName) != null) setClientName(s(draft.clientName)!);
    if (s(draft.clientEmail) != null) setClientEmail(s(draft.clientEmail)!);
    if (s(draft.notes) != null) setNotes(s(draft.notes)!);
  }, []);

  const guard = useUnsavedChangesGuard({
    values: formValues,
    enabled: !loading && !!consultation && !confirmedAppt,
    draftKey: `booking-public-${token}`,
    onRestoreDraft: applyDraft,
  });

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const data = await getPublicBooking(token);
        if (!active) return;
        setConsultation(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Consultation not found.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const loadSlots = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getPublicBookingSlots(token, 14);
      setSlots(res.slots);
    } catch {
      // Gracefully keep previous slots
    }
  }, [token]);

  useEffect(() => {
    if (!token || confirmedAppt) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching slots is the purpose of this effect
    loadSlots();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void loadSlots();
    }, SLOTS_POLL_MS);
    return () => clearInterval(id);
  }, [token, confirmedAppt, loadSlots]);

  const days = useMemo(() => {
    const set = new Set(slots.map((s) => s.slice(0, 10)));
    return Array.from(set).sort();
  }, [slots]);

  // Selection is derived so it self-heals when the 15s poll replaces the
  // slot list and the previously picked day/slot is no longer offered.
  const selectedDay = days.includes(pickedDay) ? pickedDay : (days[0] ?? "");

  const daySlots = useMemo(
    () => slots.filter((s) => s.slice(0, 10) === selectedDay),
    [slots, selectedDay]
  );

  const selectedSlot = daySlots.includes(pickedSlot) ? pickedSlot : (daySlots[0] ?? "");

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientEmail.trim() || !selectedSlot) {
      toast.error("Please pick a time and enter your details.");
      return;
    }
    setScheduling(true);
    try {
      const appt = await schedulePublicBooking(token, {
        client_name: clientName,
        client_email: clientEmail,
        appointment_time: selectedSlot,
        notes: notes || undefined,
      });
      guard.markSaved();
      setConfirmedAppt(appt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That slot was just taken. Please pick another.");
      void loadSlots();
    } finally {
      setScheduling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-xl mx-auto rounded-2xl border border-line bg-card p-6 sm:p-8 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="space-y-3 pt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4 text-fg">
        <div className="w-full max-w-md mx-auto rounded-2xl border border-line bg-card p-6 sm:p-8 text-center space-y-3 shadow-sm">
          <AlertCircle className="w-8 h-8 text-danger mx-auto" />
          <h2 className="text-lg font-bold">Consultation Unavailable</h2>
          <p className="text-xs text-muted">
            {error || "This consultation link is no longer accepting bookings."}
          </p>
        </div>
      </div>
    );
  }

  if (confirmedAppt) {
    return (
      <div className="min-h-screen bg-bg text-fg flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto rounded-2xl border border-line bg-card p-6 sm:p-8 text-center space-y-5 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-fg">Booking Confirmed</h2>
            <p className="text-xs sm:text-sm text-muted mt-1">
              {consultation.title}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface border border-line text-xs text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-muted">Date:</span>
              <span className="font-medium text-fg">{fmtDay(confirmedAppt.appointment_time)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Time:</span>
              <span className="font-mono text-accent font-medium">{fmtTime(confirmedAppt.appointment_time)} UTC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Duration:</span>
              <span className="text-fg">{consultation.duration_minutes} min</span>
            </div>
            {confirmedAppt.meeting_link && (
              <div className="flex justify-between items-center pt-2 border-t border-line">
                <span className="text-muted">Meeting:</span>
                <a
                  href={confirmedAppt.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline flex items-center gap-1 font-medium"
                >
                  <Video className="w-3.5 h-3.5" /> Join call
                </a>
              </div>
            )}
          </div>

          {confirmedAppt.token && (
            <a href={`/reschedule/${confirmedAppt.token}`} className="block text-xs text-muted hover:text-fg underline">
              Reschedule
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-fg flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl mx-auto">
        <div className="rounded-2xl border border-line bg-card p-6 sm:p-8 shadow-sm space-y-6">
          {/* Minimal Clean Header */}
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-line">
            <div className="space-y-1 flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-fg">
                {consultation.title}
              </h1>
              {consultation.description && (
                <p className="text-xs sm:text-sm text-muted">
                  {consultation.description}
                </p>
              )}
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs text-muted flex items-center justify-end gap-1">
                <Clock className="w-3 h-3 text-muted" />
                {consultation.duration_minutes} min
              </div>
            </div>
          </div>

          <form onSubmit={handleSchedule} className="space-y-5">
            {/* Date Selection */}
            {days.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted block">Select date</label>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {days.map((d) => {
                    const isSelected = selectedDay === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setPickedDay(d)}
                        className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-accent text-accent-fg border-accent"
                            : "bg-surface text-fg border-line hover:border-line-strong"
                        }`}
                      >
                        {fmtDay(d)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Time Slot Selection */}
            {daySlots.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted block">Select time</label>
                  <span className="text-[11px] text-muted font-mono">{consultation.timezone || "UTC"}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {daySlots.map((s) => {
                    const isSelected = selectedSlot === s;
                    const timeOnly = fmtTime(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setPickedSlot(s)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-mono font-medium transition-colors border text-center cursor-pointer ${
                          isSelected
                            ? "bg-accent text-accent-fg border-accent"
                            : "bg-surface text-fg border-line hover:border-accent/40"
                        }`}
                      >
                        {timeOnly}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {days.length === 0 && (
              <p className="text-xs text-muted py-4 text-center">No open slots available right now.</p>
            )}

            {/* Client Inputs */}
            <div className="space-y-3 pt-3 border-t border-line">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-fg block">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Your name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-surface border border-line text-fg text-xs sm:text-sm focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-fg block">
                    Email <span className="text-danger">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="Your email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-surface border border-line text-fg text-xs sm:text-sm focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-fg block">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="What would you like to discuss?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-surface border border-line text-fg text-xs sm:text-sm focus:border-accent focus:outline-none transition-colors resize-none"
                />
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={scheduling || !selectedSlot}
                className="w-full h-10 rounded-xl bg-accent hover:bg-accent-hi text-accent-fg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {scheduling ? (
                  "Booking..."
                ) : (
                  "Confirm Booking"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
