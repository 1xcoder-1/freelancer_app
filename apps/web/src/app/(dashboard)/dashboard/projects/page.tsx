"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectsPanel } from "@/components/dashboard/panels/ProjectsPanel";
import { InvoicesPanel } from "@/components/dashboard/panels/InvoicesPanel";
import { ContractsPanel } from "@/components/dashboard/panels/ContractsPanel";

function ProjectsContent() {
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab");

  if (tab === "invoices") {
    return <InvoicesPanel />;
  }
  if (tab === "contracts") {
    return <ContractsPanel />;
  }
  return <ProjectsPanel />;
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-72 rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <ProjectsContent />
    </Suspense>
  );
}
