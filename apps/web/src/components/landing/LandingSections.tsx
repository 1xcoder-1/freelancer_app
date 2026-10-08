"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
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
  Receipt,
  Sparkles,
  Users,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Reveal, SplitHeading, hoverLift } from "@/components/landing/motion";
import { Container, Section, SectionHeader, Stat } from "@/components/landing/layout";

/* ------------------------------------------------------------------
   Home-page sections. Layout, type scale and rhythm come from the
   shared marketing layout system (components/landing/layout.tsx) —
   these files only carry content.
------------------------------------------------------------------- */

/* Browser-ish frame around every mock panel — the one place shadows
   are allowed, because these windows read as floating above the page. */
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
      className={`rounded-xl border border-line bg-card shadow-lg shadow-black/[0.06] dark:shadow-black/25 overflow-hidden ${hoverLift} ${className}`}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-surface/60">
        <span className="w-2 h-2 rounded-full bg-danger/60" />
        <span className="w-2 h-2 rounded-full bg-warn/60" />
        <span className="w-2 h-2 rounded-full bg-ok/60" />
        <span className="ml-2 font-mono text-[10px] text-faint tracking-wider">{label}</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
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
      <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${toneCls}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-fg truncate">{title}</div>
        <div className="text-[11px] text-muted truncate">{meta}</div>
      </div>
      <span className="font-mono text-[11px] text-muted shrink-0 tabular-nums">{right}</span>
    </div>
  );
}

function MockHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="text-[13px] font-semibold text-fg">{title}</div>
      {action}
    </div>
  );
}

/* ============================ FEATURES ============================ */

