"use client";

import React, { Suspense } from "react";
import { usePathname } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/Sidebar";
import { CommandMenu } from "@/components/common/CommandMenu";
import { PageTransition } from "@/components/common/PageTransition";
import { FeatureFlagsProvider } from "@/hooks/use-feature-flags";
import { WorkspaceCurrencyProvider } from "@/hooks/use-workspace-currency";
import { FeatureRouteGuard } from "@/components/dashboard/FeatureGate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Only the actual report-card sub-page editor (/dashboard/report-card/[tab]) gets full-bleed styling.
  // The portfolio overview page (/dashboard/report-card) behaves like a standard dashboard page (e.g. link-page).
  const isReportCardEditor = /^\/dashboard\/report-card\/[^/]+/.test(pathname || "");
  const isSketchBoard = /^\/dashboard\/planner\/(?!tasks(?:\/|$))[^/]+\/?$/.test(pathname || "");
  const isTaskBoard = /^\/dashboard\/planner\/tasks\/[^/]+\/?$/.test(pathname || "");
  const isFullScreenApp = isReportCardEditor || isSketchBoard || isTaskBoard;
  const hideTopBar = isFullScreenApp;
  const hideSidebar = isFullScreenApp;
  const fullBleed = isFullScreenApp;

  return (
    // Feature visibility (what non-owner accounts can see) loads once here and
    // feeds the sidebar, the command menu and the route guard.
    <FeatureFlagsProvider>
      <WorkspaceCurrencyProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-bg text-fg antialiased font-sans select-none">
          {/* Universal Collapsible Sidebar — hidden on full-screen boards & editors */}
          {!hideSidebar && (
            <Suspense fallback={null}>
              <DashboardSidebar />
            </Suspense>
          )}

          {/* Main Content Area — hidden y-axis scrollbar while retaining smooth scrolling */}
          <main
            className={
              fullBleed
                ? "flex-1 flex flex-col h-full w-full overflow-hidden relative bg-bg"
                : "flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden relative bg-bg scrollbar-hide"
            }
          >
            {/* Top utility bar: command palette + real-time theme toggle (hidden on full-screen boards & editors) */}
            {!hideTopBar && (
              <div className="sticky top-0 z-30 flex items-center justify-end gap-3 px-6 md:px-8 h-16 shrink-0 bg-card border-b border-dashed border-line">
                <CommandMenu />
              </div>
            )}

            {/* flex-col lets PageTransition's flex-1 child stretch: without it
                the full-bleed editor roots' h-full resolves against an
                auto-height wrapper and the canvas collapses to 0px. */}
            <div className={fullBleed ? "flex flex-col flex-1 w-full h-full min-h-0" : "flex-1 min-h-0 px-6 md:px-8 py-8 max-w-7xl w-full mx-auto space-y-8"}>
              <PageTransition>
                <FeatureRouteGuard>{children}</FeatureRouteGuard>
              </PageTransition>
            </div>
          </main>
        </div>
      </WorkspaceCurrencyProvider>
    </FeatureFlagsProvider>
  );
}
