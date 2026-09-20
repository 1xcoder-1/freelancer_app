"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  User,
  Mail,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPublicBooking,
  schedulePublicBooking,
  PublicBookingConsultation,
  BookingAppointment
} from "@/lib/api";

const TIME_SLOTS = [
  "09:00 AM",
  "10:00 AM",
  "11:30 AM",
  "01:00 PM",
  "02:30 PM",
  "04:00 PM",
  "05:15 PM"
];

export default function PublicBookingPage() {
  const params = useParams();
  const token = params?.token as string;

  const [consultation, setConsultation] = useState<PublicBookingConsultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking Form states
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [selectedTime, setSelectedTime] = useState("10:00 AM");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [confirmedAppt, setConfirmedAppt] = useState<BookingAppointment | null>(null);

  useEffect(() => {
    if (!token) return;
    const fetchBooking = async () => {
      try {
        const data = await getPublicBooking(token);
        setConsultation(data);
      } catch (err: any) {
        setError(err.message || "Consultation not found.");
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [token]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientEmail.trim() || !selectedDate || !selectedTime) return;

    setScheduling(true);
    try {
      const appt = await schedulePublicBooking(token, {
        client_name: clientName,
        client_email: clientEmail,
        appointment_time: `${selectedDate}T12:00:00Z`,
        notes: notes ? `${notes} (Preferred Slot: ${selectedTime})` : `Preferred Slot: ${selectedTime}`,
      });
      setConfirmedAppt(appt);
    } catch (err: any) {
      setError(err.message || "Failed to schedule appointment.");
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
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4 text-fg">
        <Card className="w-full max-w-lg bg-card border-line p-8 text-center space-y-6 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-xl bg-accent-soft text-accent flex items-center justify-center mx-auto border border-accent">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-fg">Appointment Confirmed!</h2>
            <p className="text-sm text-fg mt-1">
              You're scheduled for <span className="text-info font-semibold">{consultation.title}</span> with {consultation.freelancer_name}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-bg border border-line text-xs text-fg text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-faint">Date:</span>
              <span className="font-mono text-fg font-semibold">
                {new Date(confirmedAppt.appointment_time).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">Time:</span>
              <span className="font-mono text-info font-semibold">
                {selectedTime}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">Duration:</span>
              <span className="text-fg">{consultation.duration_minutes} Minutes</span>
            </div>
            {confirmedAppt.meeting_link && (
              <div className="flex justify-between items-center pt-2 border-t border-line">
                <span className="text-faint">Video Call:</span>
                <a
                  href={confirmedAppt.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info dark:text-info hover:underline flex items-center gap-1 font-semibold"
                >
                  <Video className="w-3.5 h-3.5" /> Join Google Meet
                </a>
              </div>
            )}
          </div>

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
              <Badge className="bg-info/10 text-info dark:text-info border-info/20 font-mono text-xs mb-2">
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
                <Clock className="w-3.5 h-3.5 text-info dark:text-info" />
                {consultation.duration_minutes} Mins
              </div>
            </div>
          </div>
        </Card>

        {/* Schedule Form */}
        <Card className="bg-card border-line shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSchedule}>
            <CardContent className="space-y-6 pt-6">
              {/* Date & Time Slot Selection */}
              <div className="space-y-4 pb-4 border-b border-line">
                <h3 className="text-sm font-semibold text-fg uppercase tracking-wider flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-info" /> 1. Select Date & Time
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">
                      Pick Date
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split("T")[0]}
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">
                      Available Time Slots
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {TIME_SLOTS.slice(0, 4).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={`px-3 py-2 rounded-xl text-xs font-mono font-medium transition-all border ${
                            selectedTime === slot
                              ? "bg-accent text-accent-fg border-accent shadow-sm"
                              : "bg-bg text-fg border-line hover:border-line-strong"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Contact Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-fg uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-info dark:text-info" /> 2. Your Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">
                      Your Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Marcus Vance"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">
                      Your Email <span className="text-danger">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="marcus@company.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg block mb-1">
                    Meeting Topic / Project Overview
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Briefly describe what you'd like to discuss or accomplish during the session..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-4 pb-6 border-t border-line flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-faint">
                <ShieldCheck className="w-4 h-4 text-accent" />
                Instant Calendar Booking
              </div>
              <Button
                type="submit"
                disabled={scheduling}
                className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold px-6 shadow-sm"
              >
                {scheduling ? "Confirming Slot..." : "Confirm & Schedule Appointment"}
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
