"use client";

import React, { Suspense } from "react";
import { usePathname } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/Sidebar";
import { CommandMenu } from "@/components/common/CommandMenu";
import { ThemeToggle } from "@/components/common/ThemeToggle";

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
  const fullBleed = isReportCard || isPlannerBoard;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-fg antialiased font-sans select-none">
      {/* Universal Collapsible Sidebar */}
      <Suspense fallback={null}>
        <DashboardSidebar />
      </Suspense>

      {/* Main Content Area */}
      <main
        className={`flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden relative bg-bg ${
          pathname?.startsWith("/dashboard/clients") ? "no-scrollbar" : ""
        }`}
      >
        {/* Top utility bar: command palette + real-time theme toggle (matches sidebar background & dashed border, aligned to right) */}
        {!isPlannerBoard && (
          <div className="sticky top-0 z-30 flex items-center justify-end gap-3 px-6 md:px-8 h-16 shrink-0 bg-card border-b border-dashed border-line">
            {!isReportCard && <CommandMenu />}
            <ThemeToggle />
          </div>
        )}

        <div className={fullBleed ? "flex-1 w-full h-full min-h-0" : "flex-1 px-6 md:px-8 py-8 max-w-7xl w-full mx-auto space-y-8"}>
          {children}
        </div>
      </main>
    </div>
  );
}
