"use client";

import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  ArrowRight,
  Target,
  Zap,
  Lock,
  Globe,
  Quote,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Reveal, hoverLift } from "@/components/landing/motion";
import {
  Container,
  LandingShell,
  PageHero,
  Section,
  SectionHeader,
} from "@/components/landing/layout";

const values = [
  {
    icon: Target,
    title: "Built specifically for solo freelancers",
    desc: "Enterprise project management tools are cluttered with corporate bureaucracy. Freelance Book is streamlined strictly for individual contractors, consultants, and creators.",
  },
  {
    icon: Zap,
    title: "Free-first serverless economics",
    desc: "By engineering our platform on Neon PostgreSQL serverless SQL and Python FastAPI, our marginal infrastructure costs are near zero. We pass these savings directly to you with a free core plan forever.",
  },
  {
    icon: Lock,
    title: "Total data sovereignty & privacy",
    desc: "You own 100% of your client relationships, invoices, and work history. No vendor lock-in. Full JSON/CSV export at any time with encrypted JWT security.",
  },
  {
    icon: Globe,
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

        {/* Core values — flat cards, one accent tone, no badge noise */}
        <Section>
          <Container>
            <SectionHeader
              eyebrow="Philosophy"
              title="What drives every line"
              accent="of code we write."
            />

            <div className="grid md:grid-cols-2 gap-5">
              {values.map((val, idx) => {
                const Icon = val.icon;
                return (
                  <Reveal key={val.title} delay={idx * 0.06}>
                    <div className={`h-full rounded-xl border border-line bg-card p-6 sm:p-7 ${hoverLift}`}>
                      <div className="w-8 h-8 rounded-lg bg-accent-soft dark:bg-accent/15 text-accent flex items-center justify-center mb-5">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h3 className="font-display text-[16px] font-semibold text-fg mb-2">
                        {val.title}
                      </h3>
                      <p className="text-[13px] leading-6 text-muted">{val.desc}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </Container>
        </Section>

        {/* Story timeline — spec-sheet rows, not stacked cards */}
        <Section>
          <Container>
            <SectionHeader
              eyebrow="The journey"
              title="Why Freelance Book OS"
              accent="exists."
            />

            <div className="max-w-3xl mx-auto border-t border-line">
              {milestones.map((m, idx) => (
                <Reveal key={m.label} delay={idx * 0.05}>
                  <div className="grid sm:grid-cols-[150px_1fr] gap-2 sm:gap-8 py-7 border-b border-line">
                    <div className="eyebrow !text-[10.5px] pt-1">{m.label}</div>
                    <div>
                      <h3 className="font-display text-[16px] font-semibold text-fg mb-2">
                        {m.title}
                      </h3>
                      <p className="text-[14px] leading-7 text-muted">{m.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>

        {/* Manifesto + closing CTA */}
        <Section>
          <Container className="max-w-3xl text-center">
            <Reveal>
              <Quote className="w-6 h-6 text-accent mx-auto mb-6" />
              <p className="font-display text-[20px] sm:text-[24px] leading-[1.5] text-fg">
                &ldquo;You don&rsquo;t need a team of 50 to create massive value. You
                need clear priorities, automatic time capture, transparent client
                trust, and software that gets out of your way.&rdquo;
              </p>
              <div className="eyebrow mt-6">— The Freelancer Manifesto</div>

              <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/sign-up" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto rounded-lg font-semibold px-7">
                    Join free
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </Link>
                <Link href="/features" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-lg font-semibold px-7">
                    Explore all modules
                  </Button>
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
