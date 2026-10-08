"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { z } from "zod";
import { validateOrToast, nameSchema, moneySchema, optionalTextSchema } from "@/lib/validation";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Copy,
  Plus,
  Trash2,
  Users,
  Video,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Ban,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getBookings,
  createBooking,
  deleteBooking,
  getBookingAppointments,
  getBookingAgenda,
  setAppointmentStatus,
  listBlockedDays,
  addBlockedDay,
  removeBlockedDay,
  BookingConsultation,
  BookingAppointment,
  BookingAgenda,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";

const bookingSchema = z.object({
  title: nameSchema("Service title", 150),
  description: optionalTextSchema("Description", 1000),
  durationMinutes: z
    .number({ message: "Duration must be a number" })
    .int("Duration must be whole minutes")
    .positive("Duration must be at least 1 minute")
    .max(1440, "Duration cannot exceed 24 hours"),
  price: moneySchema("Price"),
});

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_MASK = "1111100";

function fmtWhen(iso: string): string {
  return `${new Date(`${iso}Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${iso.slice(11, 16)} UTC`;
}

const STATUS_TONE: Record<string, string> = {
  pending: "bg-warn/10 text-warn border-warn/30",
  confirmed: "bg-accent-soft text-accent border-accent/30",
  completed: "bg-ok/10 text-ok border-ok/30",
  cancelled: "bg-faint/10 text-faint border-line",
  no_show: "bg-danger/10 text-danger border-danger/30",
};

export default function BookingPage() {
  const { getToken } = useAuth();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Create screen
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [price, setPrice] = useState(100);
  const [meetingProvider, setMeetingProvider] = useState("google_meet");
  const [weekdayMask, setWeekdayMask] = useState(DEFAULT_MASK);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [minLeadHours, setMinLeadHours] = useState(2);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(60);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [noShowLimit, setNoShowLimit] = useState(2);
  const [creating, setCreating] = useState(false);

  const { data: pageData, loading, refresh: fetchData } = useApiData(
    "booking:data",
    async (token) => {
      const [cons, appts, agenda] = await Promise.all([
        getBookings(token).catch(() => []),
        getBookingAppointments(undefined, token).catch(() => []),
        getBookingAgenda(token).catch(() => null),
      ]);
      return { consultations: cons, appointments: appts, agenda };
    },
    { reportContext: "booking", pollMs: 20_000 }
  );

  const consultations: BookingConsultation[] = pageData?.consultations ?? [];
  const appointments: BookingAppointment[] = pageData?.appointments ?? [];
  const agenda: BookingAgenda | null = pageData?.agenda ?? null;

  const handleCopy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedToken(label);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const toggleDay = (idx: number) => {
    setWeekdayMask((prev) => {
      const arr = prev.split("");
      arr[idx] = arr[idx] === "1" ? "0" : "1";
      return arr.join("");
    });
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDurationMinutes(30);
    setPrice(100);
    setWeekdayMask(DEFAULT_MASK);
    setStartHour(9);
    setEndHour(17);
    setMinLeadHours(2);
    setMaxAdvanceDays(60);
    setBufferMinutes(0);
    setNoShowLimit(2);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOrToast(bookingSchema, { title, description, durationMinutes: Number(durationMinutes), price: Number(price) })) return;
    if (weekdayMask === "0000000") {
      toast.error("Pick at least one booking day.");
      return;
    }
    if (endHour <= startHour) {
      toast.error("The closing hour must be after the opening hour.");
      return;
    }
    setCreating(true);
    try {
      const token = (await getToken()) || undefined;
      await createBooking({
        title,
        description,
        duration_minutes: Number(durationMinutes),
        price: Number(price),
        meeting_provider: meetingProvider,
        is_active: true,
        weekday_mask: weekdayMask,
        start_minute: startHour * 60,
        end_minute: endHour * 60,
        min_lead_hours: Number(minLeadHours),
        max_advance_days: Number(maxAdvanceDays),
        buffer_minutes: Number(bufferMinutes),
        no_show_limit: Number(noShowLimit),
      }, token);
      resetForm();
      setCreateOpen(false);
      invalidateCache("booking:data");
      invalidateCache("dashboard:data");
      await fetchData();
      toast.success("Service created");
    } catch (err) {
      console.error("Failed to create consultation:", err);
      toast.error("Could not create service");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete service",
      message: "This consultation type will be removed. Clients can no longer book it.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteBooking(id, token);
      invalidateCache("booking:data");
      await fetchData();
      toast.success("Service deleted");
    } catch (err) {
      console.error("Failed to delete booking:", err);
      toast.error("Could not delete service");
    }
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
      invalidateCache("booking:data");
      await fetchData();
      toast.success(next === "completed" ? "Call completed — client record created" : "Appointment updated");
    } catch (err: any) {
      toast.error(err?.message || "Could not update appointment");
    }
  };

  // ---- Blackout days tab state -------------------------------------------
  const [blkConsultationId, setBlkConsultationId] = useState<string>("");
  const [blockedDays, setBlockedDays] = useState<string[]>([]);
  const [blkLoading, setBlkLoading] = useState(false);

  const loadBlocked = useCallback(async (id: string) => {
    if (!id) { setBlockedDays([]); return; }
    setBlkLoading(true);
    try {
      const token = (await getToken()) || undefined;
      setBlockedDays(await listBlockedDays(id, token));
    } catch {
      setBlockedDays([]);
    } finally {
      setBlkLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!blkConsultationId && consultations.length) setBlkConsultationId(consultations[0].id);
  }, [consultations, blkConsultationId]);

  useEffect(() => {
    if (blkConsultationId) void loadBlocked(blkConsultationId);
  }, [blkConsultationId, loadBlocked]);

  const [newBlockedDay, setNewBlockedDay] = useState("");
  const blockDay = async () => {
    if (!blkConsultationId || !newBlockedDay) return;
    try {
      const token = (await getToken()) || undefined;
      await addBlockedDay(blkConsultationId, newBlockedDay, token);
      setNewBlockedDay("");
      await loadBlocked(blkConsultationId);
      invalidateCache("booking:data");
      toast.success("Day blocked");
    } catch (err: any) {
      toast.error(err?.message || "Could not block day");
    }
  };
  const unblockDay = async (date: string) => {
    try {
      const token = (await getToken()) || undefined;
      await removeBlockedDay(blkConsultationId, date, token);
      setBlockedDays((prev) => prev.filter((d) => d !== date));
      toast.success("Day unblocked");
    } catch (err: any) {
      toast.error(err?.message || "Could not unblock day");
    }
  };

  const upcoming = appointments
    .filter((a) => ["pending", "confirmed"].includes(a.status))
    .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">Booking</h1>
          <p className="text-muted text-sm mt-1">
            Let clients pick a conflict-free time — paid calls confirm only once payment lands.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={loading}
            className="border-line text-fg w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Consultation Type
          </Button>
        </div>
      </div>

      {/* B6: live Today agenda */}
      {agenda && (
        <Card className="bg-card border-line p-5 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-faint mb-1">Next call</div>
            {agenda.next_call ? (
              <>
                <div className="text-lg font-bold text-fg truncate">{agenda.next_call.client_name}</div>
                <div className="text-sm text-info font-mono">{fmtWhen(agenda.next_call.appointment_time)}</div>
                <div className="text-xs text-muted mt-0.5">
                  {agenda.hours_to_next != null && agenda.hours_to_next < 24
                    ? `in ${Math.max(0, Math.round(agenda.hours_to_next))}h`
                    : `in ${Math.ceil((agenda.hours_to_next ?? 0) / 24)} days`}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted">Nothing booked yet.</div>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-center">
            <div>
              <div className="text-2xl font-black text-accent">{agenda.today_calls.length}</div>
              <div className="text-[10px] uppercase tracking-wider text-faint">Today</div>
            </div>
            <div>
              <div className="text-2xl font-black text-fg">{agenda.week_booked}</div>
              <div className="text-[10px] uppercase tracking-wider text-faint">Booked / 7d</div>
            </div>
            <div>
              <div className="text-2xl font-black text-ok">{agenda.week_available}</div>
              <div className="text-[10px] uppercase tracking-wider text-faint">Open / 7d</div>
            </div>
            <div>
              <div className={`text-2xl font-black ${agenda.no_show_count ? "text-danger" : "text-fg"}`}>{agenda.no_show_count}</div>
              <div className="text-[10px] uppercase tracking-wider text-faint">No-shows</div>
            </div>
          </div>
        </Card>
      )}

      {createOpen ? (
        <Card className="bg-card border-line p-6 max-w-2xl space-y-4 animate-in fade-in duration-300">
          <div className="border-b border-line pb-3">
            <h3 className="text-lg font-bold text-fg">New Consultation Service</h3>
            <p className="text-muted text-xs mt-0.5">Set duration, price and your real opening hours — clients only ever see open, conflict-free slots.</p>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Session Title <span className="text-danger">*</span></label>
              <input type="text" required placeholder="e.g. 30-Minute Architecture Review" value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>

            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Description</label>
              <textarea rows={2} placeholder="What the session covers." value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-fg block mb-1">Duration</label>
                <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none">
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-fg block mb-1">Price ($ USD)</label>
                <input type="number" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
            </div>

            {/* B2 availability */}
            <div className="pt-3 border-t border-line space-y-3">
              <div className="text-xs font-semibold text-fg">Opening hours</div>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((d, i) => (
                  <button key={d} type="button" onClick={() => toggleDay(i)}
                    className={`px-2.5 py-1 rounded-lg text-xs border ${
                      weekdayMask[i] === "1" ? "bg-accent text-accent-fg border-accent" : "bg-bg text-muted border-line"
                    }`}>{d}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-muted block mb-1">Opens (hour)</label>
                  <input type="number" min={0} max={23} value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-bg border border-line text-fg text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-muted block mb-1">Closes (hour)</label>
                  <input type="number" min={1} max={24} value={endHour} onChange={(e) => setEndHour(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-bg border border-line text-fg text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-muted block mb-1">Buffer (min)</label>
                  <input type="number" min={0} max={240} value={bufferMinutes} onChange={(e) => setBufferMinutes(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-bg border border-line text-fg text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-muted block mb-1">Min lead (hrs)</label>
                  <input type="number" min={0} max={336} value={minLeadHours} onChange={(e) => setMinLeadHours(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-bg border border-line text-fg text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-muted block mb-1">Max advance (days)</label>
                  <input type="number" min={1} max={365} value={maxAdvanceDays} onChange={(e) => setMaxAdvanceDays(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-bg border border-line text-fg text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-muted block mb-1">No-show limit</label>
                  <input type="number" min={1} max={10} value={noShowLimit} onChange={(e) => setNoShowLimit(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-bg border border-line text-fg text-sm" />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-line flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }} className="border-line text-fg">Cancel</Button>
              <Button type="submit" disabled={creating} className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold">
                {creating ? "Saving..." : "Create Service"}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
      <Tabs defaultValue="consultations" className="space-y-6">
        <TabsList className="bg-card border border-line p-1 rounded-xl">
          <TabsTrigger value="consultations" className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" /> Services ({consultations.length})
          </TabsTrigger>
          <TabsTrigger value="appointments" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Meetings ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="blackout" className="flex items-center gap-2">
            <Ban className="w-4 h-4" /> Blackout days
          </TabsTrigger>
        </TabsList>

        {/* Services */}
        <TabsContent value="consultations" className="space-y-6">
          {loading && consultations.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => <Card key={i} className="bg-card border-line p-6 space-y-4"><Skeleton className="h-6 w-52" /><Skeleton className="h-4 w-full" /></Card>)}
            </div>
          ) : consultations.length === 0 ? (
            <Card className="bg-card border-dashed border-line p-12 text-center">
              <CalendarIcon className="w-12 h-12 text-faint mx-auto mb-4" />
              <h3 className="text-lg font-bold text-fg mb-1">No Consultation Types Created</h3>
              <p className="text-muted text-sm max-w-md mx-auto mb-6">Create a strategy or discovery call with a live, conflict-free booking link.</p>
              <Button onClick={() => setCreateOpen(true)} className="bg-accent hover:bg-accent-hi text-accent-fg"><Plus className="w-4 h-4 mr-1.5" />Create Consultation Service</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {consultations.map((item) => {
                const bookingUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/booking/${item.token || item.id}`;
                const openDays = DAY_LABELS.filter((_, i) => item.weekday_mask?.[i] === "1").join(" ") || "—";
                return (
                  <Card key={item.id} className="bg-card border-line p-6 flex flex-col justify-between space-y-4 hover:border-line-strong transition-all">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-fg">{item.title}</h3>
                        <span className="font-mono text-accent font-bold">{item.price > 0 ? `$${item.price.toFixed(2)}` : "Free"}</span>
                      </div>
                      <p className="text-xs text-muted">{item.description || "Client 1-on-1 consultation session."}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-mono pt-1">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-info" />{item.duration_minutes} min</span>
                        <span>•</span>
                        <span>{openDays}</span>
                        <span>•</span>
                        <span>{item.appointments_count} booked</span>
                      </div>
                      {item.price > 0 && (
                        <p className="text-[11px] text-warn">Paid — confirmed only after payment.</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-line pt-4 gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleCopy(item.id, bookingUrl)}
                        className="border-line bg-bg hover:bg-surface text-fg text-xs flex-1">
                        {copiedToken === item.id ? <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-accent" /> : <Copy className="w-3.5 h-3.5 mr-1 text-info" />}
                        {copiedToken === item.id ? "Link Copied!" : "Copy Booking Link"}
                      </Button>
                      <a href={`/booking/${item.token || item.id}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center justify-center p-2 rounded-lg border border-line bg-bg hover:bg-surface text-muted hover:text-fg text-xs" title="Open public page">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)} className="text-faint hover:text-danger hover:bg-danger/10 p-2" title="Delete Service">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Appointments */}
        <TabsContent value="appointments" className="space-y-4">
          <p className="text-xs text-faint">Clients get a reminder 24h before and a 1h nudge. Manage the outcome here.</p>
          {loading && appointments.length === 0 ? (
            <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
          ) : appointments.length === 0 ? (
            <Card className="bg-card border-dashed border-line p-12 text-center">
              <Users className="w-12 h-12 text-faint mx-auto mb-3" />
              <h3 className="text-base font-bold text-fg mb-1">No Appointments Booked Yet</h3>
              <p className="text-muted text-xs max-w-sm mx-auto">When clients book via your links, they appear here with live status.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => (
                <Card key={appt.id} className="bg-card border-line p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-fg">{appt.client_name}</h4>
                      <Badge className={`${STATUS_TONE[appt.status] || "bg-surface text-muted border-line"} text-[10px] uppercase`}>{appt.status}</Badge>
                      <Badge className={`text-[10px] uppercase ${appt.payment_status === "paid" ? "bg-ok/10 text-ok border-ok/30" : appt.payment_status === "unpaid" ? "bg-warn/10 text-warn border-warn/30" : "bg-surface text-muted border-line"}`}>{appt.payment_status}</Badge>
                      {appt.no_show && <Badge className="bg-danger/10 text-danger border-danger/30 text-[10px] uppercase">no-show</Badge>}
                    </div>
                    <p className="text-xs text-info font-mono mt-0.5">{appt.client_email}</p>
                    <p className="text-xs text-fg mt-1 font-mono">{appt.consultation_title} · {fmtWhen(appt.appointment_time)}</p>
                    {appt.reschedule_count > 0 && <p className="text-[11px] text-faint">rescheduled {appt.reschedule_count}×</p>}
                    {appt.notes && <p className="text-xs text-muted mt-1.5 line-clamp-1 italic">&ldquo;{appt.notes}&rdquo;</p>}
                  </div>

                  <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
                    <div className="flex gap-1.5">
                      {appt.invoice_token && appt.payment_status === "unpaid" && (
                        <a href={`/pay/${appt.invoice_token}`} className="text-xs px-2.5 py-1 rounded-lg bg-warn/10 text-warn border border-warn/30">Pay link</a>
                      )}
                      {appt.meeting_link && (
                        <a href={appt.meeting_link} target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 rounded-lg bg-surface text-fg border border-line inline-flex items-center gap-1"><Video className="w-3 h-3" />Join</a>
                      )}
                      {appt.token && (
                        <button onClick={() => handleCopy(`res-${appt.id}`, `${typeof window !== "undefined" ? window.location.origin : ""}/reschedule/${appt.token}`)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-surface text-muted border border-line">{copiedToken === `res-${appt.id}` ? "Copied" : "Reschedule link"}</button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {appt.status === "pending" && <button onClick={() => changeStatus(appt, "confirmed")} className="text-xs px-2.5 py-1 rounded-lg bg-accent-soft text-accent border border-accent/30">Confirm</button>}
                      {["pending", "confirmed"].includes(appt.status) && (
                        <>
                          <button onClick={() => changeStatus(appt, "completed")} className="text-xs px-2.5 py-1 rounded-lg bg-ok/10 text-ok border border-ok/30">Complete</button>
                          <button onClick={() => changeStatus(appt, "no_show")} className="text-xs px-2.5 py-1 rounded-lg bg-danger/10 text-danger border border-danger/30">No-show</button>
                          <button onClick={() => changeStatus(appt, "cancelled")} className="text-xs px-2.5 py-1 rounded-lg bg-surface text-muted border border-line">Cancel</button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Blackout days (B2) */}
        <TabsContent value="blackout" className="space-y-4">
          {consultations.length === 0 ? (
            <Card className="bg-card border-dashed border-line p-10 text-center text-muted text-sm">Create a consultation first, then block days you are away.</Card>
          ) : (
            <Card className="bg-card border-line p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-fg">
                <AlertTriangle className="w-4 h-4 text-warn" />
                Blocked days are removed from the public open-slot list for that service.
              </div>
              <div className="flex flex-wrap gap-2">
                {consultations.map((c) => (
                  <button key={c.id} onClick={() => setBlkConsultationId(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs border ${blkConsultationId === c.id ? "bg-accent text-accent-fg border-accent" : "bg-bg text-fg border-line"}`}>{c.title}</button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={newBlockedDay} onChange={(e) => setNewBlockedDay(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm" />
                <Button size="sm" onClick={blockDay} disabled={!newBlockedDay} className="bg-accent hover:bg-accent-hi text-accent-fg">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Block day
                </Button>
              </div>

              {blkLoading ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : blockedDays.length === 0 ? (
                <p className="text-xs text-faint">No blocked days for this service.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {blockedDays.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-line text-xs text-fg">
                      {d}
                      <button onClick={() => unblockDay(d)} className="text-faint hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
