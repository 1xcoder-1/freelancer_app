"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Calendar as CalendarIcon,
  Clock,
  Link as LinkIcon,
  DollarSign,
  CheckCircle2,
  Copy,
  Plus,
  Trash2,
  Users,
  Video,
  ExternalLink,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getBookings,
  createBooking,
  deleteBooking,
  getBookingAppointments,
  BookingConsultation,
  BookingAppointment
} from "@/lib/api";

export default function BookingPage() {
  const { getToken } = useAuth();
  const [consultations, setConsultations] = useState<BookingConsultation[]>([]);
  const [appointments, setAppointments] = useState<BookingAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [price, setPrice] = useState(100);
  const [meetingProvider, setMeetingProvider] = useState("google_meet");
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    try {
      const token = (await getToken()) || undefined;
      const [cons, appts] = await Promise.all([
        getBookings(token),
        getBookingAppointments(token),
      ]);
      setConsultations(cons);
      setAppointments(appts);
    } catch (err) {
      console.error("Failed to load booking data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/booking/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

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
      await fetchData();
    } catch (err) {
      console.error("Failed to create consultation:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this consultation type?")) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteBooking(id, token);
      setConsultations((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Failed to delete booking:", err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">Booking & Consultation Calendar</h1>
            <Badge className="bg-info/10 text-info dark:text-info border-info/20 font-mono text-xs">
              Live Database Connected
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Offer paid strategy sessions or free client discovery calls with automated calendar slots.
          </p>
        </div>

        <Button
          onClick={() => setCreateModalOpen(true)}
          className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Consultation Type
        </Button>
      </div>

      <Tabs defaultValue="consultations" className="space-y-6">
        <TabsList className="bg-card border border-line p-1 rounded-xl">
          <TabsTrigger value="consultations" className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Booking Services ({consultations.length})
          </TabsTrigger>
          <TabsTrigger value="appointments" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Scheduled Appointments ({appointments.length})
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
                      <p className="text-xs text-muted mt-1.5 line-clamp-1 italic">"{appt.notes}"</p>
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

      {/* Modal: Create Consultation */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-lg bg-bg border-line text-fg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-info dark:text-info" />
              New Consultation Service
            </DialogTitle>
            <DialogDescription className="text-muted text-xs">
              Configure session duration, pricing, and automated booking options.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 py-2">
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
                className="w-full px-3 py-2 rounded-xl bg-card border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-fg block mb-1">
                Description
              </label>
              <textarea
                rows={2}
                placeholder="e.g. In-depth technical breakdown and roadmap discussion."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-card border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-fg block mb-1">
                  Duration (Minutes)
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-line text-fg text-sm focus:outline-none"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-fg block mb-1">
                  Price ($ USD)
                </label>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-line">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateModalOpen(false)}
                className="text-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold"
              >
                {creating ? "Saving..." : "Create Consultation Service"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
