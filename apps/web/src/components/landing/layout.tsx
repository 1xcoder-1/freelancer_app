"use client";

import * as React from "react";
import { MotionConfig } from "framer-motion";
import { Reveal, SplitHeading } from "@/components/landing/motion";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Marketing layout system — one source of truth for container width,
   section rhythm and the type scale, so every landing/marketing page
   reads as one publication instead of per-page improvisation.

   Scale (px, optical-leading tuned):
     H1 page-hero   30 → 42 sm   font-semibold  leading-[1.12]
     H1 home hero   34 → 52 lg   font-semibold  leading-[1.06]
     H2 section     24 → 32 sm   font-semibold  leading-[1.2]
     Lead           15 → 16 sm   muted          leading-7
     Body           15           fg             leading-7
     Secondary      13           muted          leading-6
     Eyebrow        11.5 mono, 0.18em, uppercase (.eyebrow)
     Stat           28 mono semibold + 13 label

   Rhythm: sections py-24 sm:py-28 separated by a single hairline;
   header-to-content gap mb-16; grids gap-5 (cards) / gap-10 (columns).
   Elevation: cards sit flat (border only); shadows reserved for the
   floating mock windows.
------------------------------------------------------------------- */

/** Global page width for everything marketing. */
export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-6xl mx-auto px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}

/** Standard content section: one vertical rhythm, one divider style. */
export function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-24 sm:py-28 border-t border-line", className)}>
      {children}
    </section>
  );
}

/** Mono eyebrow label — replaces the colored-badge noise across pages. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("eyebrow", className)}>{children}</div>;
}

/** Centered section header: eyebrow → two-tone headline → lead. */
export function SectionHeader({
  eyebrow,
  title,
  accent,
  suffix,
  desc,
  className,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  suffix?: string;
  desc?: string;
  className?: string;
}) {
  return (
    <div className={cn("text-center max-w-2xl mx-auto mb-16", className)}>
      {eyebrow && (
        <Reveal>
          <Eyebrow className="mb-4">{eyebrow}</Eyebrow>
        </Reveal>
      )}
      <SplitHeading
        as="h2"
        text={title}
        accent={accent}
        suffix={suffix}
        className="font-display text-[24px] sm:text-[32px] font-semibold text-fg leading-[1.2]"
      />
      {desc && (
        <Reveal delay={0.1}>
          <p className="mt-4 text-[15px] leading-7 text-muted">{desc}</p>
        </Reveal>
      )}
    </div>
  );
}

/** Sub-page hero — same grammar as SectionHeader but h1 + taller top gap. */
export function PageHero({
  eyebrow,
  title,
  accent,
  suffix,
  desc,
  children,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  suffix?: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="pt-20 sm:pt-24 pb-16 sm:pb-20">
      <Container className="text-center">
        <Eyebrow className="mb-5">{eyebrow}</Eyebrow>
        <SplitHeading
          text={title}
          accent={accent}
          suffix={suffix}
          className="font-display text-[30px] sm:text-[42px] font-semibold text-fg leading-[1.12] max-w-3xl mx-auto"
        />
        <Reveal delay={0.15}>
          <p className="mt-5 text-[15px] sm:text-base leading-7 text-muted max-w-2xl mx-auto">
            {desc}
          </p>
        </Reveal>
        {children && <div className="mt-10">{children}</div>}
      </Container>
    </section>
  );
}

/** One stat column for the proof band: mono figure + short label. */
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-mono text-[26px] font-semibold text-fg tabular-nums leading-none">
        {value}
      </div>
      <div className="mt-2 text-[13px] leading-5 text-muted">{label}</div>
    </div>
  );
}

/** Page shell for every marketing route: token background, selection,
    and a MotionConfig so all framer entrances degrade under
    prefers-reduced-motion (opacity-only) as the better-ui skill requires. */
export function LandingShell({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-bg text-fg flex flex-col selection:bg-accent selection:text-accent-fg">
        {children}
      </div>
    </MotionConfig>
  );
}
