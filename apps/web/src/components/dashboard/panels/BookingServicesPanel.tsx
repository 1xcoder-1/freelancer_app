"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Phone, Plus, Video } from "@/components/animated-icons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";
import { BookingConsultation } from "@/lib/api";

/* Services roster — matches the Client page card styling 1:1.
   Wide cards with generous dimensions, clean layout (no price badge),
   small meaningful meeting icon, and click-to-open details. */
export function BookingServicesPanel({
  consultations,
  loading,
}: {
  consultations: BookingConsultation[];
  loading: boolean;
}) {
  const router = useRouter();

  const handleOpenDetail = (item: BookingConsultation) => {
    router.push(`/dashboard/booking/${item.id}`);
  };

  if (loading && consultations.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 stagger-grid">
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            className="h-[210px] w-full rounded-2xl bg-card border border-line dark:bg-[#141518] dark:border-[#26272d]"
          />
        ))}
      </div>
    );
  }

  if (consultations.length === 0) {
    return (
      <Card className="bg-card dark:bg-[#141518] border-dashed border-line dark:border-[#26272d] rounded-2xl p-12 text-center">
        <Phone className="w-12 h-12 text-faint mx-auto mb-4" />
        <h3 className="font-display text-lg font-medium text-fg dark:text-white mb-1">
          No services yet
        </h3>
        <p className="text-muted dark:text-[#a1a1aa] text-sm max-w-md mx-auto mb-6">
          A service is the thing a client books — a paid strategy session, a free discovery call.
          Create one and you get a public link with conflict-free times.
        </p>
        <Link
          href="/dashboard/booking/new"
          className="press group relative inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-b from-[#ff7a29] to-[#ea580c] hover:from-[#ff883d] hover:to-[#f97316] text-white font-medium text-sm shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.25),0_0_14px_rgba(234,88,12,0.35)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35),0_0_18px_rgba(234,88,12,0.5)] border border-orange-400/40 active:scale-95 transition-all duration-150 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-white transition-transform duration-200 group-hover:rotate-90" />
          <span>Create your first service</span>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 stagger-grid">
      {consultations.map((item) => {
        const bookingsCount = item.appointments_count ?? 0;

        return (
          <CategoryVisualCard
            key={item.id}
            title={item.title}
            subtitle={
              bookingsCount > 0
                ? `${item.duration_minutes} min consultation   ·   ${bookingsCount} booked`
                : `${item.duration_minutes} min online consultation`
            }
            hidePrefix
            onClick={() => handleOpenDetail(item)}
            className="min-h-[200px] sm:min-h-[215px] p-6 sm:p-7 hover:border-accent/40 dark:hover:border-accent/50 w-full"
            topRightContent={
              item.is_active ? (
                <span className="text-xs font-medium px-3 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              ) : (
                <span className="text-xs font-medium px-3 py-1 rounded-full border border-slate-200 dark:border-white/10 bg-slate-500/10 text-slate-700 dark:text-slate-400">
                  Paused
                </span>
              )
            }
            tags={
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-muted dark:text-[#a1a1aa] bg-surface/80 dark:bg-white/5 px-2.5 py-0.5 rounded-full border border-line dark:border-white/10 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-accent" />
                  {item.duration_minutes}m
                </span>
                {item.meeting_provider && (
                  <span className="text-xs font-medium text-muted dark:text-[#a1a1aa] bg-surface/80 dark:bg-white/5 px-2.5 py-0.5 rounded-full border border-line dark:border-white/10 capitalize">
                    {item.meeting_provider === "google_meet" ? "Google Meet" : item.meeting_provider}
                  </span>
                )}
              </div>
            }
            icon={
              <div className="w-8 h-8 rounded-xl bg-accent-soft/70 dark:bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shadow-2xs group-hover:scale-105 transition-transform">
                <Video className="w-4 h-4" />
              </div>
            }
          />
        );
      })}
    </div>
  );
}
