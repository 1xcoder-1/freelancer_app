"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
} from "@/components/animated-icons";
import { LogOut } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { FEATURES, type FeatureSubItem } from "@/lib/features";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

// Precise active detection: handles both the ?tab= URL style used by the
// panels/command menu and the legacy standalone routes (/dashboard/leads…).
// It lives on each FeatureSubItem in lib/features.ts.

// Row-level play: moving the pointer anywhere onto a nav row sets its icon
// animating, not just a hover landing on the small glyph itself. Icons that
// stayed lucide re-exports have no handle and simply keep their CSS styles.
function NavIcon({ icon: Icon, className }: { icon: React.ElementType; className?: string }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const handleRef = useRef<unknown>(null);
  useEffect(() => {
    const row = wrapRef.current?.closest<HTMLElement>("[data-nav-row]");
    if (!row) return;
    const play = () => {
      const h = handleRef.current as { play?: () => void } | null;
      if (typeof h?.play === "function") h.play();
    };
    row.addEventListener("pointerenter", play);
    return () => row.removeEventListener("pointerenter", play);
  }, [Icon]);
  const AnyIcon = Icon as React.ComponentType<Record<string, unknown>>;
  return (
    <span ref={wrapRef} className="contents">
      <AnyIcon ref={handleRef} className={className} />
    </span>
  );
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  children?: FeatureSubItem[];
}

// Account menu under the sidebar user pill: signed-in identity, the profile
// page, a real-time theme switch and the only sign-out in the app. Opens
// upward from the bottom of the rail (absolute, inside the aside — nothing
// clips it because the nav list's overflow container is a sibling, not an
// ancestor).
function ProfileMenuPanel({
  email,
  onClose,
}: {
  email?: string;
  onClose: () => void;
}) {
  // Lazy init is safe: the panel only renders after a user click (never in
  // the SSR output), so document is always available here.
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"
  );

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("fb-theme", next);
    setTheme(next);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className="absolute bottom-full left-0 mb-2 w-60 rounded-2xl bg-card border border-line shadow-2xl shadow-black/40 p-1.5 origin-bottom-left"
    >
      <div className="px-3 pt-2 pb-2.5 min-w-0">
        <div className="text-[11px] text-muted">Signed in as</div>
        <div className="text-xs font-semibold text-accent truncate mt-0.5" suppressHydrationWarning>
          {email || "…"}
        </div>
      </div>

      <div className="border-t border-dashed border-line my-1" />

      <Link
        href="/dashboard/settings"
        onClick={onClose}
        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-fg hover:bg-surface transition-colors"
      >
        <User className="w-4 h-4 text-muted shrink-0" />
        My Profile
      </Link>

      <button
        type="button"
        onClick={toggleTheme}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-fg hover:bg-surface transition-colors"
      >
        <span className="w-4 h-4 flex items-center justify-center text-muted shrink-0">
          {/* Same half-circle mark as the top-bar ThemeToggle */}
          {theme === "dark" ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          )}
        </span>
        Toggle theme
      </button>

      <div className="border-t border-dashed border-line my-1" />

      <LogOutButton onDone={onClose} />
    </motion.div>
  );
}

