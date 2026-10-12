"use client";

import React from "react";
import Link from "next/link";
import { ReportCard } from "./ReportCard";
import { CardLoadError, CardSkeleton } from "./States";
import { useOwnerReportCard } from "./hooks";
import { CARD_TABS, CardTab } from "./constants";
import { LinkPageStatsPanel } from "@/components/link-page/LinkPageStatsPanel";
import { ExternalLink } from "@/components/animated-icons";

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
        message="That report card page doesn't exist. Available pages: Inspiration, Projects and Sponsor."
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
    <div className="space-y-8">
      <ReportCard
        data={data}
        variant="owner"
        activeTab={(match?.id || "home") as CardTab}
        basePath="/dashboard/report-card"
        onRefresh={refresh}
        onSaveContent={saveContent}
        onSaveSettings={saveSettings}
      />

      {/* Profile analytics: views + link page stats in one dashboard */}
      <div className="max-w-4xl mx-auto w-full px-1 space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">Profile Dashboard</h2>
          <Link
            href="/dashboard/link-page"
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hi transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Edit your Link Page
          </Link>
        </div>
        <LinkPageStatsPanel compact />
      </div>
    </div>
  );
}
