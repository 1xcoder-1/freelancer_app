"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Video,
  RefreshCw,
  CreditCard,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getPublicAppointment,
  getPublicBookingSlots,
  reschedulePublicAppointment,
  PublicAppointment,
} from "@/lib/api";

function fmtDay(iso: string): string {
  return new Date(`${iso}Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(iso: string): string {
  return `${iso.slice(11, 16)} UTC`;
}

export default function ReschedulePage() {
  const params = useParams();
  const token = params?.token as string;

  const [appt, setAppt] = useState<PublicAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [slots, setSlots] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [busy, setBusy] = useState(false);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const data = await getPublicAppointment(token);
        if (active) setAppt(data);
      } catch (err: any) {
        if (active) setError(err.message || "This appointment link is invalid.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token]);

  const consultToken = appt?.consultation_token;
  const canReschedule =
    !!appt &&
    ["pending", "confirmed"].includes(appt.status) &&
    appt.reschedule_count < appt.max_reschedules;

  const loadSlots = useCallback(async () => {
    if (!consultToken) return;
    try {
      const res = await getPublicBookingSlots(consultToken, 30);
      setSlots(res.slots);
    } catch {
      /* keep last */
    }
  }, [consultToken]);

  useEffect(() => {
    if (!canReschedule) return;
    loadSlots();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void loadSlots();
    }, 15_000);
    return () => clearInterval(id);
  }, [canReschedule, loadSlots]);

  const days = useMemo(() => Array.from(new Set(slots.map((s) => s.slice(0, 10)))).sort(), [slots]);
  useEffect(() => {
    if (days.length && !days.includes(selectedDay)) setSelectedDay(days[0]);
  }, [days, selectedDay]);
  const daySlots = useMemo(() => slots.filter((s) => s.slice(0, 10) === selectedDay), [slots, selectedDay]);
  useEffect(() => {
    if (daySlots.length === 0) setSelectedSlot("");
    else if (!daySlots.includes(selectedSlot)) setSelectedSlot(daySlots[0]);
  }, [daySlots, selectedSlot]);

  const handleReschedule = async () => {
    if (!selectedSlot) return;
    setBusy(true);
    try {
      const updated = await reschedulePublicAppointment(token, selectedSlot);
      setAppt(updated);
      setMoved(true);
      toast.success("Appointment moved to the new time.");
    } catch (err: any) {
      toast.error(err?.message || "Could not move the appointment.");
      void loadSlots();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Card className="w-full max-w-xl bg-card border-line p-8 space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
    );
  }

  if (error || !appt) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4 text-fg">
        <Card className="w-full max-w-md bg-card border-line p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-danger mx-auto" />
          <h2 className="text-xl font-bold">Appointment Unavailable</h2>
          <p className="text-sm text-muted">{error || "This reschedule link is invalid or expired."}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl space-y-6">
        <Card className="bg-card border-line p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-fg">Your consultation</h1>
            <Badge className="bg-accent-soft text-accent border-accent/20 text-xs uppercase">{appt.status}</Badge>
          </div>
          <p className="text-sm text-muted">{appt.consultation_title}</p>
          <div className="p-4 rounded-xl bg-bg border border-line text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-faint flex items-center gap-1"><CalendarIcon className="w-4 h-4" /> When</span>
              <span className="font-mono font-semibold">{fmtDay(appt.appointment_time)} · {fmtTime(appt.appointment_time)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">Payment</span>
              <span className="uppercase font-semibold">{appt.payment_status}</span>
            </div>
            {appt.meeting_link && (
              <div className="flex justify-between items-center pt-2 border-t border-line">
                <span className="text-faint">Join</span>
                <a href={appt.meeting_link} target="_blank" rel="noopener noreferrer" className="text-info hover:underline flex items-center gap-1">
                  <Video className="w-3.5 h-3.5" /> Call link
                </a>
              </div>
            )}
          </div>

          {appt.payment_status === "unpaid" && appt.invoice_token && (
            <a href={`/pay/${appt.invoice_token}`}>
              <Button variant="outline" className="w-full border-warn/40 text-warn">
                <CreditCard className="w-4 h-4 mr-2" /> Payment outstanding — pay to confirm
              </Button>
            </a>
          )}
        </Card>

        {moved && (
          <Card className="bg-accent-soft border-accent/30 p-4 text-sm text-accent flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Your appointment now shows the new time above.
          </Card>
        )}

        {canReschedule ? (
          <Card className="bg-card border-line p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-fg">Pick a new time</h2>
              <button onClick={loadSlots} className="text-xs text-muted hover:text-fg inline-flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Live
              </button>
            </div>
            <p className="text-xs text-faint">
              Reschedule {appt.reschedule_count} of {appt.max_reschedules} used.
            </p>

            {days.length === 0 ? (
              <p className="text-sm text-muted py-4">No open slots available right now.</p>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {days.map((d) => (
                    <button key={d} onClick={() => setSelectedDay(d)}
                      className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium border ${
                        selectedDay === d ? "bg-accent text-accent-fg border-accent" : "bg-bg text-fg border-line hover:border-line-strong"
                      }`}>
                      {fmtDay(d)}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {daySlots.map((s) => (
                    <button key={s} onClick={() => setSelectedSlot(s)}
                      className={`px-3 py-2 rounded-xl text-xs font-mono border ${
                        selectedSlot === s ? "bg-accent text-accent-fg border-accent" : "bg-bg text-fg border-line hover:border-line-strong"
                      }`}>
                      {fmtTime(s)}
                    </button>
                  ))}
                </div>
              </>
            )}

            <Button onClick={handleReschedule} disabled={busy || !selectedSlot}
              className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold">
              {busy ? "Moving..." : "Confirm new time"}
            </Button>
          </Card>
        ) : (
          <Card className="bg-card border-line p-6 text-sm text-muted">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              This appointment can no longer be rescheduled online. Please contact the freelancer directly.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