function LogOutButton({ onDone }: { onDone: () => void }) {
  const clerk = useClerk();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleLogOut = async () => {
    setBusy(true);
    try {
      await clerk.signOut();
      router.push("/sign-in");
    } finally {
      onDone();
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogOut}
      disabled={busy}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-fg hover:bg-surface hover:text-danger transition-colors disabled:opacity-50"
    >
      <LogOut className="w-4 h-4 text-muted shrink-0" />
      Log Out
    </button>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { isVisible, labelFor } = useFeatureFlags();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Nav is derived from the shared feature registry so the owner's Settings →
  // Features toggles and label overrides apply here automatically. Hidden
  // features drop out of the rail entirely (children inherit the gate).
  const navItems = useMemo<NavItem[]>(
    () =>
      FEATURES.filter((f) => !f.commandOnly && (f.locked || isVisible(f.key))).map((f) => ({
        title: labelFor(f.key, f.title),
        href: f.href,
        icon: f.icon,
        children: f.subItems?.map((s) => ({
          ...s,
          title: labelFor(s.id, s.title),
        })),
      })),
    [isVisible, labelFor]
  );

  // Submenu state for flyout & accordion
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);

  // The flyout is hover-driven, so closing is scheduled instead of instant:
  // the pointer has to cross an 8px gap between rail and flyout, and leaving
  // the trigger without ever entering the flyout must still dismiss it.
  const flyoutCloseTimer = useRef<number | null>(null);
  const cancelFlyoutClose = useCallback(() => {
    if (flyoutCloseTimer.current !== null) {
      window.clearTimeout(flyoutCloseTimer.current);
      flyoutCloseTimer.current = null;
    }
  }, []);
  const scheduleFlyoutClose = useCallback(() => {
    cancelFlyoutClose();
    flyoutCloseTimer.current = window.setTimeout(() => setOpenSubmenu(null), 180);
  }, [cancelFlyoutClose]);

  useEffect(
    () => () => {
      if (flyoutCloseTimer.current !== null) window.clearTimeout(flyoutCloseTimer.current);
    },
    []
  );

  const currentSearchStr = searchParams?.toString() ? `?${searchParams.toString()}` : "";
  const fullCurrentPath = `${pathname}${currentSearchStr}`;
  const currentTab = searchParams?.get("tab") ?? "";

  const isChildActive = (child: FeatureSubItem) => child.active(pathname, currentTab);

  // The collapsed flyout is portalled to <body> (the nav list's overflow-y-auto
  // would otherwise clip it), so its position is anchored from the button rect.
  const openSubmenuAt = (key: string, el: HTMLElement) => {
    cancelFlyoutClose();
    const rect = el.getBoundingClientRect();
    const count = navItems.find((n) => n.title === key)?.children?.length ?? 0;
    const estHeight = count * 40 + 16;
    setFlyoutPos({
      left: rect.right + 8,
      top: Math.max(8, Math.min(rect.top, window.innerHeight - estHeight)),
    });
    setOpenSubmenu(key);
  };

  const isLinkActive = (href: string) => {
    if (href.includes("?")) {
      return fullCurrentPath === href;
    }
    if (href === "/dashboard/projects") {
      return pathname === "/dashboard/projects" && !searchParams?.get("tab");
    }
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

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

  // Account menu under the user pill (both expanded and collapsed modes).
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  // Close flyout & account menu upon navigation
  useEffect(() => {
    setOpenSubmenu(null);
    setProfileMenuOpen(false);
  }, [pathname, searchParams]);

  // Close flyout on outside click (the portalled flyout lives outside flyoutRef)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        flyoutRef.current &&
        !flyoutRef.current.contains(target) &&
        !portalRef.current?.contains(target)
      ) {
        setOpenSubmenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userName = mounted ? (user?.firstName || user?.fullName || "Freelancer") : "Freelancer";
  const userImageUrl = mounted ? user?.imageUrl : undefined;
  const userEmail = mounted ? user?.primaryEmailAddress?.emailAddress : undefined;

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [profileMenuOpen]);

  const submenuItem =
    navItems.find((n) => n.children?.length && n.title === openSubmenu) ?? null;

  return (
    <>
      {/* Dismiss backdrop for the expanded mobile overlay — wrapped in
          AnimatePresence so its exit fade actually runs (better-ui exits are
          shorter than enters: 150ms ease-out). */}
      <AnimatePresence>
        {isMobile && !isCollapsed && (
          <motion.div
            key="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsCollapsed(true)}
            aria-hidden
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 72 : 248 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        className={`relative flex flex-col h-screen border-r border-dashed border-line bg-card select-none z-50 transition-colors ${isMobile ? "fixed inset-y-0 left-0 shadow-2xl shadow-black/60" : "shrink-0"
          }`}
      >
        {/* Brand Header */}
        <div
          className={`flex items-center h-16 border-b border-dashed border-line ${isCollapsed ? "justify-center px-0" : "px-5 justify-between"
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
        <div
          className="flex-1 overflow-y-auto px-3 py-4 space-y-1 relative scrollbar-none"
          ref={flyoutRef}
          onScroll={() => setOpenSubmenu(null)}
        >
          {navItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isChildActiveItem = hasChildren
              ? item.children!.some(isChildActive)
              : false;

            const isActive =
              isChildActiveItem ||
              isLinkActive(item.href);

            const Icon = item.icon;
            const isSubmenuOpen = openSubmenu === item.title;

            // Item with Submenu (e.g. Clients -> Clients Roster, Leads Pipeline, Intake Forms, Projects -> Active, Invoices, Contracts, etc.)
            if (hasChildren) {
              return (
                <div key={item.title} className="relative">
                  {/* Collapsed Mode (flyout rendered via portal, see bottom) */}
                  {isCollapsed ? (
                    <div>
                      <button
                        type="button"
                        data-nav-row
                        onClick={(e) => {
                          if (isSubmenuOpen) {
                            setOpenSubmenu(null);
                            return;
                          }
                          openSubmenuAt(item.title, e.currentTarget);
                        }}
                        onMouseEnter={(e) => openSubmenuAt(item.title, e.currentTarget)}
                        onMouseLeave={scheduleFlyoutClose}
                        className={`press relative flex items-center rounded-full text-sm w-11 h-11 mx-auto justify-center ${isActive
                            ? "bg-accent-soft text-fg font-bold border border-accent/40 shadow-xs"
                            : "text-muted font-medium hover:bg-surface hover:text-fg"
                          }`}
                        title={item.title}
                      >
                        <NavIcon icon={Icon} className={`w-5 h-5 shrink-0 ${isActive ? "text-accent" : ""}`} />
                        {/* Tiny active accent dot */}
                        {isActive && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
                        )}
                      </button>
                    </div>
                  ) : (
                    /* Expanded Accordion Mode */
                    <div className="space-y-1">
                      <button
                        type="button"
                        data-nav-row
                        onClick={() => setOpenSubmenu(isSubmenuOpen ? null : item.title)}
                        className={`press w-full flex items-center justify-between px-4 py-2.5 rounded-full text-sm ${isActive
                            ? "bg-accent-soft text-fg font-bold border border-accent/40 shadow-xs"
                            : "text-muted font-medium hover:bg-surface hover:text-fg"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <NavIcon icon={Icon} className={`w-5 h-5 shrink-0 ${isActive ? "text-accent" : ""}`} />
                          <span className="truncate text-fg font-semibold">{item.title}</span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${isSubmenuOpen ? "rotate-180" : ""
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
                              const isCurrent = isChildActive(child);

                              return (
                                <Link
                                  key={child.title}
                                  href={child.href}
                                  data-nav-row
                                  className={`press flex items-center justify-between px-3 py-2 rounded-xl text-xs ${isCurrent
                                      ? "bg-accent-soft text-fg font-bold border border-accent/40 shadow-xs"
                                      : "text-muted hover:bg-surface hover:text-fg font-medium"
                                    }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <NavIcon icon={ChildIcon} className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? "text-accent" : "text-muted"}`} />
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
                  data-nav-row
                  className={`press flex items-center gap-3 rounded-full text-sm ${isActive
                      ? "bg-accent-soft text-fg font-bold border border-accent/40 shadow-xs"
                      : "text-muted font-medium hover:bg-surface hover:text-fg"
                    } ${isCollapsed ? "w-11 h-11 mx-auto justify-center px-0" : "px-4 py-2.5"}`}
                  title={item.title}
                >
                  <NavIcon icon={Icon} className={`w-5 h-5 shrink-0 ${isActive ? "text-accent" : ""}`} />

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
              <div className="relative flex-1 min-w-0" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((o) => !o)}
                  className="w-full flex items-center gap-2.5 p-1.5 pr-3 rounded-full border border-dashed border-line-strong hover:border-accent/50 transition-colors group overflow-hidden"
                  title="Account"
                  aria-expanded={profileMenuOpen}
                  suppressHydrationWarning
                >
                  <span className="w-7 h-7 rounded-full overflow-hidden border border-line bg-surface shrink-0 flex items-center justify-center text-xs" suppressHydrationWarning>
                    {userImageUrl ? (
                      <img src={userImageUrl} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-fg">{userName.charAt(0).toUpperCase()}</span>
                    )}
                  </span>
                  <span className="text-xs font-semibold text-fg truncate" suppressHydrationWarning>{userName}</span>
                </button>

                <AnimatePresence>
                  {profileMenuOpen && (
                    <ProfileMenuPanel email={userEmail} onClose={() => setProfileMenuOpen(false)} />
                  )}
                </AnimatePresence>
              </div>

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
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((o) => !o)}
                  className="w-8 h-8 rounded-full border border-dashed border-line-strong flex items-center justify-center hover:border-accent/50 transition-colors overflow-hidden"
                  title="Account"
                  aria-expanded={profileMenuOpen}
                  suppressHydrationWarning
                >
                  {userImageUrl ? (
                    <img src={userImageUrl} alt={userName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-fg" suppressHydrationWarning>{userName.charAt(0).toUpperCase()}</span>
                  )}
                </button>

                <AnimatePresence>
                  {profileMenuOpen && (
                    <ProfileMenuPanel email={userEmail} onClose={() => setProfileMenuOpen(false)} />
                  )}
                </AnimatePresence>
              </div>

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

      {/* Smooth Flyout Submenu in Collapsed Mode — portalled to <body> so the
          nav list's overflow clipping can't cut it off next to the 72px rail */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isCollapsed && submenuItem && flyoutPos && (
              <motion.div
                ref={portalRef}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                onMouseEnter={cancelFlyoutClose}
                onMouseLeave={scheduleFlyoutClose}
                style={{ position: "fixed", top: flyoutPos.top, left: flyoutPos.left, zIndex: 100 }}
                className="w-56 max-h-[60vh] overflow-y-auto scrollbar-none p-1.5 rounded-2xl bg-card border border-line shadow-2xl space-y-0.5 backdrop-blur-md"
              >
                {submenuItem.children?.map((child) => {
                  const ChildIcon = child.icon;
                  const isCurrent = isChildActive(child);

                  return (
                    <Link
                      key={child.title}
                      href={child.href}
                      data-nav-row
                      onClick={() => setOpenSubmenu(null)}
                      className={`press flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${isCurrent
                          ? "bg-accent-soft text-fg font-bold border border-accent/40 shadow-xs"
                          : "text-fg hover:bg-surface hover:text-accent"
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <NavIcon icon={ChildIcon} className={`w-4 h-4 shrink-0 ${isCurrent ? "text-accent" : "text-muted"}`} />
                        <span className="text-fg font-semibold truncate">{child.title}</span>
                      </div>
                      {isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
