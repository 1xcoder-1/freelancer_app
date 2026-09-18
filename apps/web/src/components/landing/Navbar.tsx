"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  LayoutDashboard,
  Menu,
  X,
  ChevronDown,
  Layers,
  Users,
  Clock,
  FileText,
  Command,
  Smartphone,
} from "lucide-react";

import { CommandMenu } from "@/components/ui/CommandMenu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [featuresDropdownOpen, setFeaturesDropdownOpen] = useState(false);
  const pathname = usePathname();

  const featureCategories = [
    {
      title: "Client CRM & Leads",
      href: "/features#crm",
      desc: "Lead pipeline, health scores, and client portals",
      icon: Users,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      title: "Multi-View Projects",
      href: "/features#projects",
      desc: "Kanban, Gantt, List, Calendar, and Milestones",
      icon: Layers,
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    },
    {
      title: "Time & Focus Tracker",
      href: "/features#time",
      desc: "Billable hours, effective rates, and Pomodoro",
      icon: Clock,
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    },
    {
      title: "Invoices & Profitability",
      href: "/features#finance",
      desc: "PDF generation, expenses, and net profit",
      icon: FileText,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
    {
      title: "Quick Capture (Desktop)",
      href: "/features#desktop",
      desc: "Ctrl+Shift+F global shortcut on Windows",
      icon: Command,
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    },
    {
      title: "Android Mobile Sync",
      href: "/features#mobile",
      desc: "React Native Expo app with push alerts",
      icon: Smartphone,
      color: "text-pink-400 bg-pink-500/10 border-pink-500/20",
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-500 flex items-center justify-center font-bold text-slate-950 shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            FB
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base sm:text-lg text-white tracking-tight leading-none">
              Freelance <span className="text-emerald-400">Book</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Operating System</span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1.5 text-sm font-medium text-slate-300">
          {/* Categorized Features Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setFeaturesDropdownOpen(true)}
            onMouseLeave={() => setFeaturesDropdownOpen(false)}
          >
            <Link
              href="/features"
              className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-sm transition-colors hover:text-white hover:bg-slate-900/80 ${
                pathname === "/features" ? "text-emerald-400 bg-slate-900/90 font-semibold" : "text-slate-300"
              }`}
            >
              <span>Features</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </Link>

            <AnimatePresence>
              {featuresDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1 w-[480px] p-3 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-2xl grid grid-cols-2 gap-2 z-50"
                >
                  {featureCategories.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={idx}
                        href={item.href}
                        className="p-2.5 rounded-xl hover:bg-slate-800/80 transition-all flex items-start gap-3 group"
                        onClick={() => setFeaturesDropdownOpen(false)}
                      >
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 mt-0.5 ${item.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-400 leading-tight line-clamp-1 mt-0.5 font-normal">
                            {item.desc}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  <div className="col-span-2 pt-2 border-t border-slate-800/80 flex items-center justify-between px-2 text-xs">
                    <span className="text-slate-400">Want to explore all modules?</span>
                    <Link
                      href="/features"
                      className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1"
                      onClick={() => setFeaturesDropdownOpen(false)}
                    >
                      View All Features &rarr;
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link
            href="/architecture"
            className={`px-3.5 py-2 rounded-xl transition-colors hover:text-white hover:bg-slate-900/80 ${
              pathname === "/architecture" ? "text-emerald-400 bg-slate-900/90 font-semibold" : "text-slate-300"
            }`}
          >
            Architecture
          </Link>

          <Link
            href="/ai"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors hover:text-white hover:bg-slate-900/80 ${
              pathname === "/ai" ? "text-indigo-400 bg-indigo-500/10 font-semibold" : "text-indigo-300"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Book AI</span>
          </Link>

          <Link
            href="/pricing"
            className={`px-3.5 py-2 rounded-xl transition-colors hover:text-white hover:bg-slate-900/80 ${
              pathname === "/pricing" ? "text-emerald-400 bg-slate-900/90 font-semibold" : "text-slate-300"
            }`}
          >
            Pricing
          </Link>

          <Link
            href="/about"
            className={`px-3.5 py-2 rounded-xl transition-colors hover:text-white hover:bg-slate-900/80 ${
              pathname === "/about" ? "text-emerald-400 bg-slate-900/90 font-semibold" : "text-slate-300"
            }`}
          >
            About
          </Link>
        </nav>

        {/* Auth CTA Actions with shadcn Button */}
        <div className="flex items-center gap-2.5">
          <CommandMenu />

          <SignedOut>
            <Link href="/sign-in" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button variant="default" size="sm" className="rounded-xl px-4 py-2 font-bold shadow-md shadow-emerald-500/20">
                Get Started Free
              </Button>
            </Link>
          </SignedOut>

          <SignedIn>
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="rounded-xl gap-2 text-white">
                <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </Link>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8 sm:w-9 sm:h-9 border border-slate-700 hover:border-emerald-400 transition-all",
                },
              }}
            />
          </SignedIn>

          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-all"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-b border-slate-800 bg-slate-950/95 backdrop-blur-2xl px-4 py-6 space-y-4"
          >
            <div className="space-y-1">
              <Link
                href="/features"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-xl text-sm font-medium ${
                  pathname === "/features" ? "text-emerald-400 bg-slate-900 font-semibold" : "text-slate-300"
                }`}
              >
                Features (CRM, Projects, Invoices, Mobile)
              </Link>
              <Link
                href="/architecture"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-xl text-sm font-medium ${
                  pathname === "/architecture" ? "text-emerald-400 bg-slate-900 font-semibold" : "text-slate-300"
                }`}
              >
                Architecture (FastAPI + Cloudflare D1)
              </Link>
              <Link
                href="/ai"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-xl text-sm font-medium ${
                  pathname === "/ai" ? "text-indigo-400 bg-indigo-500/10 font-semibold" : "text-indigo-300"
                }`}
              >
                Book AI Assistant
              </Link>
              <Link
                href="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-xl text-sm font-medium ${
                  pathname === "/pricing" ? "text-emerald-400 bg-slate-900 font-semibold" : "text-slate-300"
                }`}
              >
                Pricing & Free Plan
              </Link>
              <Link
                href="/about"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-xl text-sm font-medium ${
                  pathname === "/about" ? "text-emerald-400 bg-slate-900 font-semibold" : "text-slate-300"
                }`}
              >
                About Our Mission
              </Link>
            </div>

            <SignedOut>
              <div className="pt-4 border-t border-slate-900 grid grid-cols-2 gap-3">
                <Link
                  href="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full"
                >
                  <Button variant="outline" size="sm" className="w-full">
                    Sign In
                  </Button>
                </Link>
                <Link
                  href="/sign-up"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full"
                >
                  <Button variant="default" size="sm" className="w-full">
                    Get Started
                  </Button>
                </Link>
              </div>
            </SignedOut>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
