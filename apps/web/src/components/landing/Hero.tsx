"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, CheckCircle2, Flame, Receipt, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative pt-20 pb-24 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-14 items-center relative z-10">
        {/* Left: copy */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex items-center gap-2 mb-7 rounded-full border border-line bg-card px-3.5 py-1.5 text-xs text-muted"
          >
            <span className="w-5 h-5 rounded-md bg-accent flex items-center justify-center">
              <BookOpen className="w-3 h-3 text-accent-fg" />
            </span>
            <span className="font-mono">Your whole freelance biz</span>
            <span className="font-semibold text-fg">one book</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease: "easeOut" }}
            className="font-display text-[2.6rem] sm:text-6xl font-bold text-fg leading-[1.05] tracking-tight mb-6"
          >
            Freelancing feels lighter when it{" "}
            <span className="italic font-medium text-accent">lives here.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="text-[15px] sm:text-base text-muted max-w-md leading-relaxed mb-9"
          >
            Freelance Book is the operating system where clients, projects, time,
            invoices and proposals finally meet. Less tab-shuffling — more shipping
            and getting paid.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <Link href="/sign-up" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto rounded-lg font-bold px-7">
                Start Free
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-lg font-semibold px-7">
                View Live Demo
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 font-mono text-[11px] tracking-wider text-faint uppercase"
          >
            No credit card&nbsp;&nbsp;·&nbsp;&nbsp;Free core plan&nbsp;&nbsp;·&nbsp;&nbsp;Set up in 90 seconds
          </motion.div>
        </div>

        {/* Right: mock app window + floating chips (reference style) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="relative"
        >
          <div className="rounded-xl border border-line bg-card shadow-2xl overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-surface/60">
              <span className="w-2.5 h-2.5 rounded-full bg-danger/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-warn/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-ok/70" />
              <span className="ml-3 font-mono text-[10px] text-faint tracking-wider">freelancebook.app/dashboard</span>
            </div>

            <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[150px_1fr]">
              {/* Mini sidebar */}
              <div className="border-r border-dashed border-line p-3 space-y-1.5 hidden sm:block">
                <div className="flex items-center gap-2 rounded-full bg-accent px-2.5 py-1.5 text-[10px] font-semibold text-accent-fg">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-fg/80" /> Dashboard
                </div>
                {["Clients", "Projects", "Time", "Invoices", "Proposals"].map((i) => (
                  <div key={i} className="flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[10px] text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-line-strong" /> {i}
                  </div>
                ))}
              </div>

              {/* Mini content */}
              <div className="p-4 space-y-3">
                <div>
                  <div className="font-display text-base font-bold text-fg">Dashboard</div>
                  <div className="text-[10px] text-muted">Overview of your week</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { l: "Paid", v: "$4,820" },
                    { l: "Pending", v: "$1,150" },
                    { l: "Hours", v: "36h" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-lg border border-line bg-bg p-2.5">
                      <div className="text-[9px] text-muted">{s.l}</div>
                      <div className="font-mono text-[13px] font-bold text-fg">{s.v}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-line bg-bg divide-y divide-line">
                  {[
                    { i: Receipt, t: "INV-024 · Acme Corp", a: "$1,200", ok: true },
                    { i: Clock, t: "Deep work · Platform API", a: "2h 40m", ok: false },
                  ].map((r) => {
                    const I = r.i;
                    return (
                      <div key={r.t} className="flex items-center gap-2.5 p-2.5">
                        <span className="w-6 h-6 rounded-full bg-accent-soft dark:bg-accent/15 text-accent flex items-center justify-center">
                          <I className="w-3 h-3" />
                        </span>
                        <span className="text-[11px] text-fg flex-1 truncate">{r.t}</span>
                        <span className="font-mono text-[10px] text-muted">{r.a}</span>
                        {r.ok && <CheckCircle2 className="w-3.5 h-3.5 text-ok" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Floating chips */}
          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-5 -right-3 sm:-right-6 rounded-xl border border-line bg-card px-3.5 py-2.5 shadow-xl flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-ok" />
            <span className="text-[11px] font-semibold text-fg">Invoice paid</span>
            <span className="font-mono text-[11px] text-ok">+$1,200</span>
          </motion.div>

          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
            className="absolute -bottom-5 -left-3 sm:-left-6 rounded-xl border border-line bg-card px-3.5 py-2.5 shadow-xl flex items-center gap-2"
          >
            <Flame className="w-4 h-4 text-accent" />
            <span className="text-[11px] font-semibold text-fg">Billing streak</span>
            <span className="font-mono text-[11px] text-accent">12 days</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
