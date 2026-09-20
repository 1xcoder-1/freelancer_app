"use client";

import React from "react";
import { ReportCard } from "./ReportCard";
import { CardLoadError, CardSkeleton } from "./States";
import { useOwnerReportCard } from "./hooks";
import { CARD_TABS, CardTab } from "./constants";

/**
 * Owner (dashboard) surface of the report card. Shared by /dashboard/report-card
 * and its sub-pages so edits, settings and share state live in one place.
 */
export function OwnerReportCardScreen({ tab }: { tab?: string }) {
  const { data, loading, error, refresh, saveContent, saveSettings } =
    useOwnerReportCard();
  const match = CARD_TABS.find((entry) => entry.id === tab);

  if (tab && !match) {
    return (
      <CardLoadError
        message="That report card page doesn't exist. Available pages: Inspiration, Blog and Sponsor."
        onRetry={refresh}
      />
    );
  }

  if (loading) return <CardSkeleton />;

  if (!data) {
    return (
      <CardLoadError
        message={
          error || "Your report card could not be loaded from the server."
        }
        onRetry={refresh}
      />
    );
  }

  return (
    <ReportCard
      data={data}
      variant="owner"
      activeTab={(match?.id || "home") as CardTab}
      basePath="/dashboard/report-card"
      onRefresh={refresh}
      onSaveContent={saveContent}
      onSaveSettings={saveSettings}
    />
  );
}
