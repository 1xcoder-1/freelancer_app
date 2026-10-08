"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
} from "@/components/animated-icons";
import { Reveal } from "@/components/landing/motion";
import {
  Container,
  LandingShell,
  PageHero,
  Section,
  SectionHeader,
} from "@/components/landing/layout";

const demoScenarios = [
  {
    title: "Generate a project scope & milestones",
    category: "Planning",
    prompt:
      "I have a new client who wants a Next.js 16 e-commerce store with Stripe Checkout and Cloudinary image uploads. Draft a 3-milestone project plan with estimated hours and pricing at $95/hr.",
    response: `Project Proposal & Milestone Plan — Next.js 16 E-Commerce Store

Total Estimated Hours: 45 h · Rate: $95/h · Budget: $4,275

Milestone 1 — Architecture & UI scaffolding ($1,425)
 · Next.js 16 App Router setup with Tailwind v4 design system
 · Product catalog grid, filter drawer, responsive layouts
 · Effort: 15 h

Milestone 2 — Cloudinary asset pipeline & cart ($1,425)
 · Cloudinary integration for product image uploads
 · Persistent cart with optimistic UI updates
 · Effort: 15 h

Milestone 3 — Stripe checkout & testing ($1,425)
 · Stripe Elements checkout with fulfillment webhooks
 · End-to-end testing, invoice generation, deployment
 · Effort: 15 h`,
  },
  {
    title: "Draft an overdue invoice reminder",
    category: "Client comms",
    prompt:
      "Invoice #INV-2026-089 for $2,800 to Acme Corp is 7 days overdue. Draft a professional, friendly reminder email with payment link.",
    response: `Subject: Friendly follow-up — Invoice #INV-2026-089

Hi Sarah,

Hope you're having a good week. I'm checking in on invoice
#INV-2026-089 ($2,800, Full-Stack Replatforming), which was
due September 11.

You can review and pay securely here:
  → freelancebook.app/pay/INV-2026-089

If it's already scheduled with your accounts team, just
disregard this note. Happy to send any extra tax docs you
need.

Best,
Alex`,
  },
  {
    title: "Audit my effective hourly rate",
    category: "Analytics",
    prompt:
      "Analyze my last 3 projects: Alpha (Fixed $5,000, 62h), Beta (Hourly $85/h, 40h), Gamma (Fixed $2,500, 18h). What is my real effective rate?",
    response: `Real effective hourly rate (EHR) breakdown

Alpha   $5,000 / 62 h  →  $80.64/h  (scope creep cut into target)
Beta    $3,400 / 40 h  →  $85.00/h  (matched baseline exactly)
Gamma   $2,500 / 18 h  →  $138.89/h (tight scoping paid off)

Weighted average: $91.66/h

Recommendation: tightly scoped fixed-price work (Gamma)
returned +63% over your baseline hourly billing. Consider a
$120/h floor for future fixed bids and a scope-change clause
on anything over 40 hours.`,
  },
];

export default function BookAIPage() {
  const [selected, setSelected] = useState(0);

  return (
    <LandingShell>
      <Navbar />

      <main className="flex-1">
        <PageHero
          eyebrow="Book AI copilot"
          title="An assistant that already knows"
          accent="your business."
          desc="Book AI reads your active clients, tracked time, milestones and invoice history — so proposals, reminders and rate audits come out sounding like you, not like a template."
        />

        {/* Interactive prompt playground */}
        <Section className="border-t-0">
          <Container>
            <Reveal>
              <div className="rounded-xl border border-line bg-card overflow-hidden">
                <div className="grid lg:grid-cols-[300px_1fr]">
                  {/* Scenario selector */}
                  <div className="border-b lg:border-b-0 lg:border-r border-line p-4 sm:p-5 bg-surface/40">
                    <div className="eyebrow !text-[10px] mb-4">Try a scenario</div>
                    <div className="space-y-2">
                      {demoScenarios.map((scen, idx) => {
                        const active = selected === idx;
                        return (
                          <button
                            key={scen.title}
                            onClick={() => setSelected(idx)}
                            aria-pressed={active}
                            className={`w-full cursor-pointer rounded-lg border p-4 text-left transition-colors duration-150 ${
                              active
                                ? "border-accent/30 bg-accent-soft dark:bg-accent/15"
                                : "border-line bg-card hover:border-line-strong"
                            }`}
                          >
                            <div
                              className={`font-mono text-[10px] uppercase tracking-[0.14em] mb-1.5 ${
                                active ? "text-accent" : "text-faint"
                              }`}
                            >
                              {scen.category}
                            </div>
                            <div className="text-[13px] font-semibold leading-5 text-fg">
                              {scen.title}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 pt-4 border-t border-line flex items-center gap-2 text-[11px] text-muted font-mono">
                      <ShieldCheck className="w-3.5 h-3.5 text-ok shrink-0" />
                      <span>Workspace-isolated queries</span>
                    </div>
                  </div>

                  {/* Prompt + output */}
                  <div className="p-5 sm:p-7 flex flex-col">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={selected}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="flex-1"
                      >
                        <div className="flex items-start gap-3 rounded-lg border border-line bg-bg p-4 mb-5">
                          <MessageSquare className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                          <p className="text-[13px] leading-6 text-fg">
                            {demoScenarios[selected].prompt}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-3.5 h-3.5 text-accent" />
                          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
                            Book AI output
                          </span>
                        </div>
                        <div className="rounded-lg border border-line bg-bg p-4 font-mono text-[12px] sm:text-[12.5px] leading-6 whitespace-pre-wrap text-fg/90 tabular-nums">
                          {demoScenarios[selected].response}
                        </div>
                      </motion.div>
                    </AnimatePresence>

                    <div className="mt-6 pt-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3">
                      <span className="font-mono text-[11px] text-faint">
                        Gemini 2.5 Flash / OpenAI 4o · multi-model
                      </span>
                      <Link
                        href="/sign-up"
                        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent transition-colors duration-150 hover:text-accent-hi"
                      >
                        Try it with your projects
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </Container>
        </Section>

        {/* What it can do — three hairline columns */}
        <Section>
          <Container>
            <SectionHeader
              eyebrow="Capabilities"
              title="Drafted, summarized and audited"
              accent="in your voice."
            />
            <div className="grid md:grid-cols-3 gap-x-10">
              {[
                {
                  t: "Scopes & proposals",
                  d: "Turn a one-line brief into a milestone plan with hours and pricing you can actually defend.",
                },
                {
                  t: "Client communication",
                  d: "Reminder emails, meeting summaries and contract clause drafts, phrased the way you'd phrase them.",
                },
                {
                  t: "Business analytics",
                  d: "Effective hourly rate, project margins and win-rate trends computed from your real tracked data.",
                },
              ].map((c) => (
                <Reveal key={c.t}>
                  <div className="py-6 border-t border-line">
                    <h3 className="font-display text-[15px] font-semibold text-fg mb-2">{c.t}</h3>
                    <p className="text-[13px] leading-6 text-muted">{c.d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>
      </main>

      <Footer />
    </LandingShell>
  );
}
