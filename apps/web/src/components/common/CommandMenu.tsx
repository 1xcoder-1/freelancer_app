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
      {/* Quick Search Shortcut Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-surface border border-dashed border-line-strong text-xs text-muted hover:text-fg hover:border-accent hover:bg-accent-soft/20 transition-all cursor-pointer w-48 sm:w-72 md:w-80 shadow-xs group"
        aria-label="Search modules and shortcuts (Ctrl+K)"
      >
        <div className="flex items-center gap-2 text-muted group-hover:text-fg transition-colors truncate">
          <Search className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="font-medium truncate">Search anything...</span>
        </div>
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-line bg-card text-[10px] font-mono text-muted font-semibold shadow-2xs shrink-0">
          Ctrl K
        </kbd>
      </button>

      {/* Modal Dialog */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Dialog Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 0 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg rounded-xl bg-card border border-dashed border-line shadow-2xl overflow-hidden z-10 text-fg"
            >
              {/* Input Header */}
              <div className="flex items-center px-4 border-b border-dashed border-line">
                <Search className="w-5 h-5 text-accent mr-3 flex-shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search modules, features, architecture..."
                  className="w-full py-4 bg-transparent text-sm text-fg placeholder:text-faint border-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 shadow-none ring-0"
                  autoFocus
                />
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-muted hover:text-fg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Results List */}
              <div className="max-h-80 overflow-y-auto p-3 space-y-1">
                {filteredItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-faint">
                    No matching results found for &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  filteredItems.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelect(item.href)}
                        className="w-full p-3 rounded-lg hover:bg-surface transition-all flex items-center justify-between text-left group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-surface border border-line flex items-center justify-center text-muted group-hover:text-accent group-hover:border-accent/40 transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-fg group-hover:text-accent transition-colors">
                              {item.title}
                            </div>
                            <div className="text-[10px] text-muted font-mono">
                              {item.category}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-faint group-hover:text-accent group-hover:translate-x-1 transition-all" />
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer Tips */}
              <div className="px-4 py-2.5 bg-surface border-t border-line text-[11px] text-faint flex items-center justify-between font-mono">
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
