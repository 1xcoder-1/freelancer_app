"use client";

import { Suspense } from "react";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { CalendarSkeleton } from "@/components/dashboard/CalendarSkeleton";

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <DashboardCalendar />
    </Suspense>
  );
}
