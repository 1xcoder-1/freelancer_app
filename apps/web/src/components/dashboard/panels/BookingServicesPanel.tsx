"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, Plus, Video } from "@/components/animated-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { ServiceCard } from "@/components/dashboard/booking/ServiceCard";
import type { BookingConsultation } from "@/lib/api";

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
            className="h-[175px] w-full rounded-2xl bg-card border border-line"
          />
        ))}
      </div>
    );
  }

  if (consultations.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-card p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-3 max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-surface border border-line mx-auto flex items-center justify-center text-muted">
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
      {consultations.map((item) => (
        <ServiceCard
          key={item.id}
          item={item}
          onOpenDetail={handleOpenDetail}
        />
      ))}
    </div>
  );
}
