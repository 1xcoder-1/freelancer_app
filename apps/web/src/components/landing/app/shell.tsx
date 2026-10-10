"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  ChevronDown,
  Clock,
  Home,
  IdCard,
  LayoutGrid,
  PenLine,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { T } from "./tokens";
import { ClientsView } from "./views-clients";
import { HomeView } from "./views-home";
import { MoneyView } from "./views-money";
import { TimeView } from "./views-time";

/* App chrome shared by every desktop mock: sidebar, topbar, and the
   auto-cycling window used by the hero and the laptop showcase. */

const navItems: { title: string; icon: React.ElementType; chevron?: boolean }[] = [
  { title: "Home", icon: Home },
  { title: "Clients", icon: Users, chevron: true },
  { title: "Projects", icon: LayoutGrid, chevron: true },
  { title: "Time", icon: Clock },
  { title: "Money", icon: Wallet },
  { title: "Proposals", icon: Sparkles },
  { title: "Booking", icon: Calendar },
  { title: "Planner", icon: PenLine },
  { title: "Profile", icon: IdCard },
  { title: "Settings", icon: Settings },
];

export function AppSidebar({ active }: { active: string }) {
  return (
    <aside className="flex w-[248px] shrink-0 select-none flex-col border-r border-dashed border-[#28282a] bg-[#161617]">
      <div className="flex h-16 items-center justify-between border-b border-dashed border-[#28282a] px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[#d46b28]/40 bg-[#261912] font-mono text-xs font-bold text-[#f0efed] shadow-xs">
            fb
          </span>
          <span className="whitespace-nowrap text-[15px] font-bold tracking-tight text-[#f0efed]">
            Freelance<span className="font-bold text-[#d46b28]">Book</span>
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-hidden px-3 py-4">
        {navItems.map((item) => {
          const isActive = item.title === active;
          return (
            <div
              key={item.title}
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm",
                isActive
                  ? "border border-[#d46b28]/40 bg-[#261912] font-bold text-[#f0efed] shadow-xs"
                  : "font-medium text-[#a19d98]"
              )}
            >
              <item.icon
                className={cn(
                  "size-5 shrink-0",
                  isActive ? "text-[#d46b28]" : "text-[#a19d98]"
                )}
              />
              <span className="flex-1 truncate font-semibold text-[#f0efed]">
                {item.title}
              </span>
              {item.chevron && <ChevronDown className="size-4 text-[#a19d98]" />}
            </div>
          );
        })}
      </div>

      <div className="border-t border-dashed border-[#28282a] p-3">
        <div className="flex items-center gap-2.5 overflow-hidden rounded-full border border-dashed border-[#38383b] p-1.5 pr-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#28282a] bg-[#1d1d1f] text-xs font-bold text-[#f0efed]">
            A
          </span>
          <span className="truncate text-xs font-semibold text-[#f0efed]">Alex</span>
        </div>
      </div>
    </aside>
  );
}

export function AppTopbar() {
  return (
    <div className="flex h-16 shrink-0 items-center justify-end gap-2.5 border-b border-dashed border-[#28282a] bg-[#161617] px-6">
      <div className="flex h-9 w-[248px] items-center gap-2 rounded-full border border-[#28282a] bg-[#0e0e0f] px-3.5 text-[13px] text-[#6f6b66]">
        <Search className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Search or run a command</span>
        <span className="shrink-0 rounded-md border border-[#28282a] px-1.5 py-0.5 font-mono text-[10px] text-[#a19d98]">
          ⌘K
        </span>
      </div>
      <span className="flex size-9 items-center justify-center rounded-xl border border-[#28282a] bg-[#161617] text-[#a19d98]">
        <Sun className="size-4" />
      </span>
    </div>
  );
}

/* Hero window tabs and the sidebar row each one lights up. */
export type AppViewId = "clients" | "time" | "money" | "home";

export const views: { id: AppViewId; nav: string }[] = [
  { id: "clients", nav: "Clients" },
  { id: "time", nav: "Time" },
  { id: "money", nav: "Projects" },
  { id: "home", nav: "Home" },
];

/* Cycles the showcase views, paused while the tab is hidden: rAF is
   suspended there, so a pending AnimatePresence exit would pin the old view. */
export function useAppCycle(intervalMs: number) {
  const [active, setActive] = React.useState(0);
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const startCycle = React.useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setActive((a) => (a + 1) % views.length);
    }, intervalMs);
  }, [intervalMs]);

  const stopCycle = React.useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  React.useEffect(() => {
    const onVisibility = () => (document.hidden ? stopCycle() : startCycle());
    if (!document.hidden) startCycle();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopCycle();
    };
  }, [startCycle, stopCycle]);

  return views[active];
}

/* sidebar + topbar + one crossfaded view — the hero and laptop screens. */
export function AppWindow({ view }: { view: AppViewId }) {
  const nav = views.find((v) => v.id === view)!.nav;
  return (
    <div className="flex h-full" style={{ background: T.bg }}>
      <AppSidebar active={nav} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="absolute inset-0 overflow-hidden px-8 py-6"
            >
              {view === "clients" && <ClientsView />}
              {view === "time" && <TimeView />}
              {view === "money" && <MoneyView />}
              {view === "home" && <HomeView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
