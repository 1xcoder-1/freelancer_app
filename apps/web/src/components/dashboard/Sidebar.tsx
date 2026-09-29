"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronDown,
  Target,
  ClipboardList,
} from "lucide-react";

interface SubNavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  children?: SubNavItem[];
}

const navItems: NavItem[] = [
  { title: "Home", href: "/dashboard", icon: Home },
  {
    title: "Clients",
    href: "/dashboard/clients",
    icon: Users,
    children: [
      { title: "Clients Roster", href: "/dashboard/clients", icon: Users },
      { title: "Leads Pipeline", href: "/dashboard/leads", icon: Target },
      { title: "Intake Forms", href: "/dashboard/intake", icon: ClipboardList },
    ],
  },
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

  // Submenu state for flyout & accordion
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);

  // Auto-detect mobile screen sizes
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => {
      setIsMobile(mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Close flyout upon navigation
  useEffect(() => {
    setOpenSubmenu(null);
  }, [pathname]);

  // Close flyout on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        setOpenSubmenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userName = user?.firstName || user?.fullName || "Freelancer";

  return (
    <>
      {/* Dismiss backdrop for the expanded mobile overlay */}
      {isMobile && !isCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsCollapsed(true)}
          aria-hidden
        />
      )}

      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 72 : 248 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        className={`relative flex flex-col h-screen border-r border-dashed border-line bg-card select-none z-50 transition-colors ${
          isMobile ? "fixed inset-y-0 left-0 shadow-2xl shadow-black/60" : "shrink-0"
        }`}
      >
        {/* Brand Header */}
        <div
          className={`flex items-center h-16 border-b border-dashed border-line ${
            isCollapsed ? "justify-center px-0" : "px-5 justify-between"
          }`}
        >
          <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden group">
            <span className="w-8 h-8 rounded-xl bg-accent-soft border border-accent/40 text-fg font-bold group-hover:border-accent transition-all flex items-center justify-center text-xs font-mono shrink-0 shadow-xs">
              fb
            </span>

            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.2 }}
                className="font-display font-bold text-[15px] tracking-tight text-fg whitespace-nowrap"
              >
                Freelance<span className="text-accent font-bold">Book</span>
              </motion.span>
            )}
          </Link>
        </div>

        {/* Main Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 relative scrollbar-none" ref={flyoutRef}>
          {navItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isChildActive = hasChildren
              ? item.children?.some(
                  (c) =>
                    pathname === c.href ||
                    (c.href === "/dashboard/intake" &&
                      (pathname.startsWith("/dashboard/forms") || pathname.startsWith("/dashboard/intake"))) ||
                    (c.href !== "/dashboard" && pathname.startsWith(c.href))
                )
              : false;

            const isActive =
              isChildActive ||
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            const Icon = item.icon;
            const isSubmenuOpen = openSubmenu === item.title;

            // Item with Submenu (e.g. Clients -> Clients Roster, Leads Pipeline, Intake Forms)
            if (hasChildren) {
              return (
                <div key={item.title} className="relative">
                  {/* Collapsed Mode with Floating Flyout Menu */}
                  {isCollapsed ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setOpenSubmenu(isSubmenuOpen ? null : item.title)}
                        onMouseEnter={() => setOpenSubmenu(item.title)}
                        className={`relative flex items-center rounded-full text-sm transition-all duration-200 w-11 h-11 mx-auto justify-center ${
                          isActive
                            ? "bg-accent-soft text-fg font-bold border border-accent/40 shadow-xs"
                            : "text-muted font-medium hover:bg-surface hover:text-fg"
                        }`}
                        title={item.title}
                      >
                        <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-accent" : ""}`} />
                        {/* Tiny active accent dot */}
                        {isActive && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
                        )}
                      </button>

                      {/* Smooth Flyout Submenu in Collapsed Mode */}
                      <AnimatePresence>
                        {isSubmenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, x: -10, scale: 0.94 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -10, scale: 0.94 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            onMouseLeave={() => setOpenSubmenu(null)}
                            className="absolute left-16 top-0 z-50 min-w-[210px] p-2 rounded-2xl bg-card border border-line shadow-2xl space-y-1.5 backdrop-blur-md"
                          >
                            <div className="px-3 py-1.5 border-b border-line/60 flex items-center justify-between">
                              <span className="text-[11px] font-bold text-fg uppercase tracking-wider">
                                {item.title} Features
                              </span>
                              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                            </div>

                            <div className="space-y-1">
                              {item.children?.map((child) => {
                                const ChildIcon = child.icon;
                                const isCurrent =
                                  pathname === child.href ||
                                  (child.href === "/dashboard/intake" &&
                                    (pathname.startsWith("/dashboard/forms") ||
                                      pathname.startsWith("/dashboard/intake"))) ||
                                  (child.href !== "/dashboard" && pathname.startsWith(child.href));

                                return (
                                  <Link
                                    key={child.title}
                                    href={child.href}
                                    onClick={() => setOpenSubmenu(null)}
                                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                                      isCurrent
                                        ? "bg-accent-soft text-fg font-bold border border-accent/40 shadow-xs"
                                        : "text-fg hover:bg-surface hover:text-accent"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <ChildIcon className={`w-4 h-4 shrink-0 ${isCurrent ? "text-accent" : "text-muted"}`} />
                                      <span className="text-fg font-semibold">{child.title}</span>
                                    </div>
                                    {isCurrent && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                                    )}
                                  </Link>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    /* Expanded Accordion Mode */
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setOpenSubmenu(isSubmenuOpen ? null : item.title)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-sm transition-all duration-200 ${
                          isActive
                            ? "bg-accent-soft text-fg font-bold border border-accent/40 shadow-xs"
                            : "text-muted font-medium hover:bg-surface hover:text-fg"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-accent" : ""}`} />
                          <span className="truncate text-fg font-semibold">{item.title}</span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isSubmenuOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      <AnimatePresence>
                        {isSubmenuOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="pl-6 pr-2 py-1 space-y-1 border-l-2 border-accent/40 ml-4 mt-1 overflow-hidden"
                          >
                            {item.children?.map((child) => {
                              const ChildIcon = child.icon;
                              const isCurrent =
                                pathname === child.href ||
                                (child.href === "/dashboard/intake" &&
                                  (pathname.startsWith("/dashboard/forms") ||
                                    pathname.startsWith("/dashboard/intake"))) ||
                                (child.href !== "/dashboard" && pathname.startsWith(child.href));

                              return (
                                <Link
                                  key={child.title}
                                  href={child.href}
                                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all duration-150 ${
                                    isCurrent
                                      ? "bg-accent-soft text-fg font-bold border border-accent/40 shadow-xs"
                                      : "text-muted hover:bg-surface hover:text-fg font-medium"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <ChildIcon className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? "text-accent" : "text-muted"}`} />
                                    <span className="text-fg font-medium">{child.title}</span>
                                  </div>
                                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                                </Link>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              );
            }

            // Standard Single Navigation Item
            return (
              <Link key={item.title} href={item.href} className="block">
                <div
                  className={`flex items-center gap-3 rounded-full text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-accent-soft text-fg font-bold border border-accent/40 shadow-xs"
                      : "text-muted font-medium hover:bg-surface hover:text-fg"
                  } ${isCollapsed ? "w-11 h-11 mx-auto justify-center px-0" : "px-4 py-2.5"}`}
                  title={item.title}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-accent" : ""}`} />

                  {!isCollapsed && (
                    <div className="flex items-center justify-between flex-1 overflow-hidden">
                      <span className="truncate text-fg font-semibold">{item.title}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom User Pill + Expand / Collapse Switcher */}
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
                    <span className="font-bold text-fg">{userName.charAt(0).toUpperCase()}</span>
                  )}
                </span>
                <span className="text-xs font-semibold text-fg truncate">{userName}</span>
              </Link>

              <button
                onClick={() => setIsCollapsed(true)}
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
                  <span className="text-xs font-bold text-fg">{userName.charAt(0).toUpperCase()}</span>
                )}
              </Link>

              <button
                onClick={() => setIsCollapsed(false)}
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
