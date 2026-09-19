"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  Users,
  Kanban,
  Clock,
  FileText,
  Command,
  Smartphone,
  Sparkles,
  FolderLock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Spotlight } from "@/components/ui/aceternity/spotlight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function FeaturesPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const categories = [
    { id: "all", label: "All Modules" },
    { id: "crm", label: "CRM & Pipeline" },
    { id: "projects", label: "Project Multi-View" },
    { id: "time", label: "Time & Focus" },
    { id: "finance", label: "Invoices & Profit" },
    { id: "desktop", label: "Desktop & Mobile" },
    { id: "ai", label: "Book AI Assistant" },
  ];

  const features = [
    {
      id: "crm",
      category: "crm",
      icon: Users,
      badge: "Client CRM",
      badgeVariant: "emerald" as const,
      title: "Client Pipeline & Relationship Hub",
      headline: "Track client leads from first touch to closed contract.",
      description: "Manage client leads, contacts, proposals, custom fields, internal interaction notes, and automated client health scores in a unified view.",
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      highlights: [
        "Client health scores based on payment velocity & communication",
        "Multiple contact persons per company with roles and direct channels",
        "White-label client portal for invoice approval and deliverable downloads",
        "Custom status stages: Lead -> Discovery -> Active -> Retainer -> Archived",
      ],
      metrics: "98% client retention rate",
    },
    {
      id: "projects",
      category: "projects",
      icon: Kanban,
      badge: "Project Management",
      badgeVariant: "indigo" as const,
      title: "5-in-1 Multi-View Project Engine",
      headline: "View your workload the way your brain works.",
      description: "Switch seamlessly between Kanban board, List view, Calendar, Timeline Gantt, and Spreadsheet Table views with zero latency.",
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      highlights: [
        "Interactive drag-and-drop Kanban columns with WIP limits",
        "Milestone tracking linked directly to invoice trigger events",
        "Task prioritization: Urgent, High, Medium, Low with subtasks",
        "Markdown project briefs and document attachments via Cloudflare R2",
      ],
      metrics: "5 views in 1 click",
    },
    {
      id: "time",
      category: "time",
      icon: Clock,
      badge: "Time & Focus",
      badgeVariant: "cyan" as const,
      title: "One-Click Time & Pomodoro Tracking",
      headline: "Know your real effective hourly rate down to the penny.",
      description: "Track billable vs non-billable hours instantly on Web, Windows system tray, or Android mobile. Automatic calculation of true earnings per hour.",
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
      highlights: [
        "One-click start/stop timer with automatic project assignment",
        "Pomodoro focus modes with configurable sound & break alerts",
        "Manual time entry editing and bulk categorization",
        "Direct conversion from tracked time entries into client invoice items",
      ],
      metrics: "+3.5 billable hrs/week",
    },
    {
      id: "finance",
      category: "finance",
      icon: FileText,
      badge: "Finance & Profit",
      badgeVariant: "amber" as const,
      title: "Invoices & Project Net Profitability",
      headline: "Automated billing and real-time margin visibility.",
      description: "Generate professional PDF invoices, log business expenses with receipt uploads, and track net profitability per client and project.",
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      highlights: [
        "Automated PDF invoice generation with custom branding and tax rates",
        "Receipt capture via Cloudflare R2 object storage",
        "Live expense vs revenue net margin calculation per project",
        "Payment status lifecycle: Draft -> Sent -> Paid -> Overdue with reminders",
      ],
      metrics: "< 30s invoice creation",
    },
    {
      id: "desktop",
      category: "desktop",
      icon: Command,
      badge: "Desktop Quick Capture",
      badgeVariant: "default" as const,
      title: "Windows Quick Capture & System Tray",
      headline: "Press Ctrl+Shift+F anywhere to capture ideas and time.",
      description: "Never lose focus when working inside your code editor or design tool. Launch an instant capture modal on Windows for tasks, notes, or timers.",
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
      highlights: [
        "Global keyboard shortcut Ctrl+Shift+F from any active application",
        "Minimal floating modal with instant keyboard submission",
        "System tray timer widget showing live running elapsed time",
        "Offline-capable local queue with automatic background sync",
      ],
      metrics: "0 context switching",
    },
    {
      id: "mobile",
      category: "desktop",
      icon: Smartphone,
      badge: "Mobile Companion",
      badgeVariant: "indigo" as const,
      title: "Android Mobile Companion App",
      headline: "Your freelance business in your pocket.",
      description: "React Native + Expo mobile application with real-time push notifications, offline time tracking, quick client lookup, and photo receipt capture.",
      color: "text-pink-400 bg-pink-500/10 border-pink-500/20",
      highlights: [
        "Push notifications for client messages, invoice views, and timer alerts",
        "Camera receipt scanning uploaded straight to Cloudflare R2",
        "Native Android widgets for one-tap timer toggle",
        "Secure biometric login with fingerprint and facial recognition",
      ],
      metrics: "Sub-second sync",
    },
    {
      id: "ai",
      category: "ai",
      icon: Sparkles,
      badge: "AI Intelligence",
      badgeVariant: "indigo" as const,
      title: "Book AI Freelance Assistant",
      headline: "Your 24/7 strategic copilot powered by Gemini & OpenAI.",
      description: "Auto-generate project scopes, draft clear contract clauses, summarize client meeting notes, and analyze your proposal win rates.",
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      highlights: [
        "1-click project plan generator with milestone cost breakdown",
        "Client sentiment analysis and overdue invoice reminder drafting",
        "Effective hourly rate recommendations based on project scope",
        "Natural language query interface across all your business data",
      ],
      metrics: "10x faster proposals",
    },
    {
      id: "storage",
      category: "finance",
      icon: FolderLock,
      badge: "Edge Storage",
      badgeVariant: "cyan" as const,
      title: "Cloudflare R2 Asset & Deliverable Vault",
      headline: "Zero egress fees for all client deliverables and files.",
      description: "Fast, reliable S3-compatible cloud storage on Cloudflare edge network for contract PDFs, client design briefs, and project deliverables.",
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      highlights: [
        "Zero egress fees on deliverable downloads by clients",
        "Encrypted storage for sensitive tax and contract documents",
        "Direct signed URL uploads without backend bottlenecks",
        "Organized project and client folders with access logs",
      ],
      metrics: "$0 egress bandwidth cost",
    },
  ];

  const filteredFeatures =
    activeCategory === "all"
      ? features
      : features.filter((f) => f.category === activeCategory);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      <Navbar />

      <main className="flex-1">
        {/* Page Hero with Aceternity Spotlight */}
        <section className="relative pt-20 pb-16 overflow-hidden border-b border-slate-900 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950">
          <Spotlight className="-top-30 left-10 md:left-1/3" fill="rgba(16, 185, 129, 0.2)" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex mb-6"
            >
              <Badge variant="emerald" className="px-4 py-1.5 text-xs font-semibold gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Complete Feature Matrix
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto mb-6"
            >
              Every tool to operate your business,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">
                categorized & unified.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-normal"
            >
              Discover all 8 native modules designed specifically for independent freelancers, contractors, and agency founders.
            </motion.p>

            {/* Interactive Category Filter Pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex items-center justify-center flex-wrap gap-2 max-w-4xl mx-auto"
            >
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={activeCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    activeCategory === cat.id
                      ? "bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/25"
                      : "bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  {cat.label}
                </Button>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Feature Grid Deep Dive with shadcn Card */}
        <section className="py-20 bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <AnimatePresence mode="popLayout">
                {filteredFeatures.map((feat) => {
                  const Icon = feat.icon;
                  return (
                    <motion.div
                      key={feat.id}
                      id={feat.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="h-full p-8 bg-slate-900/60 border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-xl">
                        <div>
                          {/* Top Meta */}
                          <div className="flex items-center justify-between mb-6">
                            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${feat.color}`}>
                              <Icon className="w-6 h-6" />
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={feat.badgeVariant} className="text-xs">
                                {feat.badge}
                              </Badge>
                              <Badge variant="emerald" className="text-xs font-mono font-bold">
                                {feat.metrics}
                              </Badge>
                            </div>
                          </div>

                          {/* Title & Description */}
                          <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                            {feat.title}
                          </h3>
                          <p className="text-sm font-semibold text-slate-200 mb-4">
                            {feat.headline}
                          </p>
                          <p className="text-sm text-slate-400 leading-relaxed mb-6 font-normal">
                            {feat.description}
                          </p>

                          {/* Feature Highlights Checklist */}
                          <div className="space-y-2.5 pt-4 border-t border-slate-800/80">
                            {feat.highlights.map((point, pIdx) => (
                              <div key={pIdx} className="flex items-start gap-2.5 text-xs text-slate-300">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                <span className="leading-snug">{point}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Bottom Link with shadcn Button */}
                        <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center justify-between">
                          <Link href="/sign-up">
                            <Button variant="ghost" size="sm" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 p-0 h-auto gap-1.5">
                              <span>Try {feat.badge} Free</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
