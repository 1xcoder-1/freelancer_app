"use client";

import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { createBooking } from "@/lib/api";
import { celebrate } from "@/components/common/Celebration";
import { invalidateCache } from "@/hooks/use-api-data";
import {
  ConsultationForm,
  emptyFormState,
} from "@/components/dashboard/booking/ConsultationForm";
import { invalidateBookingCaches } from "@/components/dashboard/booking/utils";

export default function NewBookingServicePage() {
  const { getToken } = useAuth();

  return (
    <ConsultationForm
      initial={emptyFormState}
      draftKey="booking-new"
      headline="New service"
      backHref="/dashboard/booking/services"
      submitLabel="Create service"
      doneHref="/dashboard/booking/services"
      onSubmit={async (payload) => {
        const token = (await getToken()) || undefined;
        await createBooking(payload, token);
        invalidateCache("dashboard:data");
        invalidateBookingCaches();
        toast.success("Service created");
        celebrate("Service added");
      }}
    />
  );
}
