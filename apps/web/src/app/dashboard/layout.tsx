"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/Sidebar";
import { CommandMenu } from "@/components/ui/CommandMenu";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isReportCard = pathname?.startsWith("/dashboard/report-card");

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0d1117] text-slate-100 antialiased font-sans">
      {/* Universal Collapsible Sidebar */}
      <DashboardSidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden relative bg-[#121820]">
        {!isReportCard && <CommandMenu />}
        <div className={isReportCard ? "flex-1 w-full h-full" : "flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8"}>
          {children}
        </div>
      </main>
    </div>
  );
}

