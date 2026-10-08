"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Clock, Receipt } from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { SplitHeading } from "@/components/landing/motion";
import { Container } from "@/components/landing/layout";

/* ------------------------------------------------------------------
   Hero — composition merged from two references:
   · editorial left-aligned poster headline + hairline feature strip +
     wide product-window screenshot below (clean SaaS layout ref)
   · hand-inked "busy freelancer" sketch as the medium-size focal
     point beside the headline (Mr. Update cover ref)
   Palette and type scale unchanged: warm paper tokens + orange accent.
   Entrance staggers semantic chunks 100ms apart; MotionConfig in
   LandingShell already gates it under prefers-reduced-motion.
------------------------------------------------------------------- */

const strip = [
  { t: "Client CRM", d: "Leads to retainers, one pipeline" },
  { t: "Projects", d: "Five views on one board" },
  { t: "Time", d: "Track it, then invoice it" },
  { t: "Money", d: "Invoices, expenses, runway" },
  { t: "Book AI", d: "Drafts in your voice" },
];

const chunk = (delay: number) => ({
  initial: { opacity: 0, y: 12, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.4, delay, ease: "easeOut" as const },
});

export function Hero() {
  return (
    <section className="relative pt-16 sm:pt-20 pb-24 sm:pb-28 overflow-hidden">
      <Container>
        {/* ============ Row 1 — headline + hand-inked sketch ============ */}
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-14 items-center">
          <div>
            <motion.div {...chunk(0)}>
              <span className="eyebrow !text-[10.5px]">The freelance operating system</span>
            </motion.div>

            <motion.div {...chunk(0.1)}>
              <SplitHeading
                text="Freelancing feels lighter"
                accent="when it lives here."
                className="font-display mt-4 text-[38px] sm:text-[46px] lg:text-[54px] font-semibold text-fg leading-[1.05]"
              />
            </motion.div>

            <motion.p {...chunk(0.2)} className="mt-6 text-[15px] sm:text-base leading-7 text-muted max-w-lg">
              Clients, projects, time, invoices and proposals in one calm book —
              so the busywork stops eating your week. Less tab-shuffling, more
              shipping and getting paid.
            </motion.p>

            <motion.div {...chunk(0.3)} className="mt-8 flex flex-col sm:flex-row items-center gap-3">
              <Link href="/sign-up" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto rounded-lg font-semibold px-7">
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
              {...chunk(0.4)}
              className="mt-9 font-mono text-[11px] tracking-wider text-faint uppercase"
            >
              No credit card&nbsp;&nbsp;·&nbsp;&nbsp;Free core plan&nbsp;&nbsp;·&nbsp;&nbsp;Set up in 90 seconds
            </motion.div>
          </div>

          {/* The overworked freelancer — medium-size paper sketch, pinned
              like a poster; white paper reads in both themes */}
          <motion.div {...chunk(0.25)} className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="rounded-xl border border-line bg-card p-3 shadow-lg shadow-black/[0.06] dark:shadow-black/25 -rotate-1">
              <Image
                src="/hero/busy-freelancer.jpg"
                alt="Hand-drawn illustration of an exhausted freelancer buried under stacks of paperwork with a BUSY sign"
                width={1536}
                height={1024}
                priority
                className="w-full h-auto rounded-lg outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
              />
            </div>
            <div className="mt-3 text-center font-mono text-[11px] text-faint">
              fig. 01 — the six-tab life, before the book
            </div>
          </motion.div>
        </div>

        {/* ============ Row 2 — hairline feature strip ============ */}
        <motion.div
          {...chunk(0.5)}
          className="mt-16 sm:mt-20 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-line border-y border-line"
        >
          {strip.map((s) => (
            <div key={s.t} className="bg-bg px-5 py-5">
              <div className="text-[13px] font-semibold text-fg">{s.t}</div>
              <div className="mt-1 text-[12px] leading-5 text-muted">{s.d}</div>
            </div>
          ))}
        </motion.div>

        {/* ============ Row 3 — wide product window ============ */}
        <motion.div {...chunk(0.6)} className="mt-10">
          <div className="rounded-xl border border-line bg-card shadow-lg shadow-black/[0.07] dark:shadow-black/30 overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-surface/60">
              <span className="w-2.5 h-2.5 rounded-full bg-danger/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-warn/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-ok/70" />
              <span className="ml-3 font-mono text-[10px] text-faint tracking-wider">freelancebook.app/dashboard</span>
              <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 rounded-md bg-ok/10 px-2 py-1 font-mono text-[10px] text-ok">
                <CheckCircle2 className="w-3 h-3" /> Invoice paid · +$1,200
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
              {/* Sidebar */}
              <div className="hidden sm:block border-r border-dashed border-line p-3 space-y-1.5">
                <div className="flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-fg">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-fg/80" /> Dashboard
                </div>
                {["Clients", "Projects", "Time tracker", "Invoices", "Proposals", "Planner", "Report card"].map((i) => (
                  <div key={i} className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-line-strong" /> {i}
                  </div>
                ))}
              </div>

              {/* Content */}
              <div className="p-4 sm:p-5 space-y-4">
                <div>
                  <div className="font-display text-[15px] font-semibold text-fg">Dashboard</div>
                  <div className="text-[12px] text-muted">Overview of your week</div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { l: "Paid this month", v: "$4,820" },
                    { l: "Pending", v: "$1,150" },
                    { l: "Hours tracked", v: "36h" },
                    { l: "Effective rate", v: "$91.66" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-lg border border-line bg-bg p-3">
                      <div className="text-[10px] text-muted">{s.l}</div>
                      <div className="mt-1 font-mono text-[14px] font-semibold text-fg tabular-nums">{s.v}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-line bg-bg divide-y divide-line">
                  {[
                    { i: Receipt, t: "INV-024 · Acme Corp", m: "Paid via Stripe · 12:04", a: "$1,200", ok: true },
                    { i: Clock, t: "Deep work · Platform API", m: "Today, 09:40 → 12:20", a: "2h 40m", ok: false },
                  ].map((r) => {
                    const I = r.i;
                    return (
                      <div key={r.t} className="flex items-center gap-3 p-3">
                        <span className="w-7 h-7 rounded-md bg-accent-soft dark:bg-accent/15 text-accent flex items-center justify-center">
                          <I className="w-3.5 h-3.5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold text-fg truncate">{r.t}</div>
                          <div className="text-[11px] text-muted truncate">{r.m}</div>
                        </div>
                        <span className="font-mono text-[11px] text-muted tabular-nums">{r.a}</span>
                        {r.ok && <CheckCircle2 className="w-3.5 h-3.5 text-ok" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
