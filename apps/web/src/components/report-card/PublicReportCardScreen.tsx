"use client";

import React, { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ReportCard } from "./ReportCard";
import { CardNotice, CardSkeleton } from "./States";
import { usePublicReportCard } from "./hooks";
import { CARD_TABS, CardTab } from "./constants";

function PublicReportCardScreenView({ activeTab }: { activeTab: CardTab }) {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawUsername = params?.username as string;
  const username = rawUsername ? decodeURIComponent(rawUsername) : "";
  const shareToken = searchParams?.get("token");

  const { data, status } = usePublicReportCard(username, shareToken);

  if (status === "loading") return <CardSkeleton />;

  if (status === "revoked") {
    return (
      <CardNotice
        title="Share Link Revoked"
        message="The public share link for this report card has been removed or set to private by the author."
        actionHref="/"
        actionLabel="Back to Freelance Book"
      />
    );
  }

  if (status === "expired") {
    return (
      <CardNotice
        tone="warn"
        title="Share Link Expired"
        message="This temporary share link has exceeded its configured expiration period."
        actionHref="/"
        actionLabel="Back to Freelance Book"
      />
    );
  }

  if (status === "notfound" || !data) {
    return (
      <CardNotice
        title="Report Card Not Found"
        message="This report card doesn't exist, or the share token is missing or invalid."
        actionHref="/"
        actionLabel="Back to Freelance Book"
      />
    );
  }

  const readOnly = async () => {
    throw new Error("Public viewers cannot edit a report card.");
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

/**
 * Public (share-link) surface of a report card. `tab` comes from the route
 * segment /u/<username>/<tab>; an unknown segment falls back to Home content
 * while still rendering the real section for the recognised pages.
 */
export function PublicReportCardScreen({ tab }: { tab?: string }) {
  const match = CARD_TABS.find((entry) => entry.id === tab);
  return (
    <Suspense fallback={<CardSkeleton />}>
      <PublicReportCardScreenView
        activeTab={(match?.id || "home") as CardTab}
      />
    </Suspense>
  );
}
