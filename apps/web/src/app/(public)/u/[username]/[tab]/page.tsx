"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PublicReportCardScreen } from "@/components/report-card/PublicReportCardScreen";

/** Public share view for the sub-pages: /u/<username>/{inspiration|blog|sponsor}. */
export default function PublicReportCardTabPage() {
  const params = useParams();
  return <PublicReportCardScreen tab={(params?.tab as string) || ""} />;
}
