"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { ArrowLeft } from "@/components/animated-icons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getBookings, updateBooking } from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import {
  ConsultationForm,
  formStateFrom,
} from "@/components/dashboard/booking/ConsultationForm";
import { ServiceDaysOffEditor } from "@/components/dashboard/booking/ServiceDaysOffEditor";
import { invalidateBookingCaches } from "@/components/dashboard/booking/utils";

export default function EditBookingServicePage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();

  // Same cache key as the Services page, so coming back is instant.
  const { data: consultations, loading } = useApiData(
    "booking:services",
    async (token) => getBookings(token).catch(() => []),
    { reportContext: "booking-edit" }
  );

  if (loading && !consultations) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pt-2 px-3 sm:px-6">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const consultation = (consultations ?? []).find((c) => c.id === id);
  if (!consultation) {
    return (
      <div className="max-w-5xl mx-auto pt-2 px-3 sm:px-6">
        <Card className="bg-card border-dashed border-line rounded-2xl p-12 text-center space-y-3">
          <h3 className="font-display text-lg font-medium text-fg">Service not found</h3>
          <p className="text-muted text-sm">This consultation does not exist (or was deleted) in your workspace.</p>
          <Link
            href="/dashboard/booking/services"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Services
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <ConsultationForm
      initial={formStateFrom({
        title: consultation.title,
        description: consultation.description ?? "",
        durationMinutes: consultation.duration_minutes,
        price: consultation.price,
        weekdayMask: consultation.weekday_mask || "1111100",
        start_minute: consultation.start_minute,
        end_minute: consultation.end_minute,
        minLeadHours: consultation.min_lead_hours,
        maxAdvanceDays: consultation.max_advance_days,
        bufferMinutes: consultation.buffer_minutes,
        noShowLimit: consultation.no_show_limit,
      })}
      isActive={consultation.is_active}
      draftKey={`booking-edit-${consultation.id}`}
      headline="Edit service"
      backHref="/dashboard/booking/services"
      submitLabel="Save changes"
      doneHref="/dashboard/booking/services"
      onSubmit={async (payload) => {
        const token = (await getToken()) || undefined;
        await updateBooking(consultation.id, payload, token);
        invalidateCache("dashboard:data");
        invalidateBookingCaches();
        toast.success("Service updated");
      }}
    >
      <Card className="p-5 sm:p-6 rounded-2xl border border-line bg-card space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-1 border-b border-line/50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-warn" />
            <h2 className="text-sm font-medium text-fg">Days off</h2>
          </div>
          <span className="text-[11px] font-mono text-muted tracking-wider">Dates clients cannot book</span>
        </div>
        <ServiceDaysOffEditor consultationId={consultation.id} />
      </Card>
    </ConsultationForm>
  );
}
