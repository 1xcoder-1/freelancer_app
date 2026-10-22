"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TestimonialsPanel } from "@/components/dashboard/panels/TestimonialsPanel";
import { PlanFeatureLock } from "@/components/dashboard/PlanLimit";
import { usePlan } from "@/hooks/use-plan";

export default function TestimonialsPage() {
  const { snapshot, insight } = usePlan();

  if (snapshot && !insight("testimonials")) {
    return (
      <PlanFeatureLock
        title="Testimonials ship on a paid plan"
        body="Collect client quotes, approve them, and put them on your link page. They unlock on the tier that sells insights."
        feature="insights"
        backHref="/dashboard"
        backLabel="Back to dashboard"
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-72 rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <TestimonialsPanel />
    </Suspense>
  );
}
