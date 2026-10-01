"use client";

import { Suspense } from "react";
import { ContractsPanel } from "@/components/dashboard/panels/ContractsPanel";
import { Skeleton } from "@/components/ui/skeleton";

function ContractsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    </div>
  );
}

export default function ContractsPage() {
  return (
    <Suspense fallback={<ContractsLoading />}>
      <ContractsPanel />
    </Suspense>
  );
}
