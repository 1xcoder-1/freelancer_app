"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportsPanel } from "@/components/dashboard/panels/ReportsPanel";
import { PlanFeatureLock } from "@/components/dashboard/PlanLimit";
import { usePlan } from "@/hooks/use-plan";

export default function ReportsPage() {
  const { snapshot, insight } = usePlan();

  if (snapshot && !insight("reports")) {
    return (
      <PlanFeatureLock
        title="Reports ship on a paid plan"
        body="Revenue, pipeline and workload reports read straight from your book. They unlock on the tier that sells insights."
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
      <ReportsPanel />
    </Suspense>
  );
}
