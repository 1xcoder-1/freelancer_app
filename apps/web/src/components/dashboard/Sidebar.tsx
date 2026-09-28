"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  Home,
  Clock,
  Users,
  Wallet,
  LayoutGrid,
  Sparkles,
  Calendar,
  IdCard,
  PenLine,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

// One-word labels on purpose: the app was simplified so every freelancer
// (even a first-timer) knows what each section is at a glance. Leads, forms,
// invoices, expenses and automations now live inside Clients / Projects /
// Money / Settings.
const navItems: NavItem[] = [
  { title: "Home", href: "/dashboard", icon: Home },
  { title: "Clients", href: "/dashboard/clients", icon: Users },
  { title: "Time", href: "/dashboard/time-tracker", icon: Clock },
  { title: "Projects", href: "/dashboard/projects", icon: LayoutGrid },
  { title: "Money", href: "/dashboard/cashflow", icon: Wallet },
  { title: "Proposals", href: "/dashboard/proposals", icon: Sparkles },
  { title: "Booking", href: "/dashboard/booking", icon: Calendar },
  { title: "Planner", href: "/dashboard/planner", icon: PenLine },
  { title: "Profile", href: "/dashboard/report-card", icon: IdCard },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Small screens: sidebar opens as an overlay ALWAYS in collapsed (icon-only)
  // format so it never eats the dashboard content width. Expanding it on
  // mobile floats it above the page with a dismiss backdrop.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => {
      setIsMobile(mq.matches);
      // Mobile opens collapsed (icons only); desktop opens expanded
      setIsCollapsed(mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Collapse the mobile overlay whenever navigation happens
  useEffect(() => {
    if (isMobile) setIsCollapsed(true);
  }, [pathname, isMobile]);

  const userName = user?.firstName || user?.fullName || "Freelancer";

  return (
    <>
      {/* Dismiss backdrop for the expanded mobile overlay */}
      {isMobile && !isCollapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsCollapsed(true)}
          aria-hidden
        />
      )}

      <motion.aside
        animate={{ width: isCollapsed ? 72 : 248 }}
        transition={{ duration: 0.22, ease: "easeInOut" }}
        className={`relative flex flex-col h-screen border-r border-dashed border-line bg-card select-none z-50 ${
          isMobile ? "fixed inset-y-0 left-0 shadow-2xl shadow-black/50" : "shrink-0"
        }`}
      >
      {/* Brand Header — bold wordmark like the reference */}
      <div className="flex items-center h-16 px-5 border-b border-dashed border-line">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <span className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-accent-fg text-[11px] font-black font-mono shrink-0">
            fb
          </span>

          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-display font-bold text-[15px] tracking-tight text-fg whitespace-nowrap"
            >
              Freelance<span className="text-accent">Book</span>
            </motion.span>
          )}
        </Link>
      </div>

      {/* Main Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link key={item.title} href={item.href}>
              <div
                className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-sm transition-colors ${
                  isActive
                    ? "bg-accent-soft text-accent font-semibold dark:bg-accent dark:text-accent-fg"
                    : "text-muted font-medium hover:bg-surface hover:text-fg"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
                title={isCollapsed ? item.title : undefined}
              >
                <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-current" : ""}`} />

                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1 overflow-hidden">
                    <span className="truncate">{item.title}</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Bottom dashed user pill + collapse control (reference style) */}
      <div className="p-3 border-t border-dashed border-line">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/dashboard/settings"
              className="flex-1 flex items-center gap-2.5 p-1.5 pr-3 rounded-full border border-dashed border-line-strong hover:border-accent/50 transition-colors group overflow-hidden"
              title="View Profile Settings"
            >
              <span className="w-7 h-7 rounded-full overflow-hidden border border-line bg-surface shrink-0 flex items-center justify-center text-xs">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-muted">{userName.charAt(0).toUpperCase()}</span>
                )}
              </span>
              <span className="text-xs font-semibold text-fg truncate">{userName}</span>
            </Link>

            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-full border border-line text-muted hover:text-fg hover:border-line-strong transition-colors shrink-0"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Link
              href="/dashboard/settings"
              className="w-8 h-8 rounded-full border border-dashed border-line-strong flex items-center justify-center hover:border-accent/50 transition-colors overflow-hidden"
              title={userName}
            >
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt={userName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-muted">{userName.charAt(0).toUpperCase()}</span>
              )}
            </Link>

            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded-full border border-line text-muted hover:text-fg hover:border-line-strong transition-colors"
              title="Expand Sidebar"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      </motion.aside>
    </>
  );
}
