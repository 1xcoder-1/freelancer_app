"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Play, ArrowRight, Clock, CheckCircle2, ShieldCheck, Zap, Laptop, Layers } from "lucide-react";
import { Spotlight } from "@/components/ui/aceternity/spotlight";
import { SparklesCore } from "@/components/ui/aceternity/sparkles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "kanban" | "invoices">("dashboard");

  return (
    <section className="relative pt-16 pb-24 overflow-hidden">
      {/* Aceternity Spotlight Lighting */}
      <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="rgba(16, 185, 129, 0.25)" />
      <Spotlight className="top-10 right-0 md:right-40" fill="rgba(99, 102, 241, 0.2)" />

      {/* Sparkles Particle Layer */}
      <div className="absolute inset-0 w-full h-[550px] -z-10 pointer-events-none">
        <SparklesCore
          id="heroSparkles"
          background="transparent"
          minSize={0.6}
          maxSize={1.8}
          particleDensity={40}
          particleColor="#10b981"
          speed={0.8}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        {/* Top Announcement Pill (shadcn Badge + micro-glow) */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="inline-flex items-center gap-2 mb-8"
        >
          <Badge variant="emerald" className="px-4 py-1.5 text-xs font-semibold rounded-full shadow-lg shadow-emerald-500/10 flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Freelance Book 1.0 OS</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-300 font-bold flex items-center gap-1">
              Next.js + FastAPI + D1 <ArrowRight className="w-3 h-3 inline" />
            </span>
          </Badge>
        </motion.div>

        {/* Hero Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.08] max-w-5xl mx-auto mb-6"
        >
          The Complete Operating System for{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">
            Independent Freelancers
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-normal"
        >
          Unify project management, client CRM, precision time tracking, automated invoices, smart contracts, and AI workflow assistance into one unified desktop & cloud experience.
        </motion.p>

        {/* Action Buttons using shadcn/ui */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link href="/sign-up">
            <Button size="lg" className="w-full sm:w-auto px-8 py-6 text-base font-bold rounded-2xl shadow-xl shadow-emerald-500/25 group">
              <span>Start Free Operating System</span>
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>

          <a href="#features">
            <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 py-6 text-base rounded-2xl border-slate-700 bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md">
              <Play className="w-4 h-4 mr-2 text-emerald-400 fill-emerald-400" />
              <span>Explore OS Modules</span>
            </Button>
          </a>
        </motion.div>

        {/* Live Interactive OS Preview Shell with Aceternity backdrop styling */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="relative max-w-5xl mx-auto rounded-3xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-2xl shadow-2xl p-4 sm:p-6 text-left"
        >
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="text-xs font-mono text-slate-400 ml-2">freelance-book-os.app</span>
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
              {(["dashboard", "kanban", "invoices"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg transition-all capitalize relative ${
                    activeTab === tab ? "text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {activeTab === tab && (
                    <motion.div
                      layoutId="activeTabGlow"
                      className="absolute inset-0 bg-slate-800 rounded-lg -z-10 shadow-sm"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  {tab === "kanban" ? "Projects & Kanban" : tab === "invoices" ? "Invoices & Profit" : "Dashboard"}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-emerald-500/40 transition-colors">
                    <div className="text-xs text-slate-400 font-medium mb-1">Monthly Revenue</div>
                    <div className="text-2xl font-mono font-bold text-emerald-400">$12,480.00</div>
                    <div className="text-[11px] text-emerald-400 font-medium mt-1">↑ +18.4% vs last month</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-indigo-500/40 transition-colors">
                    <div className="text-xs text-slate-400 font-medium mb-1">Active Projects</div>
                    <div className="text-2xl font-mono font-bold text-white">6 Client Specs</div>
                    <div className="text-[11px] text-indigo-400 font-medium mt-1">2 Milestones due today</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-cyan-500/40 transition-colors">
                    <div className="text-xs text-slate-400 font-medium mb-1">Billable Hours</div>
                    <div className="text-2xl font-mono font-bold text-cyan-400">142.5 hrs</div>
                    <div className="text-[11px] text-slate-400 font-medium mt-1">Eff. Rate: $87.50/hr</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-amber-500/40 transition-colors">
                    <div className="text-xs text-slate-400 font-medium mb-1">Pending Invoices</div>
                    <div className="text-2xl font-mono font-bold text-amber-400">$3,850.00</div>
                    <div className="text-[11px] text-amber-400 font-medium mt-1">1 invoice awaiting approval</div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">Today's Focus Task</div>
                      <div className="text-xs text-slate-400">Fintech Dashboard Refactor • Acme Corp Client</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    <span className="font-mono text-lg font-bold text-emerald-400">02:45:12</span>
                    <Button variant="default" size="sm" className="rounded-xl px-4 py-2 font-bold text-xs">
                      Stop Timer
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "kanban" && (
              <motion.div
                key="kanban"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>To Do (3)</span>
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 mb-2">
                    <div className="text-sm font-medium text-white mb-1">Contract Scope Draft</div>
                    <div className="text-xs text-slate-400">SaaS Client • $2,500 budget</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>In Progress (2)</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30 mb-2">
                    <div className="text-sm font-medium text-white mb-1">FastAPI Auth Middleware</div>
                    <div className="text-xs text-emerald-400 font-mono">Timer Running (01:24:00)</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Completed (4)</span>
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 mb-2">
                    <div className="text-sm font-medium text-slate-300 line-through mb-1">Cloudflare D1 Setup</div>
                    <div className="text-xs text-slate-500">Delivered • Approved</div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "invoices" && (
              <motion.div
                key="invoices"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">INV-2026-004 • Acme Corp</div>
                    <div className="text-xs text-slate-400">Web App Development & Design System</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-mono font-bold text-emerald-400">$4,500.00</div>
                    <Badge variant="emerald" className="mt-1">
                      Paid via Stripe
                    </Badge>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
