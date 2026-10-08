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
  Check,
} from "@/components/animated-icons";
import { Reveal, hoverLift } from "@/components/landing/motion";
import {
  Container,
  LandingShell,
  PageHero,
  Section,
} from "@/components/landing/layout";

const categories = [
  { id: "all", label: "All modules" },
  { id: "crm", label: "CRM & Pipeline" },
  { id: "projects", label: "Project views" },
  { id: "time", label: "Time & Focus" },
  { id: "finance", label: "Invoices & Profit" },
  { id: "desktop", label: "Desktop & Mobile" },
  { id: "ai", label: "Book AI" },
];

const features = [
  {
    id: "crm",
    category: "crm",
    icon: Users,
    group: "CRM & Pipeline",
    title: "Client pipeline & relationship hub",
    description:
      "Track leads from first touch to closed contract. Contacts, proposals, custom fields, internal notes and automated client health scores in one view.",
    highlights: [
      "Client health scores based on payment velocity & communication",
      "Multiple contact persons per company with roles and direct channels",
      "White-label client portal for invoice approval and deliverable downloads",
      "Custom status stages: Lead → Discovery → Active → Retainer → Archived",
    ],
    metric: "98% retention",
  },
  {
    id: "projects",
    category: "projects",
    icon: Kanban,
    group: "Project engine",
    title: "Five views in one project engine",
    description:
      "Switch between Kanban, List, Calendar, Timeline Gantt and Table views with zero latency — the same data, whichever way your brain works today.",
    highlights: [
      "Drag-and-drop Kanban columns with WIP limits",
      "Milestone tracking linked directly to invoice trigger events",
      "Priorities (Urgent → Low) with nested subtasks",
      "Markdown briefs and document attachments via Cloudinary",
    ],
    metric: "5 views, 1 click",
  },
  {
    id: "time",
    category: "time",
    icon: Clock,
    group: "Time & focus",
    title: "One-click time & Pomodoro tracking",
    description:
      "Track billable vs non-billable hours on Web, the Windows tray, or Android — and know your real effective hourly rate down to the penny.",
    highlights: [
      "One-click start/stop with automatic project assignment",
      "Pomodoro focus modes with configurable breaks",
      "Manual edits and bulk categorization",
      "Tracked time converts straight into invoice line items",
    ],
    metric: "+3.5 billable hrs/wk",
  },
  {
    id: "finance",
    category: "finance",
    icon: FileText,
    group: "Finance & profit",
    title: "Invoices & project net profitability",
    description:
      "Professional PDF invoices, expense logging with receipt uploads, and live net margin per client and project.",
    highlights: [
      "PDF invoices with custom branding and tax rates",
      "Receipt capture via Cloudinary object storage",
      "Live expense-vs-revenue margin per project",
      "Status lifecycle: Draft → Sent → Paid → Overdue with reminders",
    ],
    metric: "< 30s per invoice",
  },
  {
    id: "desktop",
    category: "desktop",
    icon: Command,
    group: "Desktop",
    title: "Windows Quick Capture & system tray",
    description:
      "Press Ctrl+Shift+F anywhere to capture a task, note or timer — without leaving your editor or design tool.",
    highlights: [
      "Global shortcut from any active application",
      "Minimal capture modal, keyboard-first",
      "Tray widget with live running timer",
      "Offline queue with automatic background sync",
    ],
    metric: "0 context switches",
  },
  {
    id: "mobile",
    category: "desktop",
    icon: Smartphone,
    group: "Mobile",
    title: "Android companion app",
    description:
      "React Native + Expo app with push notifications, offline time tracking, quick client lookup and photo receipt capture.",
    highlights: [
      "Push alerts for invoice views and timer events",
      "Camera receipt capture uploaded to the vault",
      "Home-screen widget for one-tap timer toggle",
      "Biometric login",
    ],
    metric: "Sub-second sync",
  },
  {
    id: "ai",
    category: "ai",
    icon: Sparkles,
    group: "Book AI",
    title: "Book AI freelance assistant",
    description:
      "A copilot that knows your clients, time and money — drafts scopes and proposals, summarizes calls, and audits profitability.",
    highlights: [
      "One-click project plans with milestone cost breakdown",
      "Client sentiment analysis and reminder drafting",
      "Rate recommendations from your real project data",
      "Natural-language queries across your workspace",
    ],
    metric: "10x faster proposals",
  },
  {
    id: "storage",
    category: "finance",
    icon: FolderLock,
    group: "Asset vault",
    title: "Deliverable & document vault",
    description:
      "Storage for contract PDFs, briefs and deliverables with signed uploads and access logs.",
    highlights: [
      "Zero egress fees on client downloads",
      "Encrypted storage for tax and contract documents",
      "Signed URL uploads, no backend bottlenecks",
      "Organized by project and client with access logs",
    ],
    metric: "$0 egress",
  },
];

