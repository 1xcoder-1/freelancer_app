"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientsPanel } from "@/components/dashboard/panels/ClientsPanel";
import { LeadsPanel } from "@/components/dashboard/panels/LeadsPanel";
import { IntakePanel } from "@/components/dashboard/panels/IntakePanel";

function ClientsContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  if (tab === "leads") {
    return <LeadsPanel />;
  }
  if (tab === "forms" || tab === "intake") {
    return <IntakePanel />;
  }
  return <ClientsPanel />;
}

export default function ClientsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-72 rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <ClientsContent />
    </Suspense>
  );
}
