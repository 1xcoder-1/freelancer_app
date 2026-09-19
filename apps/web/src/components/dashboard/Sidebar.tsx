"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, UserButton } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Receipt,
  Clock,
  Users,
  LayoutGrid,
  Sparkles,
  ClipboardList,
  Calendar,
  Calculator,
  Briefcase,
  IdCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Flame,
  Award,
  CreditCard,
  FileCheck2
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  betaTag?: string;
  isSpecial?: boolean;
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: Home },
  { title: "Invoices & Escrow", href: "/dashboard/invoices", icon: Receipt },
  { title: "Time Tracking", href: "/dashboard/time-tracker", icon: Clock },
  { title: "Clients CRM", href: "/dashboard/clients", icon: Users },
  { title: "Projects & Tasks", href: "/dashboard/projects", icon: LayoutGrid },
  { title: "Proposals & AI", href: "/dashboard/proposals", icon: Sparkles, betaTag: "AI" },
  { title: "Client Intake", href: "/dashboard/intake", icon: ClipboardList, betaTag: "BETA" },
  { title: "Booking Calendar", href: "/dashboard/booking", icon: Calendar },
  { title: "Expenses & Taxes", href: "/dashboard/taxes", icon: Calculator },
  { title: "Report Card", href: "/dashboard/report-card", icon: IdCard, isSpecial: true },
  { title: "Settings & Workspace", href: "/dashboard/settings", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const userName = user?.firstName || user?.fullName || "Abdullah";

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 76 : 256 }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="relative flex flex-col h-screen border-r border-white/10 bg-[#0d1117]/95 backdrop-blur-2xl select-none z-40 shrink-0"
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
          {/* Guru / MasterJi styled Brand Icon */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20 shrink-0">
            <span className="text-base">⚡</span>
          </div>

          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-baseline gap-1"
            >
              <span className="font-extrabold text-base tracking-tight text-white">
                Freelancer
              </span>
              <span className="font-extrabold text-base tracking-tight text-amber-500">
                Book
              </span>
            </motion.div>
          )}
        </Link>
      </div>

      {/* Main Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          const isSpecialProfile = item.isSpecial;

          return (
            <Link key={item.title} href={item.href}>
              <div
                className={`relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-[13px] font-medium transition-all ${
                  isActive
                    ? isSpecialProfile
                      ? "bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30 shadow-sm"
                      : "bg-white/[0.08] text-white font-semibold border border-white/10 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
                title={isCollapsed ? item.title : undefined}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive
                      ? isSpecialProfile
                        ? "text-amber-400"
                        : "text-white"
                      : "text-slate-400 group-hover:text-slate-200"
                  }`}
                />

                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1 overflow-hidden">
                    <span className="truncate">{item.title}</span>
                    {item.betaTag && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400/90 font-mono tracking-wide ml-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        {item.betaTag}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Bottom User Pill Matching Provided MasterJi Design */}
      <div className="p-3 border-t border-white/5 bg-slate-950/40">
        {!isCollapsed ? (
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard/settings"
              className="flex-1 flex items-center gap-2.5 p-1.5 pr-3 rounded-full border border-dashed border-white/20 bg-white/[0.02] hover:bg-white/[0.06] transition-all group overflow-hidden"
              title="View Profile Settings"
            >
              <div className="w-7 h-7 rounded-full overflow-hidden border border-white/10 bg-slate-800 shrink-0 flex items-center justify-center text-xs">
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-bold text-slate-300">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium text-slate-300 group-hover:text-white truncate">
                {userName}
              </span>
            </Link>

            {/* Collapse Trigger on right */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="ml-2 p-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Link
              href="/dashboard/settings"
              className="w-8 h-8 rounded-full border border-dashed border-white/20 flex items-center justify-center hover:scale-105 transition-transform overflow-hidden"
              title={userName}
            >
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={userName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-slate-300">
                  {userName.charAt(0).toUpperCase()}
                </span>
              )}
            </Link>

            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Expand Sidebar"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
