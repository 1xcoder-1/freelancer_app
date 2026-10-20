"use client";

import React, { Suspense } from "react";
import { usePathname } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/Sidebar";
import { CommandMenu } from "@/components/common/CommandMenu";
import { ThemeToggle } from "@/components/common/ThemeToggle";
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
  const isReportCard = pathname?.startsWith("/dashboard/report-card");
  // The board editor is a full-screen canvas surface: it owns its own header
  // (back / rename / sync / theme), so it gets an un-padded area and skips the
  // shared top bar. The board LIST (/dashboard/planner) stays a normal page.
  const isPlannerBoard = /^\/dashboard\/planner\/[^/]+\/?$/.test(pathname || "");
  const hideTopBar = isPlannerBoard;
  const fullBleed = isReportCard || isPlannerBoard;

  return (
    // Feature visibility (what non-owner accounts can see) loads once here and
    // feeds the sidebar, the command menu and the route guard.
    <FeatureFlagsProvider>
      <WorkspaceCurrencyProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-bg text-fg antialiased font-sans select-none">
        {/* Universal Collapsible Sidebar */}
        <Suspense fallback={null}>
          <DashboardSidebar />
        </Suspense>

        {/* Main Content Area — hidden y-axis scrollbar while retaining smooth scrolling */}
        <main className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden relative bg-bg scrollbar-hide">
          {/* Top utility bar: command palette + real-time theme toggle (matches sidebar background & dashed border, aligned to right) */}
          {!hideTopBar && (
            <div className="sticky top-0 z-30 flex items-center justify-end gap-3 px-6 md:px-8 h-16 shrink-0 bg-card border-b border-dashed border-line">
              {!isReportCard && <CommandMenu />}
              <ThemeToggle />
            </div>
          )}

          <div className={fullBleed ? "flex-1 w-full h-full min-h-0" : "flex-1 min-h-0 px-6 md:px-8 py-8 max-w-7xl w-full mx-auto space-y-8"}>
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
