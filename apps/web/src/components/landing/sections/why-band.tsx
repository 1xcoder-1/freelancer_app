"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import { CountUp } from "@/components/common/CountUp";
import { Container, Eyebrow } from "@/components/landing/layout";
import { Rise, Stagger, StaggerItem } from "@/components/landing/motion";

/* ============================ WHY BAND ============================
   Replaces the trusted-by logo strip (pre-launch: no customers to
   show). Count-style stat band with honest product facts, then a mono
   strip of every module the book carries.
=================================================================== */

function CountStat({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <span ref={ref} className="tabular-nums">
      {inView ? <CountUp value={value} durationMs={900} /> : 0}
      {suffix}
    </span>
  );
}

const whyStats = [
  {
    index: "01",
    display: (
      <>
        6 <span className="text-brand">→</span> 1
      </>
    ),
    label: "tools folded into a single book — time, money and clients stop living in separate tabs",
  },
  {
    index: "02",
    display: <CountStat value={90} suffix="s" />,
    label: "from sign-up to your first client — no setup wizard, no import marathon",
  },
  {
    index: "03",
    display: <>$0</>,
    label: "to start — the core operating system is free, forever, no card",
  },
  {
    index: "04",
    display: <CountStat value={100} suffix="%" />,
    label: "yours — every client, invoice and minute exports in one click",
  },
];

export function WhyBand() {
  return (
    <section className="relative overflow-hidden border-y border-line/60 py-20 sm:py-28">
      <Container>
        <Stagger className="max-w-2xl">
          <StaggerItem>
            <Eyebrow>Why Freelance Book</Eyebrow>
          </StaggerItem>
          <StaggerItem>
            <h2 className="mt-4 text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl">
              One book. Every part of the business.
            </h2>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-4 text-base text-muted sm:text-lg">
              No integrations to babysit and no six-tab shuffle — the modules
              share one brain, so your numbers already agree with each other.
            </p>
          </StaggerItem>
        </Stagger>
        <div className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {whyStats.map((s, i) => (
            <Rise key={s.index} delay={i * 0.06}>
              <div className="border-t border-line/70 pt-6">
                <span className="font-mono text-xs text-muted/60">{s.index}</span>
                <p className="mt-3 text-4xl font-medium tracking-tight text-fg sm:text-5xl">
                  {s.display}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted">{s.label}</p>
              </div>
            </Rise>
          ))}
        </div>
        <Rise className="mt-14 flex flex-wrap items-center gap-2">
          <span className="mr-2 font-mono text-xs uppercase tracking-widest text-muted/70">
            In the book
          </span>
          {[
            "Clients",
            "Projects",
            "Time",
            "Invoices",
            "Proposals",
            "Contracts",
            "Booking",
            "Planner",
            "Leads",
            "Report Card",
            "Book AI",
          ].map((m) => (
            <span
              key={m}
              className="rounded-[2px] border border-line bg-fg/[0.03] px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-fg/20 hover:text-fg"
            >
              {m}
            </span>
          ))}
        </Rise>
      </Container>
    </section>
  );
}
