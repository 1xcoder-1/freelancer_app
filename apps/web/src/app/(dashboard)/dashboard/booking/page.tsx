"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { z } from "zod";
import { validateOrToast, nameSchema, moneySchema, optionalTextSchema } from "@/lib/validation";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import {
  Calendar as CalendarIcon,
  Clock,
  Link as LinkIcon,
  CheckCircle2,
  Copy,
  Plus,
  Trash2,
  Users,
  Video,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
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

export default function BookingPage() {
  const { getToken } = useAuth();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [price, setPrice] = useState(100);
  const [meetingProvider, setMeetingProvider] = useState("google_meet");
  const [creating, setCreating] = useState(false);

  const { data: pageData, loading, refresh: fetchData, mutate } = useApiData(
    "booking:data",
    async (token) => {
      const [cons, appts] = await Promise.all([
        getBookings(token).catch(() => []),
        getBookingAppointments(token).catch(() => []),
      ]);
      return { consultations: cons, appointments: appts };
    },
    { reportContext: "booking" }
  );

  const consultations = pageData?.consultations ?? [];
  const appointments = pageData?.appointments ?? [];

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/booking/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOrToast(bookingSchema, { title, description, durationMinutes: Number(durationMinutes), price: Number(price) })) return;

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
      }, token);
      setTitle("");
      setDescription("");
      setDurationMinutes(30);
      setPrice(100);
      setCreateModalOpen(false);
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
      mutate((prev) => ({
        consultations: (prev?.consultations ?? []).filter((c) => c.id !== id),
        appointments: prev?.appointments ?? [],
      }));
      invalidateCache("dashboard:data");
      toast.success("Service deleted");
    } catch (err) {
      console.error("Failed to delete booking:", err);
      toast.error("Could not delete service");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">Booking</h1>
          </div>
          <p className="text-muted text-sm mt-1">
            Let clients pick a time to talk to you — paid calls or free intro calls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={loading}
            className="border-line text-fg w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Consultation Type
          </Button>
        </div>
      </div>

      {createModalOpen ? (
        /* Create screen — a full page inside this tab, never a popup. */
        <Card className="bg-card border-line p-6 max-w-xl space-y-4 animate-in fade-in duration-300">
          <div className="border-b border-line pb-3">
            <h3 className="text-lg font-bold text-fg">New Consultation Service</h3>
            <p className="text-muted text-xs mt-0.5">
              Set a duration and price — clients get a booking link, you get the appointment.
            </p>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">
                Session Title <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 30-Minute Architecture & Code Review"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-fg block mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="e.g. In-depth technical breakdown and roadmap discussion."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-fg block mb-1">Duration (Minutes)</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-fg block mb-1">Price ($ USD)</label>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-line flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                className="border-line text-fg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold"
              >
                {creating ? "Saving..." : "Create Service"}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
      <Tabs defaultValue="consultations" className="space-y-6">
        <TabsList className="bg-card border border-line p-1 rounded-xl">
          <TabsTrigger value="consultations" className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Services ({consultations.length})
          </TabsTrigger>
          <TabsTrigger value="appointments" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Upcoming meetings ({appointments.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Services List */}
        <TabsContent value="consultations" className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <Card key={i} className="bg-card border-line p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-6 w-52" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-40" />
                </Card>
              ))}
            </div>
          ) : consultations.length === 0 ? (
            <Card className="bg-card border-dashed border-line p-12 text-center">
              <CalendarIcon className="w-12 h-12 text-faint mx-auto mb-4" />
              <h3 className="text-lg font-bold text-fg mb-1">No Consultation Types Created</h3>
              <p className="text-muted text-sm max-w-md mx-auto mb-6">
                Create a 1-on-1 strategy call or discovery session with live booking links for clients.
              </p>
              <Button
                onClick={() => setCreateModalOpen(true)}
                className="bg-accent hover:bg-accent-hi text-accent-fg"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create Consultation Service
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {consultations.map((item) => {
                const bookingToken = item.token || item.id;
                return (
                  <Card
                    key={item.id}
                    className="bg-card border-line p-6 flex flex-col justify-between space-y-4 backdrop-blur-md hover:border-line-strong transition-all"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-fg">{item.title}</h3>
                        <span className="font-mono text-accent font-bold">
                          {item.price > 0 ? `$${item.price.toFixed(2)}` : "Free"}
                        </span>
                      </div>

                      <p className="text-xs text-muted">
                        {item.description || "Client 1-on-1 consultation session with automated link generation."}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-mono pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-info dark:text-info" />
                          {item.duration_minutes} Mins
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Video className="w-3.5 h-3.5 text-info" />
                          {item.meeting_provider === "google_meet" ? "Google Meet" : "Zoom / Custom"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-line pt-4 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyLink(bookingToken)}
                        className="border-line bg-bg hover:bg-surface text-fg hover:text-fg text-xs flex-1"
                      >
                        {copiedToken === bookingToken ? (
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-accent" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 mr-1 text-info dark:text-info" />
                        )}
                        {copiedToken === bookingToken ? "Link Copied!" : "Copy Booking Link"}
                      </Button>

                      <a
                        href={`/booking/${bookingToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center p-2 rounded-lg border border-line bg-bg hover:bg-surface text-muted hover:text-fg text-xs transition-colors"
                        title="Open Live Public Booking Page"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                        className="text-faint hover:text-danger hover:bg-danger/10 p-2"
                        title="Delete Service"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Scheduled Appointments */}
        <TabsContent value="appointments" className="space-y-4">
          <p className="text-xs text-faint">
            Clients get a reminder email 24 hours before the meeting. You don&apos;t need to do anything.
          </p>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <Card className="bg-card border-dashed border-line p-12 text-center">
              <Users className="w-12 h-12 text-faint mx-auto mb-3" />
              <h3 className="text-base font-bold text-fg mb-1">No Appointments Booked Yet</h3>
              <p className="text-muted text-xs max-w-sm mx-auto">
                When clients book time using your public links, appointments will appear here automatically with calendar details.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => (
                <Card
                  key={appt.id}
                  className="bg-card border-line p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-md"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-fg">{appt.client_name}</h4>
                      <Badge className="bg-accent-soft text-accent border-accent/20 text-[10px]">
                        {(appt.payment_status || "confirmed").toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-info font-mono mt-0.5">{appt.client_email}</p>
                    {appt.notes && (
                      <p className="text-xs text-muted mt-1.5 line-clamp-1 italic">&ldquo;{appt.notes}&rdquo;</p>
                    )}
                  </div>

                  <div className="text-right sm:text-right font-mono text-xs text-fg">
                    <div className="text-info dark:text-info font-semibold">
                      {new Date(appt.appointment_time).toLocaleDateString()}
                    </div>
                    <div className="text-muted">
                      {new Date(appt.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {appt.meeting_link && (
                      <a
                        href={appt.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-info hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        <Video className="w-3 h-3" /> Join Call
                      </a>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
