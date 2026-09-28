"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientsPanel } from "@/components/dashboard/panels/ClientsPanel";
import { LeadsPanel } from "@/components/dashboard/panels/LeadsPanel";
import { IntakePanel } from "@/components/dashboard/panels/IntakePanel";

const TABS = [
  { value: "clients", label: "Clients", Panel: ClientsPanel },
  { value: "leads", label: "Leads", Panel: LeadsPanel },
  { value: "forms", label: "Forms", Panel: IntakePanel },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function ClientsTabs() {
  const searchParams = useSearchParams();
  const initial = TABS.find((t) => t.value === searchParams.get("tab"))?.value ?? "clients";
  const [tab, setTab] = useState<TabValue>(initial);

  const active = TABS.find((t) => t.value === tab) ?? TABS[0];
  const Panel = active.Panel;

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Panel />
    </div>
  );
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
      <ClientsTabs />
    </Suspense>
  );
}
