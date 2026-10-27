"use client";

import React from "react";
import { ReportCard } from "./ReportCard";
import type { CardTab } from "./constants";
import type { ReportCardData } from "@/lib/api";

/**
 * Render-only public surface: the SSR route fetches the payload server-side
 * (including revocation/expiry handling) and hands it over fully formed, so
 * the first paint is real content — never a client-side skeleton.
 */
export function PublicReportCardView({
  data,
  activeTab = "home",
  shareToken,
}: {
  data: ReportCardData;
  activeTab?: CardTab;
  shareToken?: string | null;
}) {
  const readOnly = async () => {
    throw new Error("Public viewers cannot edit a portfolio.");
  };

  return (
    <ReportCard
      data={data}
      variant="public"
      activeTab={activeTab}
      basePath={`/u/${data.username}`}
      shareToken={shareToken}
      onRefresh={() => undefined}
      onSaveContent={readOnly}
      onSaveSettings={readOnly}
    />
  );
}
