"use client";

import React from "react";
import Link from "next/link";
import { ReportCard } from "./ReportCard";
import { CardLoadError, CardSkeleton } from "./States";
import { useOwnerReportCard } from "./hooks";
import { CARD_TABS, CardTab } from "./constants";
import { ArrowLeft } from "@/components/animated-icons";

/**
 * Owner (dashboard) surface of the report card. Shared by the portfolio
 * sub-pages so edits, settings and share state live in one place.
 */
export function OwnerReportCardScreen({ tab }: { tab?: string }) {
  const { data, loading, error, refresh, saveContent, saveSettings } =
    useOwnerReportCard();
  const match = CARD_TABS.find((entry) => entry.id === tab);

  if (tab && !match) {
    return (
      <CardLoadError
        message="That portfolio page doesn't exist. Available pages: Home, Work, Projects, Inspo and Sponsor."
        onRetry={refresh}
      />
    );
  }

  if (loading) return <CardSkeleton />;

  if (!data) {
    return (
      <CardLoadError
        message={
          error || "Your portfolio could not be loaded from the server."
        }
        onRetry={refresh}
      />
    );
  }

  return (
    <div className="space-y-6">
      {tab && (
        <div className="max-w-4xl mx-auto w-full px-1">
          <Link
            href="/dashboard/report-card"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Portfolio</span>
          </Link>
        </div>
      )}
      <ReportCard
        data={data}
        variant="owner"
        activeTab={(match?.id || "home") as CardTab}
        basePath="/dashboard/report-card"
        onRefresh={refresh}
        onSaveContent={saveContent}
        onSaveSettings={saveSettings}
      />
    </div>
  );
}
