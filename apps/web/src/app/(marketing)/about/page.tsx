"use client";

import Link from "next/link";
import { ArrowRight } from "@/components/animated-icons";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Rise } from "@/components/landing/motion";
import {
  Container,
  Eyebrow,
  LandingShell,
  MkButton,
  PageHero,
  Section,
} from "@/components/landing/layout";

/* ------------------------------------------------------------------
   About — same superset grammar: hero, hairline card grid, spec-sheet
   rows, centered manifesto closer.
------------------------------------------------------------------- */

const values = [
  {
    glyph: "01",
    title: "Built specifically for solo freelancers",
    desc: "Enterprise project management tools are cluttered with corporate bureaucracy. Freelance Book is streamlined strictly for individual contractors, consultants, and creators.",
  },
  {
    glyph: "02",
    title: "Free-first serverless economics",
    desc: "By engineering our platform on Neon PostgreSQL serverless SQL and Python FastAPI, our marginal infrastructure costs are near zero. We pass these savings directly to you with a free core plan forever.",
  },
  {
    glyph: "03",
    title: "Total data sovereignty & privacy",
    desc: "You own 100% of your client relationships, invoices, and work history. No vendor lock-in. Full JSON/CSV export at any time with encrypted JWT security.",
  },
  {
    glyph: "04",
    title: "Unified cross-platform flow",
    desc: "Stay in your creative flow. Access your business via high-performance Next.js 16 Web, instant Windows Quick Capture (Ctrl+Shift+F), or Android mobile sync.",
  },
];

const milestones = [
  {
    label: "The problem",
    title: "Six disconnected SaaS subscriptions",
    desc: "Freelancers were forced to juggle Trello for boards, Toggl for time tracking, FreshBooks for invoices, Notion for client notes, and ChatGPT in a separate tab — paying $150+/month for parts that never talked to each other.",
  },
  {
    label: "The vision",
    title: "One unified operating system",
    desc: "We set out to engineer a single, cohesive system that unifies CRM, project views, Pomodoro focus, PDF billing, and AI reasoning in one blazing-fast interface.",
  },
  {
    label: "The architecture",
    title: "Modern serverless stack",
    desc: "Neon PostgreSQL, Python FastAPI async backend, Clerk authentication, and shared React components — chosen for sub-second responsiveness and near-zero running costs.",
  },
  {
    label: "Today",
    title: "Freelance Book 1.0",
    desc: "A production-grade, community-driven platform helping independent freelancers run profitable, organized, and stress-free businesses.",
  },
];

export default function AboutPage() {
  return (
    <LandingShell>
      <Navbar />

      <main className="flex-1">
        <PageHero
          eyebrow="Our mission & story"
          title="Built by freelancers,"
          accent="for independent creators."
          desc="We believe independent work is the future of the global economy. Freelancers shouldn't need a bloated suite of expensive tools to run a world-class business."
        />

        <Section className="border-t-0">
          <Container>
            <Rise className="max-w-2xl">
              <Eyebrow className="mb-4">Philosophy</Eyebrow>
              <h2 className="text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl lg:text-5xl">
                What drives every line
                <br />
                of code we write.
              </h2>
            </Rise>
            <Rise delay={0.08}>
              <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
                {values.map((val) => (
                  <div key={val.title} className="relative rounded-[2px] border border-fg/10 bg-fg/[0.03] p-6">
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-[2px] border border-line bg-surface font-mono text-[11px] text-brand-light">
                      {val.glyph}
                    </div>
                    <h3 className="mb-2 text-lg font-medium text-fg/90">{val.title}</h3>
                    <p className="text-sm leading-relaxed text-muted">{val.desc}</p>
                  </div>
                ))}
              </div>
            </Rise>
          </Container>
        </Section>

        <Section>
          <Container>
            <Rise className="max-w-2xl">
              <Eyebrow className="mb-4">The journey</Eyebrow>
              <h2 className="text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl lg:text-5xl">
                Why Freelance Book OS
                <br />
                exists.
              </h2>
            </Rise>
            <div className="mt-12 max-w-3xl border-t border-line">
              {milestones.map((m, idx) => (
                <Rise key={m.label} delay={idx * 0.05}>
                  <div className="grid gap-2 border-b border-line py-7 sm:grid-cols-[150px_1fr] sm:gap-8">
                    <div className="font-mono text-[10.5px] uppercase tracking-widest text-brand pt-1">
                      {m.label}
                    </div>
                    <div>
                      <h3 className="mb-2 text-lg font-medium text-fg/90">{m.title}</h3>
                      <p className="text-[14px] leading-7 text-muted">{m.desc}</p>
                    </div>
                  </div>
                </Rise>
              ))}
            </div>
          </Container>
        </Section>

        <Section>
          <Container className="max-w-3xl text-center">
            <Rise className="flex flex-col items-center">
              <p className="font-mono text-sm text-brand">&ldquo;</p>
              <p className="mt-4 text-[20px] font-light leading-[1.5] text-fg sm:text-[24px]">
                You don&apos;t need a team of 50 to create massive value. You need clear
                priorities, automatic time capture, transparent client trust, and software
                that gets out of your way.
              </p>
              <div className="mt-6 font-mono text-[11px] uppercase tracking-widest text-muted">
                — The Freelancer Manifesto
              </div>

              <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/sign-up" className="w-full sm:w-auto">
                  <MkButton className="w-full sm:w-auto">
                    Join free
                    <ArrowRight className="size-4" />
                  </MkButton>
                </Link>
                <Link href="/features" className="w-full sm:w-auto">
                  <MkButton variant="outline" className="w-full sm:w-auto">
                    Explore all modules
                  </MkButton>
                </Link>
              </div>
            </Rise>
          </Container>
        </Section>
      </main>

      <Footer />
    </LandingShell>
  );
}
