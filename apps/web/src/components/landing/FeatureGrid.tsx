"use client";

import { motion } from "framer-motion";
import { Users, Kanban, Clock, FileText, Command, Sparkles, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BentoGrid, BentoGridItem } from "@/components/ui/aceternity/bento-grid";
import Link from "next/link";

export function FeatureGrid() {
  const features = [
    {
      icon: <Users className="w-5 h-5 text-emerald-400" />,
      title: "Client CRM & Pipeline",
      description: "Manage client leads, contacts, proposal workflows, internal notes, and client health scores with automated interaction history.",
      tag: "CRM",
      badgeVariant: "emerald" as const,
      header: (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950 border border-emerald-500/20 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Pipeline</span>
            <span className="text-emerald-400 font-mono font-bold">$34,200</span>
          </div>
          <div className="space-y-1.5">
            <div className="h-1.5 w-3/4 rounded-full bg-emerald-500/40" />
            <div className="h-1.5 w-1/2 rounded-full bg-slate-700" />
          </div>
        </div>
      ),
      className: "md:col-span-2",
    },
    {
      icon: <Kanban className="w-5 h-5 text-indigo-400" />,
      title: "Multi-View Projects & Kanban",
      description: "Switch seamlessly between Kanban board, List view, Calendar, and Timeline Gantt views with milestone tracking.",
      tag: "Management",
      badgeVariant: "indigo" as const,
      header: (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-indigo-500/10 via-slate-900 to-slate-950 border border-indigo-500/20 p-3 flex items-center justify-center">
          <div className="grid grid-cols-3 gap-2 w-full">
            <div className="h-10 rounded-lg bg-slate-800/80 border border-slate-700/60" />
            <div className="h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/40" />
            <div className="h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40" />
          </div>
        </div>
      ),
      className: "md:col-span-1",
    },
    {
      icon: <Clock className="w-5 h-5 text-cyan-400" />,
      title: "One-Click Time Tracking",
      description: "Track billable vs non-billable hours instantly on Web, Windows Tray, or Mobile. Calculate your effective hourly rate.",
      tag: "Analytics",
      badgeVariant: "cyan" as const,
      header: (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-cyan-500/10 via-slate-900 to-slate-950 border border-cyan-500/20 p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400">Live Active Session</div>
            <div className="text-lg font-mono font-bold text-cyan-400">03:12:45</div>
          </div>
          <span className="h-3 w-3 rounded-full bg-cyan-400 animate-ping" />
        </div>
      ),
      className: "md:col-span-1",
    },
    {
      icon: <FileText className="w-5 h-5 text-amber-400" />,
      title: "Invoices & Profitability",
      description: "Generate PDF invoices, log expenses, and track net profitability per client automatically with tax and discount calculators.",
      tag: "Finance",
      badgeVariant: "amber" as const,
      header: (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 border border-amber-500/20 p-3 flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-mono">INV-2026-08</span>
            <span className="text-emerald-400 font-mono font-semibold">PAID</span>
          </div>
          <div className="text-base font-mono font-bold text-white">$5,800.00</div>
        </div>
      ),
      className: "md:col-span-1",
    },
    {
      icon: <Sparkles className="w-5 h-5 text-indigo-400" />,
      title: "Book AI Assistant",
      description: "Integrated Gemini & OpenAI assistant to auto-create project plans, summarize client history, and draft invoice terms.",
      tag: "AI Assistant",
      badgeVariant: "indigo" as const,
      header: (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-purple-500/10 via-indigo-950/40 to-slate-950 border border-indigo-500/30 p-3 flex flex-col justify-center gap-1.5">
          <div className="text-xs text-indigo-300 font-medium">✨ &quot;Summarize Q3 Acme deliverables&quot;</div>
          <div className="text-[10px] text-slate-400 bg-slate-900/90 rounded p-1.5 border border-slate-800">
            Generated 3 milestones with 12 subtasks...
          </div>
        </div>
      ),
      className: "md:col-span-2",
    },
    {
      icon: <Command className="w-5 h-5 text-purple-400" />,
      title: "Windows Quick Capture",
      description: "Press Ctrl+Shift+F anywhere on Windows to launch a quick entry modal for tasks, notes, time, or expenses.",
      tag: "Desktop",
      badgeVariant: "default" as const,
      header: (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-purple-500/10 via-slate-900 to-slate-950 border border-purple-500/20 p-3 flex items-center justify-center">
          <kbd className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-purple-300 shadow-md">
            Ctrl + Shift + F
          </kbd>
        </div>
      ),
      className: "md:col-span-1",
    },
  ];

  return (
    <section id="features" className="py-24 border-t border-slate-900 bg-slate-950/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <div className="inline-flex mb-3">
            <Badge variant="emerald" className="px-3.5 py-1 text-xs uppercase tracking-wider font-bold">
              Built for Independence
            </Badge>
          </div>
          <h3 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Everything you need to run your freelance business
          </h3>
          <p className="text-slate-400 text-base sm:text-lg mt-4 font-normal">
            No more jumping between 6 different disconnected apps. Freelance Book brings your full client lifecycle into one modern Bento architecture.
          </p>
        </motion.div>

        {/* Aceternity BentoGrid layout */}
        <BentoGrid className="max-w-7xl mx-auto">
          {features.map((item, i) => (
            <BentoGridItem
              key={i}
              title={
                <div className="flex items-center justify-between mt-2">
                  <span className="text-base font-bold text-white">{item.title}</span>
                  <Badge variant={item.badgeVariant} className="text-[10px] px-2 py-0.5">
                    {item.tag}
                  </Badge>
                </div>
              }
              description={item.description}
              header={item.header}
              icon={item.icon}
              className={item.className}
            />
          ))}
        </BentoGrid>

        <div className="mt-12 text-center">
          <Link
            href="/features"
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span>Explore all 8 dedicated modules and feature specs</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
