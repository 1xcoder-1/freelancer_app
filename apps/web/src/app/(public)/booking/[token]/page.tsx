"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import {
  Clock,
  Video,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
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

function buildGoogleCalendarUrl({
  title,
  startTimeIso,
  durationMinutes = 30,
  details = "",
  location = "",
}: {
  title: string;
  startTimeIso: string;
  durationMinutes?: number;
  details?: string;
  location?: string;
}): string {
  const cleanIso = startTimeIso.endsWith("Z") ? startTimeIso : `${startTimeIso}Z`;
  const start = new Date(cleanIso);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const formatUtc = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatUtc(start)}/${formatUtc(end)}`,
  });

  if (details) params.set("details", details);
  if (location) params.set("location", location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
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

  const dateScrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingDates, setIsDraggingDates] = useState(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const hasDragged = useRef(false);

  const handleDateMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !dateScrollRef.current) return;
    setIsDraggingDates(true);
    hasDragged.current = false;
    dragStartX.current = e.pageX;
    dragScrollLeft.current = dateScrollRef.current.scrollLeft;
  };

  useEffect(() => {
    if (!isDraggingDates) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!dateScrollRef.current) return;
      const walk = (e.pageX - dragStartX.current) * 1.3;
      if (Math.abs(walk) > 4) {
        hasDragged.current = true;
      }
      dateScrollRef.current.scrollLeft = dragScrollLeft.current - walk;
    };
    const onMouseUp = () => {
      setIsDraggingDates(false);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDraggingDates]);

  const handleDateWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!dateScrollRef.current) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      dateScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  const scrollDates = (dir: "left" | "right") => {
    if (!dateScrollRef.current) return;
    const amount = dir === "left" ? -220 : 220;
    dateScrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

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

  useEffect(() => {
    if (!token) return;
    try {
      const cached = sessionStorage.getItem(`booking_confirmed_${token}`);
      if (cached) {
        const parsed = JSON.parse(cached) as BookingAppointment;
        if (parsed && parsed.appointment_time && parsed.token) {
          setConfirmedAppt(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
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
      try {
        sessionStorage.setItem(`booking_confirmed_${token}`, JSON.stringify(appt));
      } catch {
        // ignore
      }
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
      <div className="min-h-screen bg-bg flex items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent/4 blur-[120px] rounded-full -z-10" />
        <div className="w-full max-w-xl mx-auto rounded-3xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/30 p-6 sm:p-8 space-y-5 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 rounded-xl" />
            <Skeleton className="h-4 w-72 rounded-lg" />
          </div>
          <div className="space-y-4 pt-4 border-t border-line/60">
            <Skeleton className="h-10 w-full rounded-xl" />
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-10 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-11 w-full rounded-xl pt-2" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div className="min-h-screen bg-bg text-fg flex items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent/4 blur-[120px] rounded-full -z-10" />
        <div className="relative w-full max-w-md mx-auto rounded-3xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/30 p-8 text-center space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
          <div className="w-12 h-12 rounded-2xl bg-danger/10 border border-danger/25 text-danger flex items-center justify-center mx-auto shadow-2xs">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-medium tracking-tight text-fg">Consultation Unavailable</h2>
            <p className="text-xs sm:text-sm text-muted max-w-sm mx-auto leading-relaxed">
              {error || "This consultation link is no longer accepting bookings."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (confirmedAppt) {
    return (
      <div className="min-h-screen bg-bg text-fg flex items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-accent/30 selection:text-white">
        {/* Ambient Top Glow */}
        <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[120px] rounded-full -z-10" />

        <div className="relative w-full max-w-md mx-auto rounded-3xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/30 p-7 sm:p-8 text-center space-y-6 shadow-[0_25px_60px_rgba(0,0,0,0.45),0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)] overflow-hidden">
          {/* Subtle Ambient Orb */}
          <div className="absolute -right-12 -top-12 w-36 h-36 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_16px_rgba(16,185,129,0.15)] animate-in zoom-in-75 duration-300">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-medium tracking-tight text-fg">Booking Confirmed!</h2>
            <p className="text-xs sm:text-sm text-muted capitalize">
              {consultation.title}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface/60 border border-line/70 text-xs text-left space-y-2.5 shadow-inner">
            <div className="flex justify-between items-center">
              <span className="text-muted">Date:</span>
              <span className="font-medium text-fg">{fmtDay(confirmedAppt.appointment_time)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Time:</span>
              <span className="font-mono text-accent font-semibold">{fmtTime(confirmedAppt.appointment_time)} UTC</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Duration:</span>
              <span className="text-fg font-medium">{consultation.duration_minutes} min</span>
            </div>
            <div className="pt-2.5 border-t border-line/60 space-y-2">
              {confirmedAppt.meeting_link && (
                <a
                  href={confirmedAppt.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-9 rounded-xl font-medium text-xs text-white bg-accent hover:bg-accent-hi shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5 text-white" />
                  <span>Join Video Call</span>
                </a>
              )}
              <a
                href={buildGoogleCalendarUrl({
                  title: `${consultation.title || "Consultation"}`,
                  startTimeIso: confirmedAppt.appointment_time,
                  durationMinutes: consultation.duration_minutes || 30,
                  details: confirmedAppt.meeting_link
                    ? `Consultation: ${consultation.title}\nVideo Call: ${confirmedAppt.meeting_link}`
                    : `Consultation: ${consultation.title}`,
                  location: confirmedAppt.meeting_link || "Online",
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-9 rounded-xl font-medium text-xs text-fg/90 bg-surface/80 hover:bg-surface-elevated hover:text-fg border border-line/80 hover:border-line-strong shadow-2xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <CalendarDays className="w-3.5 h-3.5 text-accent" />
                <span>Add to Google Calendar</span>
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            {confirmedAppt.token && (
              <a
                href={`/reschedule/${confirmedAppt.token}`}
                className="text-muted hover:text-fg underline underline-offset-4 transition-colors cursor-pointer"
              >
                Need to reschedule?
              </a>
            )}
            <span className="text-line/80">•</span>
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.removeItem(`booking_confirmed_${token}`);
                } catch {
                  // ignore
                }
                setConfirmedAppt(null);
                void loadSlots();
              }}
              className="text-muted hover:text-fg underline underline-offset-4 transition-colors cursor-pointer"
            >
              Book another appointment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-fg flex items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-hidden selection:bg-accent/30 selection:text-white">
      {/* Ambient Top Glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent/4 blur-[120px] rounded-full -z-10" />

      <div className="relative w-full max-w-xl mx-auto rounded-3xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/25 p-6 sm:p-8 md:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.4),0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm overflow-hidden space-y-6 animate-in fade-in duration-300">
        {/* Ambient Top-Right Orb */}
        <div className="absolute -right-16 -top-16 w-44 h-44 rounded-full bg-accent/4 blur-3xl pointer-events-none" />

        {/* Header Section */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-line/60">
          <div className="space-y-1.5 flex-1 min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-fg capitalize leading-snug">
              {consultation.title}
            </h1>
            {consultation.description && (
              <p className="text-xs sm:text-sm text-muted/90 font-normal leading-relaxed max-w-md">
                {consultation.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:self-start shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium text-muted bg-surface/80 border border-line/80 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span>{consultation.duration_minutes} min</span>
            </span>
          </div>
        </div>

        <form onSubmit={handleSchedule} className="relative z-10 space-y-5">
          {/* Date Selection */}
          {days.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-mono capitalize tracking-wide text-muted font-medium">
                  <CalendarDays className="w-3.5 h-3.5 text-accent" />
                  <span>Select Date</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted/80">{days.length} available</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => scrollDates("left")}
                      className="p-1 rounded-lg text-muted hover:text-fg hover:bg-surface border border-line/60 transition-colors cursor-pointer"
                      title="Scroll left"
                      aria-label="Scroll left"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollDates("right")}
                      className="p-1 rounded-lg text-muted hover:text-fg hover:bg-surface border border-line/60 transition-colors cursor-pointer"
                      title="Scroll right"
                      aria-label="Scroll right"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
              <div
                ref={dateScrollRef}
                onMouseDown={handleDateMouseDown}
                onWheel={handleDateWheel}
                className={`flex gap-2 overflow-x-auto pb-1.5 pt-0.5 select-none scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
                  isDraggingDates ? "cursor-grabbing" : "cursor-grab"
                }`}
              >
                {days.map((d) => {
                  const isSelected = selectedDay === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        if (!hasDragged.current) {
                          setPickedDay(d);
                        }
                      }}
                      className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-medium border transition-all duration-150 select-none active:scale-95 cursor-pointer ${
                        isSelected
                          ? "bg-accent hover:bg-accent-hi text-white font-semibold border-accent/50 shadow-sm"
                          : "bg-surface/70 hover:bg-surface-elevated text-fg/80 hover:text-fg border-line/70 hover:border-line-strong hover:shadow-2xs"
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
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-mono capitalize tracking-wide text-muted font-medium">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  <span>Select Time</span>
                </label>
                <span className="text-[11px] text-muted font-mono bg-surface/80 px-2.5 py-0.5 rounded-md border border-line/60">
                  {consultation.timezone || "UTC"}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-0.5">
                {daySlots.map((s) => {
                  const isSelected = selectedSlot === s;
                  const timeOnly = fmtTime(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPickedSlot(s)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-mono transition-all duration-150 border text-center cursor-pointer select-none active:scale-95 ${
                        isSelected
                          ? "bg-accent text-white font-semibold border-accent/50 shadow-sm"
                          : "bg-surface/60 hover:bg-surface-elevated border-line/70 hover:border-line-strong text-fg/90 hover:text-fg font-medium hover:shadow-2xs"
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
            <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-line/60 bg-surface/30 space-y-2">
              <CalendarDays className="w-6 h-6 text-faint mx-auto" />
              <p className="text-xs text-muted">No open slots available right now.</p>
            </div>
          )}

          {/* Client Inputs */}
          <div className="space-y-3.5 pt-4 border-t border-line/60">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg flex items-center gap-1">
                  <span>Name</span>
                  <span className="text-accent font-semibold">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Your name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-surface/60 border border-line/80 text-fg text-xs sm:text-sm placeholder:text-muted/50 focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/20 transition-all outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg flex items-center gap-1">
                  <span>Email</span>
                  <span className="text-accent font-semibold">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="your.email@example.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-surface/60 border border-line/80 text-fg text-xs sm:text-sm placeholder:text-muted/50 focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/20 transition-all outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg block">Notes (optional)</label>
              <textarea
                rows={3}
                placeholder="What would you like to discuss?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 rounded-xl bg-surface/60 border border-line/80 text-fg text-xs sm:text-sm placeholder:text-muted/50 focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/20 transition-all outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] resize-none scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={scheduling || !selectedSlot}
              className="press w-full h-11 rounded-xl font-medium text-sm text-white bg-accent hover:bg-accent-hi border border-accent/40 shadow-sm transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scheduling ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Confirming Booking...</span>
                </>
              ) : (
                <span>Confirm Booking</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

