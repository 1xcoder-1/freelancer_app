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
            href={`/dashboard/booking/${id}`}
            className="group inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-all duration-150"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-150 group-hover:-translate-x-1" /> Back to Service
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
      backHref={`/dashboard/booking/${consultation.id}`}
      backLabel="Back to Service"
      submitLabel="Save changes"
      doneHref={`/dashboard/booking/${consultation.id}`}
      onSubmit={async (payload) => {
        const token = (await getToken()) || undefined;
        await updateBooking(consultation.id, payload, token);
        invalidateCache("dashboard:data");
        invalidateBookingCaches();
        toast.success("Service updated");
      }}
    >
      <div className="rounded-2xl border border-line/70 bg-card p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-4">
        <h2 className="font-display text-base font-medium tracking-wide text-fg pb-2.5 border-b border-line/60">
          Days Off
        </h2>
        <ServiceDaysOffEditor consultationId={consultation.id} />
      </div>
    </ConsultationForm>
  );
}
