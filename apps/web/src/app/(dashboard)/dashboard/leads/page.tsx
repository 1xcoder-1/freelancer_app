"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadsPanel } from "@/components/dashboard/panels/LeadsPanel";

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-72 rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <LeadsPanel />
    </Suspense>
  );
}
