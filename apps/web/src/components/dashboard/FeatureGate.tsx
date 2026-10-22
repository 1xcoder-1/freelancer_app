"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { featureForPath } from "@/lib/features";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { AppNotFound } from "@/components/AppNotFound";
import { Skeleton } from "@/components/ui/skeleton";

function RouteSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

// Route-level half of feature gating: the sidebar hides entries, this screen
// catches direct URLs and stale links so a hidden feature never renders for
// non-owner accounts — it renders the app 404 instead, exactly like an
// unknown URL. Gated routes wait for the flags before painting, so their
// content never flashes while the owner test is still resolving.
export function FeatureRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, canSee } = useFeatureFlags();
  const feature = featureForPath(pathname);

  if (feature && !ready) return <RouteSkeleton />;
  if (feature && !canSee(feature.key)) return <AppNotFound />;

  return <>{children}</>;
}
