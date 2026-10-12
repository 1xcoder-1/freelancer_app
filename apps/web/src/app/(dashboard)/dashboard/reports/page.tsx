"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportsPanel } from "@/components/dashboard/panels/ReportsPanel";

export default function ReportsPage() {
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