export default function FeaturesPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredFeatures =
    activeCategory === "all"
      ? features
      : features.filter((f) => f.category === activeCategory);

  return (
    <LandingShell>
      <Navbar />

      <main className="flex-1">
        <PageHero
          eyebrow="Feature matrix"
          title="Every tool to run your business,"
          accent="mapped and unified."
          desc="Eight native modules for independent freelancers, contractors and agency-of-one operators — no plugin sprawl, no per-seat surprises."
        >
          {/* Category filter chips — quiet text pills, one active state */}
          <div className="flex items-center justify-center flex-wrap gap-2 max-w-3xl mx-auto">
            {categories.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  aria-pressed={active}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                    active
                      ? "border-accent/30 bg-accent-soft dark:bg-accent/15 text-accent"
                      : "border-line bg-card text-muted hover:text-fg hover:border-line-strong"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </PageHero>

        <Section className="border-t-0">
          <Container>
            <div className="grid md:grid-cols-2 gap-5">
              <AnimatePresence mode="popLayout">
                {filteredFeatures.map((feat) => {
                  const Icon = feat.icon;
                  return (
                    <motion.div
                      key={feat.id}
                      id={feat.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                      <div className={`h-full rounded-xl border border-line bg-card p-6 sm:p-7 flex flex-col ${hoverLift}`}>
                        {/* Meta row */}
                        <div className="flex items-center justify-between gap-4 mb-5">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-accent-soft dark:bg-accent/15 text-accent flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4" />
                            </span>
                            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint truncate">
                              {feat.group}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-muted tabular-nums shrink-0">
                            {feat.metric}
                          </span>
                        </div>

                        <h2 className="font-display text-[17px] font-semibold text-fg mb-2">
                          {feat.title}
                        </h2>
                        <p className="text-[13px] leading-6 text-muted mb-5">
                          {feat.description}
                        </p>

                        <ul className="space-y-2 mt-auto pt-4 border-t border-line">
                          {feat.highlights.map((point) => (
                            <li key={point} className="flex items-start gap-2.5 text-[13px] leading-5 text-fg/90">
                              <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>

                        <Link
                          href="/sign-up"
                          className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent transition-colors duration-150 hover:text-accent-hi"
                        >
                          Try it free
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Single closing CTA instead of eight repeated links */}
            <Reveal>
              <div className="mt-14 pt-10 border-t border-line text-center">
                <p className="text-[14px] text-muted">
                  All eight modules ship with the free core plan.
                </p>
                <Link href="/sign-up" className="inline-block mt-4">
                  <button className="cursor-pointer rounded-lg bg-accent px-6 py-2.5 text-[13px] font-semibold text-accent-fg transition-colors duration-150 hover:bg-accent-hi">
                    Open your workspace
                  </button>
                </Link>
              </div>
            </Reveal>
          </Container>
        </Section>
      </main>

      <Footer />
    </LandingShell>
  );
}
