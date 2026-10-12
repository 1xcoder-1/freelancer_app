"use client";

import Link from "next/link";
import { CalendarDays, Pause, Phone, Plus, RefreshCw } from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/patterns";
import { BookingServicesPanel } from "@/components/dashboard/panels/BookingServicesPanel";
import { getBookings } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";

/* Services — the things a client can book. Each one owns its own link,
   opening hours and days off, so they all live on this page. */
export default function BookingServicesPage() {
  const { data: consultations, loading, refresh } = useApiData(
    "booking:services",
    async (token) => getBookings(token),
    { reportContext: "booking-services" }
  );

  const services = consultations ?? [];
  const active = services.filter((s) => s.is_active).length;
  const paused = services.length - active;
  const bookedTotal = services.reduce((sum, s) => sum + (s.appointments_count ?? 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">Services</h1>
          <p className="text-muted text-sm mt-1">
            What clients can book — each service has its own link, hours and days off.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh(true)}
            disabled={loading}
            className="border-line text-fg w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Link
            href="/dashboard/booking/new"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs shadow-xs active:scale-95 transition-all duration-150 px-3.5"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New service
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {loading && !consultations ? (
          [1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
          ))
        ) : (
          <>
            <StatCard
              label="Services"
              value={services.length}
              icon={CalendarDays}
              rows={[
                { text: `${active} taking bookings`, dot: "ok" },
                { text: `${paused} paused`, dot: paused ? "warn" : "ok" },
              ]}
            />
            <StatCard
              label="Live now"
              value={active}
              icon={Phone}
              rows={[
                { text: `${services.filter((s) => s.price > 0).length} paid`, dot: "info" },
                { text: `${services.filter((s) => s.price === 0).length} free`, dot: "ok" },
              ]}
            />
            <StatCard
              label="Calls booked"
              value={bookedTotal}
              icon={CalendarDays}
              rows={[
                { text: "across every service", dot: "info" },
                { text: `${services.length} service${services.length === 1 ? "" : "s"} created` },
              ]}
            />
            <StatCard
              label="Paused"
              value={paused}
              icon={Pause}
              rows={[{ text: paused ? "hidden from public links" : "nothing paused", dot: paused ? "warn" : "ok" }]}
            />
          </>
        )}
      </div>

      <BookingServicesPanel consultations={services} loading={loading} />
    </div>
  );
}
