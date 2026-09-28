"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CashflowPanel } from "@/components/dashboard/panels/CashflowPanel";
import { ExpensesPanel } from "@/components/dashboard/panels/ExpensesPanel";

const TABS = [
  { value: "overview", label: "Money In & Out", Panel: CashflowPanel },
  { value: "expenses", label: "Expenses", Panel: ExpensesPanel },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function MoneyTabs() {
  const searchParams = useSearchParams();
  const initial = TABS.find((t) => t.value === searchParams.get("tab"))?.value ?? "overview";
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

export default function MoneyPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-72 rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <MoneyTabs />
    </Suspense>
  );
}
