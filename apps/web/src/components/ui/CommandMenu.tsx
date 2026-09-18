"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Command,
  X,
  Layers,
  Users,
  Clock,
  FileText,
  Sparkles,
  Cpu,
  DollarSign,
  Heart,
  ArrowRight,
} from "lucide-react";

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const searchableItems = [
    { title: "Client CRM & Lead Pipeline", href: "/features#crm", category: "Features", icon: Users },
    { title: "Multi-View Projects (Kanban, Gantt)", href: "/features#projects", category: "Features", icon: Layers },
    { title: "Time Tracking & Pomodoro", href: "/features#time", category: "Features", icon: Clock },
    { title: "Invoices & PDF Generation", href: "/features#finance", category: "Features", icon: FileText },
    { title: "Windows Quick Capture (Ctrl+Shift+F)", href: "/features#desktop", category: "Features", icon: Command },
    { title: "System Architecture (FastAPI + D1)", href: "/architecture", category: "System", icon: Cpu },
    { title: "Book AI Copilot Assistant", href: "/ai", category: "AI", icon: Sparkles },
    { title: "Pricing & 100% Free Core Plan", href: "/pricing", category: "Pricing", icon: DollarSign },
    { title: "About Our Story & Manifesto", href: "/about", category: "Company", icon: Heart },
    { title: "Sign In to Your Workspace", href: "/sign-in", category: "Auth", icon: ArrowRight },
    { title: "Create Free Account", href: "/sign-up", category: "Auth", icon: ArrowRight },
  ];

  // Toggle on Ctrl+K / Cmd+K
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredItems = query.trim() === ""
    ? searchableItems
    : searchableItems.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      );

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  return (
    <>
      {/* Quick Search Shortcut Trigger Pill (Visible on large screens) */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all cursor-pointer"
        aria-label="Search site (Ctrl+K)"
      >
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <span>Quick search...</span>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
          Ctrl K
        </kbd>
      </button>

      {/* Modal Dialog */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            {/* Dialog Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden z-10 text-slate-100"
            >
              {/* Input Header */}
              <div className="flex items-center px-4 border-b border-slate-800">
                <Search className="w-5 h-5 text-emerald-400 mr-3 flex-shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search modules, features, architecture..."
                  className="w-full py-4 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Results List */}
              <div className="max-h-80 overflow-y-auto p-3 space-y-1">
                {filteredItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No matching results found for &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  filteredItems.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelect(item.href)}
                        className="w-full p-3 rounded-2xl hover:bg-slate-800/80 transition-all flex items-center justify-between text-left group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                              {item.title}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {item.category}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer Tips */}
              <div className="px-4 py-2.5 bg-slate-950/80 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between font-mono">
                <span>Navigate with mouse or enter</span>
                <span>ESC to close</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