export function Features() {
  return (
    <Section id="features">
      <Container>
        <SectionHeader
          eyebrow="The modules"
          title="Clients and cash flow,"
          accent="finally in one place."
          desc="Every module is linked. A client opens into their projects, time flows into invoices, and proposals become contracts without re-typing a single detail."
        />

        <div className="grid md:grid-cols-2 gap-5">
          <Reveal>
            <MockFrame label="freelancebook.app/clients">
              <MockHeader
                title="Client CRM"
                action={<span className="font-mono text-[11px] text-accent">+ Add client</span>}
              />
              <div className="space-y-2.5">
                <MockRow icon={Building2} title="Acme Corp" meta="Retainer · $3,000/mo" right="LTV $28.4k" tone="accent" />
                <MockRow icon={Building2} title="Nova Studio" meta="3 active projects" right="LTV $12.1k" tone="info" />
                <MockRow icon={Building2} title="Helio Labs" meta="Invoice overdue 6 days" right="LTV $7.9k" tone="warn" />
              </div>
            </MockFrame>
          </Reveal>

          <Reveal delay={0.1}>
            <MockFrame label="freelancebook.app/invoices">
              <MockHeader
                title="Invoices & Escrow"
                action={<span className="font-mono text-[11px] text-accent">Create invoice</span>}
              />
              <div className="space-y-2.5">
                <MockRow icon={Receipt} title="INV-024 · Acme Corp" meta="Paid via Stripe" right="$1,200" tone="ok" />
                <MockRow icon={Receipt} title="INV-023 · Nova Studio" meta="Pending · due Sep 28" right="$2,400" tone="warn" />
                <MockRow icon={FileText} title="Contract signed · Helio" meta="Escrow funded" right="$5,000" tone="accent" />
              </div>
            </MockFrame>
          </Reveal>

          <Reveal>
            <MockFrame label="freelancebook.app/time-tracker">
              <MockHeader
                title="Time → Invoice"
                action={
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-accent">
                    <Play className="w-2.5 h-2.5" /> Tracking 2h 40m
                  </span>
                }
              />
              <div className="space-y-2.5">
                <MockRow icon={Clock} title="Platform API · deep work" meta="Today, 09:40 → 12:20" right="billable" tone="accent" />
                <MockRow icon={Clock} title="Client call · weekly sync" meta="Yesterday 15:00" right="billable" tone="info" />
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-accent-soft dark:bg-accent/15 border border-accent/20">
                  <span className="text-[12px] font-semibold text-accent">Convert 36h this week into a draft invoice</span>
                  <ArrowRight className="w-3.5 h-3.5 text-accent" />
                </div>
              </div>
            </MockFrame>
          </Reveal>

          <Reveal delay={0.1}>
            <MockFrame label="freelancebook.app/proposals">
              <MockHeader
                title="Proposals with Book AI"
                action={
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-accent">
                    <Sparkles className="w-2.5 h-2.5" /> AI draft
                  </span>
                }
              />
              <div className="space-y-2.5">
                <MockRow icon={FileText} title="Data pipeline rebuild" meta="Win rate score 87%" right="sent" tone="ok" />
                <MockRow icon={Users} title="Design system retainer" meta="Uses Acme's intake answers" right="draft" tone="accent" />
                <MockRow icon={CalendarCheck} title="Discovery call booked" meta="Thu 14:00 · auto-scheduled" right="confirmed" tone="info" />
              </div>
            </MockFrame>
          </Reveal>
        </div>
      </Container>
    </Section>
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
    <Section id="workflow">
      <Container>
        <SectionHeader
          eyebrow="The loop"
          title="Three moves,"
          accent="zero busywork."
          desc="The same loop every week — capture the work, ship it, bill it. Freelance Book keeps the loop tight so nothing leaks through six browser tabs."
        />

        {/* Hairline columns instead of identical cards — sequence reads
            left-to-right, divider marks the steps. */}
        <div className="grid md:grid-cols-3 mb-16">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className={`px-0 sm:px-8 first:sm:pl-0 last:sm:pr-0 py-6 sm:py-0 border-t md:border-t-0 md:border-l border-line first:md:border-l-0 ${i === 0 ? "border-t-0 pt-0 md:pt-0" : ""}`}
            >
              <div className="font-mono text-[11px] font-semibold text-accent tabular-nums mb-3">{s.n}</div>
              <h3 className="font-display text-[17px] font-semibold text-fg mb-2">{s.t}</h3>
              <p className="text-[13px] leading-6 text-muted">{s.d}</p>
            </motion.div>
          ))}
        </div>

        {/* Report-card mock strip */}
        <Reveal>
          <MockFrame label="freelancebook.app/report-card">
            <div className="flex flex-col sm:flex-row items-center gap-8">
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
                  <span className="font-mono text-xl font-semibold text-fg tabular-nums">82%</span>
                  <span className="text-[10px] text-muted">delivery score</span>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-4 w-full">
                {[
                  { l: "On-time delivery", v: "96%", i: Gauge, tone: "text-ok" },
                  { l: "Avg. reply time", v: "3.2h", i: Clock, tone: "text-accent" },
                  { l: "Billing streak", v: "12d", i: Play, tone: "text-warn" },
                ].map((m) => {
                  const I = m.i;
                  return (
                    <div key={m.l} className="text-left">
                      <I className={`w-4 h-4 mb-2 ${m.tone}`} />
                      <div className="font-mono text-[19px] font-semibold text-fg tabular-nums leading-none">{m.v}</div>
                      <div className="mt-1.5 text-[12px] text-muted">{m.l}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </MockFrame>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ========================== SOCIAL PROOF ==========================
   Editorial treatment — one featured quote with attribution, short
   plain-text lines beside it, and a figures band. No star ratings,
   no identical testimonial cards.
=================================================================== */

export function WallOfLove() {
  const shortQuotes = [
    {
      quote: "I stopped losing invoices in email threads. Time → invoice in one click paid me a week earlier every month.",
      name: "Maya Farouk",
      role: "Product designer, Cairo",
    },
    {
      quote: "The client CRM remembers everything I forget. Intake forms alone saved my first hour of every project.",
      name: "Dan Kowalski",
      role: "Full-stack contractor, Kraków",
    },
    {
      quote: "It feels like Notion met an accountant. Slim, fast, and nothing glows at me for no reason.",
      name: "Lukas Meyer",
      role: "Agency of one, Berlin",
    },
  ];

  return (
    <Section id="reviews">
      <Container>
        <SectionHeader
          eyebrow="In the wild"
          title="Freelancers don't review tools."
          accent="They review survival."
        />

        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16">
          {/* Featured quote */}
          <Reveal>
            <figure className="flex flex-col justify-between h-full">
              <blockquote className="font-display text-[22px] sm:text-[26px] leading-[1.45] text-fg">
                &ldquo;Book AI drafts proposals that sound like me — and my win rate went
                from 40% to 65% in a quarter.&rdquo;
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-accent-soft text-accent flex items-center justify-center font-mono text-[12px] font-semibold">
                  PN
                </span>
                <span className="text-[13px] leading-5">
                  <span className="font-semibold text-fg">Priya Nair</span>
                  <br />
                  <span className="text-muted">Brand strategist, Bengaluru</span>
                </span>
              </figcaption>
            </figure>
          </Reveal>

          {/* Plain-text lines, hairline separated */}
          <div className="flex flex-col justify-center divide-y divide-line border-y border-line">
            {shortQuotes.map((q, i) => (
              <Reveal key={q.name} delay={i * 0.08}>
                <div className="py-6">
                  <p className="text-[14px] leading-6 text-fg/90">&ldquo;{q.quote}&rdquo;</p>
                  <div className="mt-2.5 text-[12px] text-muted">
                    <span className="font-semibold text-fg">{q.name}</span> · {q.role}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Figures band */}
        <Reveal delay={0.1}>
          <div className="mt-16 pt-10 border-t border-line grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10">
            <Stat value="$1.9M" label="invoiced through the book" />
            <Stat value="36h" label="median time tracked per week" />
            <Stat value="11d" label="average billing streak" />
            <Stat value="90s" label="from signup to first client" />
          </div>
        </Reveal>
      </Container>
    </Section>
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
    <Section id="faq">
      <Container className="max-w-2xl">
        <SectionHeader
          eyebrow="FAQ"
          title="Questions before you"
          accent="switch?"
          desc="The short answers to what freelancers ask us most."
        />

        <div className="border-t border-line">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="border-b border-line">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-6 py-5 text-left cursor-pointer"
                >
                  <span className="text-[15px] font-semibold text-fg">{f.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pb-5 pr-10 text-[14px] leading-7 text-muted">{f.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

/* ============================ CTA BAND ============================ */

export function CtaBand() {
  return (
    <Section>
      <Container className="max-w-3xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <SplitHeading
            as="h2"
            text="Stop juggling tabs."
            accent="Start shipping."
            className="font-display text-[26px] sm:text-[34px] font-semibold text-fg leading-[1.2]"
          />
          <p className="mt-4 text-[15px] leading-7 text-muted max-w-xl mx-auto">
            Move your clients, time and money into one calm book. Free forever
            for the core — set up in 90 seconds.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/sign-up" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto rounded-lg font-semibold px-7">
                Create your account
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <Link href="/features" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-lg font-semibold px-7">
                Explore the modules
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-muted font-mono">
            <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-ok" /> No credit card</span>
            <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-ok" /> Export anytime</span>
            <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-ok" /> Cancel in one click</span>
          </div>
        </motion.div>
      </Container>
    </Section>
  );
}
