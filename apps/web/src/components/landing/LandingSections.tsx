"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Gauge,
  Play,
  Quote,
  Receipt,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------
   Landing sections following the reference marketing format:
   centered two-line headline (second line italic accent) + a wide
   bordered product-mock panel per section.
------------------------------------------------------------------- */

function SectionHeading({
  title,
  accent,
  desc,
}: {
  title: string;
  accent: string;
  desc: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="text-center max-w-2xl mx-auto mb-12"
    >
      <h2 className="font-display text-3xl sm:text-[2.6rem] font-bold text-fg leading-[1.12] tracking-tight mb-4">
        {title}{" "}
        <span className="italic font-medium text-accent">{accent}</span>
      </h2>
      <p className="text-[14px] sm:text-[15px] text-muted leading-relaxed">{desc}</p>
    </motion.div>
  );
}

/* Browser-ish frame around every mock panel */
function MockFrame({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-card shadow-2xl overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-surface/60">
        <span className="w-2 h-2 rounded-full bg-danger/60" />
        <span className="w-2 h-2 rounded-full bg-warn/60" />
        <span className="w-2 h-2 rounded-full bg-ok/60" />
        <span className="ml-2 font-mono text-[9px] text-faint tracking-wider">{label}</span>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

function MockRow({
  icon: Icon,
  title,
  meta,
  right,
  tone = "accent",
}: {
  icon: React.ElementType;
  title: string;
  meta: string;
  right: string;
  tone?: "accent" | "ok" | "warn" | "info";
}) {
  const toneCls =
    tone === "ok"
      ? "bg-ok/10 text-ok"
      : tone === "warn"
      ? "bg-warn/15 text-warn"
      : tone === "info"
      ? "bg-info/10 text-info"
      : "bg-accent-soft dark:bg-accent/15 text-accent";
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-line bg-bg">
      <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${toneCls}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-fg truncate">{title}</div>
        <div className="text-[10px] text-muted truncate">{meta}</div>
      </div>
      <span className="font-mono text-[10px] text-muted shrink-0">{right}</span>
    </div>
  );
}

/* ============================ FEATURES ============================ */

export function Features() {
  return (
    <section id="features" className="py-20 border-t border-line bg-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionHeading
          title="Clients and cash flow,"
          accent="finally in one place."
          desc="Every module is linked. A client opens into their projects, time flows into invoices, and proposals become contracts without re-typing a single detail."
        />

        <div className="grid md:grid-cols-2 gap-5">
          <MockFrame label="freelancebook.app/clients">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-fg">Client CRM</div>
              <span className="font-mono text-[10px] text-accent">+ Add client</span>
            </div>
            <div className="space-y-2.5">
              <MockRow icon={Building2} title="Acme Corp" meta="Retainer · $3,000/mo" right="LTV $28.4k" tone="accent" />
              <MockRow icon={Building2} title="Nova Studio" meta="3 active projects" right="LTV $12.1k" tone="info" />
              <MockRow icon={Building2} title="Helio Labs" meta="Invoice overdue 6 days" right="LTV $7.9k" tone="warn" />
            </div>
          </MockFrame>

          <MockFrame label="freelancebook.app/invoices">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-fg">Invoices & Escrow</div>
              <span className="font-mono text-[10px] text-accent">Create invoice</span>
            </div>
            <div className="space-y-2.5">
              <MockRow icon={Receipt} title="INV-024 · Acme Corp" meta="Paid via Stripe" right="$1,200" tone="ok" />
              <MockRow icon={Receipt} title="INV-023 · Nova Studio" meta="Pending · due Sep 28" right="$2,400" tone="warn" />
              <MockRow icon={FileText} title="Contract signed · Helio" meta="Escrow funded" right="$5,000" tone="accent" />
            </div>
          </MockFrame>

          <MockFrame label="freelancebook.app/time-tracker">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-fg">Time → Invoice</div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-accent">
                <Play className="w-2.5 h-2.5" /> Tracking 2h 40m
              </span>
            </div>
            <div className="space-y-2.5">
              <MockRow icon={Clock} title="Platform API · deep work" meta="Today, 09:40 → 12:20" right="billable" tone="accent" />
              <MockRow icon={Clock} title="Client call · weekly sync" meta="Yesterday 15:00" right="billable" tone="info" />
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent-soft dark:bg-accent/15 border border-accent/20">
                <span className="text-[11px] font-semibold text-accent">Convert 36h this week into a draft invoice</span>
                <ArrowRight className="w-3.5 h-3.5 text-accent" />
              </div>
            </div>
          </MockFrame>

          <MockFrame label="freelancebook.app/proposals">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-fg">Proposals with Book AI</div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-accent">
                <Sparkles className="w-2.5 h-2.5" /> AI draft
              </span>
            </div>
            <div className="space-y-2.5">
              <MockRow icon={FileText} title="Data pipeline rebuild" meta="Win rate score 87%" right="sent" tone="ok" />
              <MockRow icon={Users} title="Design system retainer" meta="Uses Acme's intake answers" right="draft" tone="accent" />
              <MockRow icon={CalendarCheck} title="Discovery call booked" meta="Thu 14:00 · auto-scheduled" right="confirmed" tone="info" />
            </div>
          </MockFrame>
        </div>
      </div>
    </section>
  );
}

/* ============================ WORKFLOW ============================ */

export function Workflow() {
  const steps = [
    { n: "01", t: "Capture", d: "Log a client, call or task in seconds — intake forms and quick capture do the typing for you." },
    { n: "02", t: "Ship", d: "Run projects with kanban, milestones and a focus timer that keeps every billable minute accounted for." },
    { n: "03", t: "Get paid", d: "One click turns tracked time into an itemized invoice, with contracts and escrow wired in." },
  ];

  return (
    <section id="workflow" className="py-20 border-t border-line bg-card">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionHeading
          title="Three moves,"
          accent="zero busywork."
          desc="The same loop every week — capture the work, ship it, bill it. Freelance Book keeps the loop tight so nothing leaks through six browser tabs."
        />

        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="rounded-xl border border-line bg-bg p-6"
            >
              <div className="font-mono text-[11px] font-bold text-accent tracking-widest mb-3">{s.n}</div>
              <h3 className="font-display text-lg font-bold text-fg mb-2">{s.t}</h3>
              <p className="text-[13px] text-muted leading-relaxed">{s.d}</p>
            </motion.div>
          ))}
        </div>

        {/* Report-card mock strip */}
        <MockFrame label="freelancebook.app/report-card">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="50" stroke="var(--line)" strokeWidth="10" fill="transparent" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="var(--accent)"
                  strokeWidth="10"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 50}
                  strokeDashoffset={2 * Math.PI * 50 * 0.18}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-xl font-bold text-fg">82%</span>
                <span className="text-[9px] text-muted">delivery score</span>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-3 w-full">
              {[
                { l: "On-time", v: "96%", i: Gauge, tone: "text-ok" },
                { l: "Avg. reply", v: "3.2h", i: Clock, tone: "text-accent" },
                { l: "Streak", v: "12d", i: Star, tone: "text-warn" },
              ].map((m) => {
                const I = m.i;
                return (
                  <div key={m.l} className="rounded-lg border border-line bg-bg p-3 text-center">
                    <I className={`w-4 h-4 mx-auto mb-1.5 ${m.tone}`} />
                    <div className="font-mono text-sm font-bold text-fg">{m.v}</div>
                    <div className="text-[10px] text-muted">{m.l}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </MockFrame>
      </div>
    </section>
  );
}

/* ========================== WALL OF LOVE ========================== */

const testimonials = [
  {
    name: "Maya Farouk",
    role: "Product designer, Cairo",
    quote: "I stopped losing invoices in email threads. Time → invoice in one click paid me a week earlier every month.",
    stars: 5,
  },
  {
    name: "Dan Kowalski",
    role: "Full-stack contractor",
    quote: "The client CRM remembers everything I forget. Intake forms alone saved my first hour of every project.",
    stars: 5,
  },
  {
    name: "Priya Nair",
    role: "Brand strategist",
    quote: "Book AI drafts proposals that sound like me — and my win rate went from 40% to 65% in a quarter.",
    stars: 5,
  },
  {
    name: "Tomás Rivera",
    role: "iOS freelancer",
    quote: "The report card keeps me honest. On-time %, effective rate, streaks — it's my Monday ritual now.",
    stars: 5,
  },
  {
    name: "Aisha Bello",
    role: "Data consultant",
    quote: "Contracts, e-signatures and escrow in the same tab as my task board. No more tool-tax every month.",
    stars: 4,
  },
  {
    name: "Lukas Meyer",
    role: "Agency of one",
    quote: "It feels like Notion met an accountant. Slim, fast, and nothing glows at me for no reason.",
    stars: 5,
  },
];

export function WallOfLove() {
  return (
    <section id="reviews" className="py-20 border-t border-line bg-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <SectionHeading
          title="Freelancers don't review tools."
          accent="They review survival."
          desc="Here's what changed for people who moved their whole business into the book."
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
              className="rounded-xl border border-line bg-card p-5 flex flex-col"
            >
              <Quote className="w-4 h-4 text-accent mb-3" />
              <p className="text-[13px] text-fg leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-0.5 mt-4 mb-2">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star
                    key={s}
                    className={`w-3 h-3 ${s < t.stars ? "text-accent fill-accent" : "text-line-strong"}`}
                  />
                ))}
              </div>
              <div className="text-[12px] font-semibold text-fg">{t.name}</div>
              <div className="text-[11px] text-muted">{t.role}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================== FAQ =============================== */

const faqs = [
  {
    q: "Is it actually free?",
    a: "Yes — the core operating system (clients, projects, time, invoices) is free forever. Book AI credits and multi-seat agency features are the only paid extras.",
  },
  {
    q: "How is my data protected?",
    a: "Everything is scoped to your account behind JWT auth (Clerk), stored in PostgreSQL, and shared links are tokenized and revocable at any time.",
  },
  {
    q: "Can I send invoices to real clients?",
    a: "Absolutely. Create an invoice, share a public pay page, accept Stripe or manual payment, and track paid / overdue status automatically.",
  },
  {
    q: "Does time tracking run in the background?",
    a: "The web timer lives in your dashboard, and the desktop companion adds a global Ctrl+Shift+F quick-capture so you never lose the 'what was I working on' moment.",
  },
  {
    q: "What is the Report Card?",
    a: "A personal scorecard of your business: on-time delivery, payment reliability, effective hourly rate and streaks — the numbers most freelancers guess at.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 border-t border-line bg-card">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <SectionHeading
          title="Questions before you"
          accent="switch?"
          desc="The short answers to what freelancers ask us most."
        />

        <div className="space-y-2.5">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="rounded-xl border border-line bg-bg overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
                >
                  <span className="text-sm font-semibold text-fg">{f.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-[13px] text-muted leading-relaxed">{f.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================ CTA BAND ============================ */

export function CtaBand() {
  return (
    <section className="py-24 border-t border-line bg-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-fg tracking-tight leading-[1.1] mb-5">
            Stop juggling tabs.{" "}
            <span className="italic font-medium text-accent">Start shipping.</span>
          </h2>
          <p className="text-[15px] text-muted max-w-xl mx-auto mb-9 leading-relaxed">
            Move your clients, time and money into one calm book. Free forever
            for the core — set up in 90 seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/sign-up">
              <Button size="lg" className="rounded-lg font-bold px-8">
                Create your account
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" size="lg" className="rounded-lg font-semibold px-8">
                See pricing
              </Button>
            </Link>
          </div>
          <div className="mt-7 flex items-center justify-center gap-5 text-[11px] text-faint font-mono">
            <span className="inline-flex items-center gap-1.5"><Check className="w-3 h-3 text-ok" /> No credit card</span>
            <span className="inline-flex items-center gap-1.5"><Check className="w-3 h-3 text-ok" /> Export anytime</span>
            <span className="inline-flex items-center gap-1.5"><Check className="w-3 h-3 text-ok" /> Cancel in one click</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
