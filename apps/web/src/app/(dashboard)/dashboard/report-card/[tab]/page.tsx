"use client";

import React from "react";
import { useParams } from "next/navigation";
import { OwnerReportCardScreen } from "@/components/report-card/OwnerReportCardScreen";

/** Dashboard sub-pages: /dashboard/report-card/{home|work|projects|inspo|sponsor}. */
export default function DashboardReportCardTabPage() {
  const params = useParams();
  return <OwnerReportCardScreen tab={(params?.tab as string) || ""} />;
}
