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
      <div className="rounded-2xl border border-line/70 bg-card p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-surface border border-line/80 mx-auto flex items-center justify-center text-muted">
          <Phone className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-display text-lg font-medium text-fg">
            No services yet
          </h3>
          <p className="text-muted text-xs max-w-sm mx-auto">
            Create bookable consultations with conflict-free scheduling and custom rules.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/dashboard/booking/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-accent/40 bg-accent/15 hover:bg-accent hover:text-white text-accent font-semibold text-xs shadow-[0_0_16px_rgba(212,107,40,0.12)] transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create service</span>
          </Link>
        </div>
      </div>
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
                ? `${item.duration_minutes}m consultation · ${bookingsCount} booked`
                : `${item.duration_minutes}m online consultation`
            }
            hidePrefix
            onClick={() => handleOpenDetail(item)}
            className="min-h-[200px] sm:min-h-[215px] p-6 sm:p-7 hover:border-accent/40 w-full"
            topRightContent={
              item.is_active ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.12)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                  Paused
                </span>
              )
            }
            tags={
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-muted bg-surface/80 px-2.5 py-0.5 rounded-full border border-line flex items-center gap-1">
                  <Clock className="w-3 h-3 text-accent" />
                  {item.duration_minutes}m
                </span>
                {item.meeting_provider && (
                  <span className="text-xs font-medium text-muted bg-surface/80 px-2.5 py-0.5 rounded-full border border-line capitalize">
                    {item.meeting_provider === "google_meet" ? "Google Meet" : item.meeting_provider}
                  </span>
                )}
              </div>
            }
            icon={
              <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent shadow-2xs group-hover:scale-105 group-hover:bg-accent/15 transition-all">
                <Video className="w-4 h-4" />
              </div>
            }
          />
        );
      })}
    </div>
  );
}
