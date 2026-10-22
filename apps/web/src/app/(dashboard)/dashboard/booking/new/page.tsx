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
import {
  PlanLimitBlock,
  usePlanCapacity,
} from "@/components/dashboard/PlanLimit";

export default function NewBookingServicePage() {
  const { getToken } = useAuth();
  const capacity = usePlanCapacity("services");

  if (capacity.atLimit) {
    return (
      <div className="max-w-5xl mx-auto pb-20 pt-2 px-3 sm:px-6">
        <PlanLimitBlock capacity={capacity} />
      </div>
    );
  }

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
