"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { featureForPath } from "@/lib/features";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { AppNotFound } from "@/components/AppNotFound";

// Route-level half of feature gating: the sidebar hides entries, this screen
// catches direct URLs and stale links so a hidden feature never renders for
// non-owner accounts — it renders the app 404 instead, exactly like an
// unknown URL. The owner bypasses everything.
export function FeatureRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, isOwner, isVisible } = useFeatureFlags();
  const feature = featureForPath(pathname);

  if (ready && !isOwner && feature && !isVisible(feature.key)) {
    return <AppNotFound />;
  }

  return <>{children}</>;
}
