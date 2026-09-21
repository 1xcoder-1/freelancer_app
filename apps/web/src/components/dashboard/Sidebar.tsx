"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
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
  IdCard,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  betaTag?: string;
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
  { title: "Smart Automations", href: "/dashboard/automations", icon: Zap, betaTag: "BETA" },
  { title: "Expenses & Taxes", href: "/dashboard/taxes", icon: Calculator },
  { title: "Report Card", href: "/dashboard/report-card", icon: IdCard },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
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

  const userName = user?.firstName || user?.fullName || "Freelancer";

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 72 : 248 }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="relative flex flex-col h-screen border-r border-dashed border-line bg-card select-none z-40 shrink-0"
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
                    {item.betaTag && (
                      <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-muted font-mono tracking-wide ml-2 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
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
  );
}
