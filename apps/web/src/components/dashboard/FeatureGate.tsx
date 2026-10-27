"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { featureForPath, flagKeyForPath } from "@/lib/features";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { AppNotFound } from "@/components/AppNotFound";

// Route-level half of feature gating: the sidebar hides entries, this screen
// catches direct URLs and stale links so a hidden feature never renders for
// non-owner accounts — it renders the app 404 instead, exactly like an
// unknown URL. Sub-items with their own flag (Planner → Task Management) are
// checked against that flag via flagKeyForPath, so hiding Task Management
// blocks /dashboard/planner/tasks without touching the rest of Planner.
// Rather than showing a redundant generic skeleton that flashes before the page's
// own loading skeleton, we render children directly and deny access if disabled.
export function FeatureRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, canSee } = useFeatureFlags();
  const feature = featureForPath(pathname);
  const flagKey = flagKeyForPath(pathname);

  if (feature && flagKey && ready && !canSee(flagKey)) return <AppNotFound />;

  return <>{children}</>;
}
