"use client";

import React from "react";
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-fg antialiased font-sans">
      {/* Universal Collapsible Sidebar */}
      <DashboardSidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden relative bg-bg">
        {/* Top utility bar: command palette + real-time theme toggle */}
        <div className="sticky top-0 z-30 flex items-center justify-end gap-2 px-6 md:px-8 h-14 shrink-0">
          {!isReportCard && <CommandMenu />}
          <ThemeToggle />
        </div>

        <div className={isReportCard ? "flex-1 w-full h-full" : "flex-1 px-6 md:px-8 pb-10 max-w-7xl w-full mx-auto space-y-8"}>
          {children}
        </div>
      </main>
    </div>
  );
}
