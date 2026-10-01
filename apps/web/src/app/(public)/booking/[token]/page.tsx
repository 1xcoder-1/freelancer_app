"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User,
  FileText,
  RefreshCw,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getPublicBooking,
  getPublicBookingSlots,
  schedulePublicBooking,
  PublicBookingConsultation,
  BookingAppointment,
} from "@/lib/api";

// Re-opened slots are polled on this cadence so a slot a second client just
// took disappears before this visitor can click it (B1).
const SLOTS_POLL_MS = 15_000;

function fmtDay(iso: string): string {
  // Server times are naive UTC; append Z so the weekday label is truthful.
  return new Date(`${iso}Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtTime(iso: string): string {
  return `${iso.slice(11, 16)} UTC`;
}

export default function PublicBookingPage() {
  const params = useParams();
  const token = params?.token as string;

  const [consultation, setConsultation] = useState<PublicBookingConsultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // B1/B2: live, server-computed conflict-free slots.
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsRefreshing, setSlotsRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [confirmedAppt, setConfirmedAppt] = useState<BookingAppointment | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const data = await getPublicBooking(token);
        if (!active) return;
        setConsultation(data);
      } catch (err: any) {
        if (active) setError(err.message || "Consultation not found.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const loadSlots = useCallback(async (manual = false) => {
    if (!token) return;
    if (manual) setSlotsRefreshing(true);
    try {
      const res = await getPublicBookingSlots(token, 14);
      setSlots(res.slots);
    } catch {
      // Graceful: keep the last known slots rather than blanking the picker.
    } finally {
      setSlotsRefreshing(false);
    }
  }, [token]);

  // Poll open slots every 15s (B1). Stops once an appointment is confirmed.
  useEffect(() => {
    if (!token || confirmedAppt) return;
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

  // Keep a valid day/slot selected as the live slot list changes.
  useEffect(() => {
    if (days.length === 0) {
      setSelectedDay("");
      setSelectedSlot("");
      return;
    }
    if (!days.includes(selectedDay)) setSelectedDay(days[0]);
  }, [days, selectedDay]);

  const daySlots = useMemo(
    () => slots.filter((s) => s.slice(0, 10) === selectedDay),
    [slots, selectedDay]
  );

  useEffect(() => {
    if (daySlots.length === 0) {
      setSelectedSlot("");
    } else if (!daySlots.includes(selectedSlot)) {
      setSelectedSlot(daySlots[0]);
    }
  }, [daySlots, selectedSlot]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientEmail.trim() || !selectedSlot) {
      toast.error("Pick a time and add your details first.");
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
      setConfirmedAppt(appt);
    } catch (err: any) {
      const msg = err?.message || "That slot was just taken. Please pick another.";
      toast.error(msg);
      // A 409 (race) means the list is stale — refresh immediately.
      void loadSlots(true);
    } finally {
      setScheduling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Card className="w-full max-w-xl bg-card border-line p-8 space-y-6">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <div className="space-y-4 pt-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4 text-fg">
        <Card className="w-full max-w-md bg-card border-line p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-danger mx-auto" />
          <h2 className="text-xl font-bold">Consultation Link Unavailable</h2>
          <p className="text-sm text-muted">
            {error || "This consultation calendar link is invalid or no longer accepting bookings."}
          </p>
        </Card>
      </div>
    );
  }

  if (confirmedAppt) {
    const needsPayment = confirmedAppt.payment_status === "unpaid" && confirmedAppt.invoice_token;
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4 text-fg">
        <Card className="w-full max-w-lg bg-card border-line p-8 text-center space-y-6 shadow-2xl backdrop-blur-xl">
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center mx-auto border ${
            needsPayment ? "bg-warn/10 text-warn border-warn/30" : "bg-accent-soft text-accent border-accent"
          }`}>
            {needsPayment ? <CreditCard className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-fg">
              {needsPayment ? "Almost booked — payment required" : "Appointment Confirmed!"}
            </h2>
            <p className="text-sm text-fg mt-1">
              {needsPayment
                ? "Your slot is held. Complete payment to confirm the call."
                : <>You&apos;re scheduled for <span className="text-info font-semibold">{consultation.title}</span> with {consultation.freelancer_name}</>}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-bg border border-line text-xs text-fg text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-faint">Date:</span>
              <span className="font-mono text-fg font-semibold">{fmtDay(confirmedAppt.appointment_time)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">Time:</span>
              <span className="font-mono text-info font-semibold">{fmtTime(confirmedAppt.appointment_time)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">Duration:</span>
              <span className="text-fg">{consultation.duration_minutes} Minutes</span>
            </div>
            {confirmedAppt.meeting_link && (
              <div className="flex justify-between items-center pt-2 border-t border-line">
                <span className="text-faint">Video Call:</span>
                <a href={confirmedAppt.meeting_link} target="_blank" rel="noopener noreferrer"
                  className="text-info hover:underline flex items-center gap-1 font-semibold">
                  <Video className="w-3.5 h-3.5" /> Join Call
                </a>
              </div>
            )}
          </div>

          {needsPayment && (
            <a href={`/pay/${confirmedAppt.invoice_token}`} className="block">
              <Button className="w-full bg-accent hover:bg-accent-hi text-accent-fg font-semibold">
                <CreditCard className="w-4 h-4 mr-2" />
                Pay ${consultation.price.toFixed(2)} to confirm
              </Button>
            </a>
          )}

          {confirmedAppt.token && (
            <a href={`/reschedule/${confirmedAppt.token}`} className="block text-xs text-muted hover:text-fg underline">
              Need to move this? Reschedule online
            </a>
          )}

          <p className="text-xs text-faint">
            A confirmation invite has been dispatched to <span className="text-fg font-mono">{confirmedAppt.client_email}</span>.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col justify-between p-4 sm:p-8">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Header Banner */}
        <Card className="bg-card border-line p-6 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Badge className="bg-info/10 text-info border-info/20 font-mono text-xs mb-2">
                1-on-1 Consultation
              </Badge>
              <h1 className="text-2xl sm:text-3xl font-bold text-fg">{consultation.title}</h1>
              {consultation.description && (
                <p className="text-muted text-xs sm:text-sm mt-1">{consultation.description}</p>
              )}
            </div>

            <div className="text-left sm:text-right font-mono shrink-0">
              <div className="text-2xl font-black text-accent">
                {consultation.price > 0 ? `$${consultation.price.toFixed(2)}` : "Free"}
              </div>
              <div className="text-xs text-muted flex items-center sm:justify-end gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-info" />
                {consultation.duration_minutes} Mins
              </div>
            </div>
          </div>
        </Card>

        {/* B5: pre-call intake link */}
        {consultation.intake_token && (
          <a href={`/intake/${consultation.intake_token}`}
            className="flex items-center gap-2 text-xs text-info hover:underline px-1">
            <FileText className="w-4 h-4" />
            Please complete the short intake form before your call.
          </a>
        )}

        {consultation.requires_payment && (
          <p className="text-xs text-warn px-1">
            This is a paid consultation — the slot is only confirmed once payment clears.
          </p>
        )}

        {/* Schedule Form */}
        <Card className="bg-card border-line shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSchedule}>
            <CardContent className="space-y-6 pt-6">
              {/* Date & Time Slot Selection (live) */}
              <div className="space-y-4 pb-4 border-b border-line">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-fg uppercase tracking-wider flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-info" /> 1. Pick an open time
                  </h3>
                  <button type="button" onClick={() => loadSlots(true)}
                    className="text-xs text-muted hover:text-fg inline-flex items-center gap-1" title="Refresh slots">
                    <RefreshCw className={`w-3.5 h-3.5 ${slotsRefreshing ? "animate-spin" : ""}`} />
                    Live
                  </button>
                </div>

                {days.length === 0 ? (
                  <p className="text-sm text-muted py-4">No open slots right now — please check back shortly.</p>
                ) : (
                  <>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {days.map((d) => (
                        <button key={d} type="button" onClick={() => setSelectedDay(d)}
                          className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                            selectedDay === d ? "bg-accent text-accent-fg border-accent" : "bg-bg text-fg border-line hover:border-line-strong"
                          }`}>
                          {fmtDay(d)}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {daySlots.map((s) => (
                        <button key={s} type="button" onClick={() => setSelectedSlot(s)}
                          className={`px-3 py-2 rounded-xl text-xs font-mono font-medium transition-all border ${
                            selectedSlot === s ? "bg-accent text-accent-fg border-accent shadow-sm" : "bg-bg text-fg border-line hover:border-line-strong"
                          }`}>
                          {fmtTime(s)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Client Contact Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-fg uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-info" /> 2. Your Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">
                      Your Name <span className="text-danger">*</span>
                    </label>
                    <input type="text" required placeholder="e.g. Marcus Vance" value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">
                      Your Email <span className="text-danger">*</span>
                    </label>
                    <input type="email" required placeholder="marcus@company.com" value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg block mb-1">Meeting Topic / Project Overview</label>
                  <textarea rows={3} placeholder="Briefly describe what you'd like to discuss..." value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-4 pb-6 border-t border-line flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-faint">
                <ShieldCheck className="w-4 h-4 text-accent" />
                Times shown in {consultation.timezone}
              </div>
              <Button type="submit" disabled={scheduling || !selectedSlot}
                className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold px-6 shadow-sm">
                {scheduling ? "Confirming Slot..." : consultation.requires_payment ? "Reserve & Pay" : "Confirm Booking"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <div className="text-center py-6 text-xs text-faint">
        Powered by <span className="text-fg font-semibold">Freelancer OS</span>
      </div>
    </div>
  );
}
