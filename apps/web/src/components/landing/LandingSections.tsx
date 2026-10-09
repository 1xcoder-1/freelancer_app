"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import {
  Check,
  Copy,
  Plus,
  Search,
} from "@/components/animated-icons";
import {
  ChevronDown,
  Clock,
  Pause,
  Square,
  Users,
} from "lucide-react";
import {
  AppStatCard,
  AppVisualCard,
  AutomationsView,
  ClientsView,
  CommandPalette,
  ContractsView,
  Counter,
  DueTag,
  GoogleCalendarButton,
  GoogleCalendarPill,
  GroupHeading,
  PageTitle,
  PayLinkCard,
  PhoneApp,
  ProjectsView,
  RateTag,
  RosterCount,
  ScaledMock,
  SilenceTag,
  StatusTag,
  vipBadge,
} from "@/components/landing/app-mock";
import {
  Container,
  Eyebrow,
  MkButton,
  RadialGlow,
  Section,
  WindowFrame,
} from "@/components/landing/layout";
import { Rise } from "@/components/landing/motion";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Home-page sections — superset.sh grammar with Freelance Book
   content. Window mockups float on radial brand glows; lists cascade
   in from the left; big blocks rise 20px on first scroll into view.
------------------------------------------------------------------- */

/** One grid/flex cell of the trusted-by strip. */
function LogoCell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center whitespace-nowrap h-16 sm:h-18 w-full md:h-24 md:w-[168px] rounded-[2px] border border-fg/10 bg-fg/[0.03] opacity-90 transition-all duration-200 hover:opacity-100 hover:border-fg/20 hover:bg-fg/[0.05]">
      {children}
    </div>
  );
}

/* ========================= MOBILE SHOWCASE =========================
   Fan of three phones: sides tilted ±30° in perspective, center
   straight-on with a double-ring bezel. Composition, scale math and
   bezel recipes lifted from superset's #mobile section.
=================================================================== */

function SidePhone({
  side,
  x,
  children,
}: {
  side: "left" | "right";
  x: MotionValue<number>;
  children: React.ReactNode;
}) {
  const left = side === "left";
  return (
    <motion.div className="relative z-0 shrink-0" style={{ x }}>
      <div
        className="relative aspect-[9/19] w-[264px] rounded-[44px] border border-white/[0.025] bg-[linear-gradient(115deg,#090a0b_0%,#232529_22%,#0a0b0c_42%,#101113_76%,#282a2e_100%)] py-[5px] mt-3"
        style={{
          background:
            "radial-gradient(ellipse 12px 65% at " +
            (left ? "right 58%" : "left 32%") +
            ", #34373b 0%, #1c1e21 45%, transparent 100%), #090a0b",
          boxShadow:
            "2px 0 0 #141619, 5px 0 0 #0d0f10, 6px 0 0 #1a1d21, 7px 0 0 #111214, 0 30px 80px -20px rgba(0,0,0,0.8)",
          paddingRight: left ? 5 : 2,
          paddingLeft: left ? 2 : 5,
          transform: `perspective(1000px) rotateY(${left ? -30 : 30}deg) scale(0.88)`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-[44px] bottom-[44px] w-[7px]"
          style={{
            [left ? "right" : "left"]: -7,
            background:
              "linear-gradient(0deg, #111214 0%, #1a1d21 18%, #131518 38%, #0b0d0e 56%, #191b1f 78%, #111214 100%)",
          }}
        />
        <div className="relative flex h-full flex-col overflow-hidden bg-[#0b0b0b] text-white rounded-l-[42px] rounded-r-[39px]">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

/* Each phone shows the real dashboard at 390px: the sidebar collapses to its
   72px icon rail, and roster / timer / invoice modules stack single-column
   with the app's own cards, chips and mono timer. */

function LeftPhoneScreen() {
  return (
    <PhoneApp active="Clients" scale={0.655}>
      <div className="space-y-4">
        <PageTitle title="Clients" subtitle="Your roster, grouped by category." />
        <AppStatCard
          label="Total Clients"
          value="8"
          icon={Users}
          rows={[{ text: "3 VIP · 5 Standard", dot: "info" }]}
        />
        <div className="flex items-center gap-2 pt-1">
          <RosterCount>8 Total Clients</RosterCount>
          <span className="font-mono text-xs text-[#a19d98]">across 5 categories</span>
        </div>
        <GroupHeading>VIP &amp; Enterprise</GroupHeading>
        <div className="space-y-4">
          <AppVisualCard
            title="Acme Corp"
            subtitle="By Acme Corp"
            badge={vipBadge}
            tags={<RateTag>USD 5,000/hr</RateTag>}
          />
          <AppVisualCard
            title="Nova Studio"
            subtitle="By Nova Studio"
            badge={vipBadge}
            tags={
              <>
                <SilenceTag>47d silent</SilenceTag>
                <RateTag>USD 3,200/hr</RateTag>
              </>
            }
          />
        </div>
      </div>
    </PhoneApp>
  );
}

function CenterPhoneScreen() {
  return (
    <PhoneApp active="Time" scale={0.646}>
      <div className="space-y-4">
        <PageTitle
          title="Time"
          subtitle="Start the clock, stop it, and the hours are ready to bill."
        />

        <div className="space-y-3 rounded-xl border border-[#28282a] bg-[#161617] p-4 shadow-xl">
          <div>
            <label className="text-xs font-semibold text-[#a19d98]">Project</label>
            <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-[#28282a] bg-[#0e0e0f] px-3 py-2 text-sm text-[#f0efed]">
              <span className="min-w-0 truncate">Website redesign</span>
              <ChevronDown className="size-4 shrink-0 text-[#a19d98]" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#a19d98]">
              What are you doing?
            </label>
            <div className="mt-1 truncate rounded-lg border border-[#28282a] bg-[#0e0e0f] px-3 py-2 text-sm text-[#f0efed]">
              Homepage hero section
            </div>
          </div>
          <div className="pt-1">
            <span className="font-mono text-[26px] font-bold leading-none text-[#6ea8dc]">
              01:12:30
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#28282a] px-2.5 text-xs text-[#f0efed]">
              <Pause className="size-3.5" />
              Pause
            </span>
            <span className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#d46b28] px-2.5 text-xs font-semibold whitespace-nowrap text-white">
              <Square className="size-3.5" />
              Stop &amp; Save
            </span>
          </div>
          <p className="border-t border-[#28282a] pt-2 text-[11px] text-[#6f6b66]">
            Tracking <span className="font-medium text-[#f0efed]">Website redesign</span> •
            gets billed
          </p>
        </div>

        <div className="space-y-2.5">
          {[
            { d: "Focus Session", p: "Brand system", t: "Fri, Oct 9", s: "00:48:05" },
            { d: "Retainer sync", p: "Monthly retainer", t: "Thu, Oct 8", s: "01:05:00" },
          ].map((e) => (
            <div
              key={e.d}
              className="flex items-center justify-between rounded-xl border border-[#28282a] bg-[#161617] p-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="rounded-lg bg-[#6ea8dc]/10 p-2 text-[#6ea8dc]">
                  <Clock className="size-4" />
                </span>
                <div className="min-w-0">
                  <h4 className="truncate text-[13px] font-semibold text-[#f0efed]">{e.d}</h4>
                  <p className="truncate text-[11px] text-[#a19d98]">
                    {e.p} • {e.t}
                  </p>
                </div>
              </div>
              <span className="shrink-0 font-mono text-xs font-semibold text-[#6ea8dc]">
                {e.s}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PhoneApp>
  );
}

function RightPhoneScreen() {
  return (
    <PhoneApp active="Projects" scale={0.655}>
      <div className="space-y-4">
        <PageTitle title="Invoices" subtitle="Draft, send and chase payments." />

        <div className="flex flex-wrap items-center gap-2">
          <RosterCount>12 Total Invoices</RosterCount>
          <span className="font-mono text-xs text-[#a19d98]">across 4 categories</span>
        </div>

        <GroupHeading>Overdue Payments</GroupHeading>
        <div className="space-y-4">
          <AppVisualCard
            title="INV-023"
            subtitle="Client: Nova Studio"
            badge={<Counter value="$3,000" state="Overdue" />}
            tags={
              <>
                <StatusTag tone="overdue">Overdue</StatusTag>
                <DueTag>Due 09/28/2026</DueTag>
              </>
            }
          />
          <AppVisualCard
            title="INV-021"
            subtitle="Client: Orbit Press"
            badge={<Counter value="$640" state="Due" />}
            tags={<StatusTag tone="sent">Sent to Client</StatusTag>}
          />
        </div>

        <div className="space-y-4 pt-2">
          <GroupHeading>Paid &amp; Settled</GroupHeading>
          <AppVisualCard
            title="INV-024"
            subtitle="Client: Acme Corp"
            badge={<Counter value="$1,200" state="Paid" />}
            tags={<StatusTag tone="paid">★ Paid</StatusTag>}
          />
        </div>
      </div>
    </PhoneApp>
  );
}

export function PhoneShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  // Side phones slide from the fanned ±292px to together as the section
  // scrolls in — measured off superset.sh: linear over the section top
  // travelling from 90% to 25% of the viewport height (~0.5px per scroll px).
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.9", "start 0.25"],
  });
  const xLeft = useTransform(scrollYProgress, [0, 1], [292, 0]);
  const xRight = useTransform(scrollYProgress, [0, 1], [-292, 0]);

  return (
    <section
      ref={sectionRef}
      id="mobile"
      aria-labelledby="mobile-heading"
      className="scroll-mt-24 overflow-hidden pb-16 sm:pb-24"
    >
      <div className="mx-auto max-w-6xl px-6 text-center sm:px-8">
        <Rise>
          <svg
            stroke="currentColor"
            fill="currentColor"
            strokeWidth="0"
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="mx-auto mb-5 size-6 text-muted/40"
          >
            <path
              fillRule="evenodd"
              d="M12 2.25a.75.75 0 0 1 .75.75v16.19l6.22-6.22a.75.75 0 1 1 1.06 1.06l-7.5 7.5a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06l6.22 6.22V3a.75.75 0 0 1 .75-.75Z"
              clipRule="evenodd"
            />
          </svg>
          <h2 id="mobile-heading" className="text-2xl font-normal tracking-tight text-fg sm:text-3xl">
            Start work from anywhere
          </h2>
          <p className="mt-3 text-base text-muted sm:text-lg">
            Run your whole book from your phone.
          </p>
        </Rise>
        <div className="mt-12 sm:mt-20">
          <div
            aria-hidden
            className="@container pointer-events-none relative h-[396px] select-none text-left sm:h-[min(64.8cqw,648px)]"
          >
            <div className="absolute left-1/2 flex w-[880px] origin-top -translate-x-1/2 items-start justify-center gap-7 [transform:scale(0.648)] sm:[transform:scale(min(1.08,calc(90cqw/880px)))]">
              <SidePhone side="left" x={xLeft}>
                <LeftPhoneScreen />
              </SidePhone>
              <div
                className="relative z-10 shrink-0"
                style={{
                  boxShadow: "0 0 0 2px #090909, 0 0 0 3px #141517, 0 30px 80px -20px rgba(0,0,0,0.8)",
                  borderRadius: 44,
                }}
              >
                <div className="relative aspect-[9/19] w-[264px] rounded-[44px] border border-white/[0.025] bg-[linear-gradient(115deg,#090a0b_0%,#232529_22%,#0a0b0c_42%,#101113_76%,#282a2e_100%)] p-[5px]">
                  <div className="relative flex h-full flex-col overflow-hidden rounded-[40px] bg-[#0b0b0b] text-white">
                    <CenterPhoneScreen />
                  </div>
                </div>
              </div>
              <SidePhone side="right" x={xRight}>
                <RightPhoneScreen />
              </SidePhone>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================ LOGO GRID ============================
   Superset's trusted-by strip: square hairline cells, two desktop
   rows of seven, a wrapping grid on mobile. Fictional solo studios.
=================================================================== */

const logosRow1 = [
  <span key="1" className="font-mono text-[15px] text-fg/70">kowalski.dev</span>,
  <span key="2" className="font-display text-[17px] font-semibold text-fg/70">Farouk®</span>,
  <span key="3" className="font-mono text-[15px] text-fg/70">meyer.studio</span>,
  <span key="4" className="text-[13px] font-semibold tracking-[0.18em] text-fg/70">NAIR/BRAND</span>,
  <span key="5" className="font-display text-[16px] font-semibold text-fg/70">atlas.works</span>,
  <span key="6" className="text-[15px] italic text-fg/70">fern&amp;field</span>,
  <span key="7" className="text-[15px] font-bold tracking-[0.22em] text-fg/70">MESA</span>,
];

const logosRow2 = [
  <span key="1" className="text-[15px] font-medium text-fg/70">juniper labs</span>,
  <span key="2" className="font-mono text-[14px] text-fg/70">HARBOR/UI</span>,
  <span key="3" className="font-display text-[16px] text-fg/70">orbit press</span>,
  <span key="4" className="text-[15px] font-bold text-fg/70">cobalt.co</span>,
  <span key="5" className="text-[12px] font-semibold tracking-[0.28em] text-fg/70">DRIFTWOOD</span>,
  <span key="6" className="font-mono text-[15px] text-fg/70">lumen.codes</span>,
  <span key="7" className="font-display text-[15px] font-semibold text-fg/70">Canyon CMS</span>,
];

export function LogoGrid() {
  return (
    <section className="overflow-hidden py-16 sm:py-20">
      <Container>
        <Rise>
          <h2 className="mb-4 text-center text-base font-medium text-fg sm:mb-8 sm:text-xl">
            Powering independent businesses like
          </h2>
        </Rise>
        {/* Mobile: wrap into a compact grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5 md:hidden">
          {[...logosRow1, ...logosRow2].map((logo, i) => (
            <LogoCell key={i}>{logo}</LogoCell>
          ))}
        </div>
        {/* Desktop: two fixed rows of seven */}
        <div className="hidden md:block space-y-3.5">
          <div className="flex items-center justify-center gap-3.5">
            {logosRow1.map((logo, i) => (
              <LogoCell key={i}>{logo}</LogoCell>
            ))}
          </div>
          <div className="flex items-center justify-center gap-3.5">
            {logosRow2.map((logo, i) => (
              <LogoCell key={i}>{logo}</LogoCell>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ========================== FEATURE ROWS ==========================
   Alternating text/visual rows. Visuals are floating mac windows on
   a radial glow; inner list rows cascade in from the left.
=================================================================== */

export function FeatureRow({
  eyebrow,
  title,
  desc,
  points,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  points?: string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <div className={cn("space-y-6", reverse ? "lg:order-2" : "lg:order-1")}>
        <div className="space-y-4">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h3 className="text-2xl font-medium tracking-tight text-fg sm:text-3xl">{title}</h3>
        </div>
        <p className="max-w-[500px] text-base leading-relaxed text-muted sm:text-lg">{desc}</p>
        {points && points.length > 0 && (
          <div className="space-y-2.5 pt-1">
            {points.map((p) => (
              <div key={p} className="flex items-start gap-2.5 text-[13px] leading-5 text-fg/90">
                <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
                <span>{p}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={reverse ? "lg:order-1" : "lg:order-2"}>{visual}</div>
    </div>
  );
}

export function VisualShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full overflow-hidden min-h-[300px] lg:aspect-4/3 max-sm:[mask-image:linear-gradient(to_right,black_82%,transparent)]">
      <RadialGlow />
      <div className="relative z-10 flex h-full w-full items-center justify-center p-4 sm:p-6">
        <Rise className="flex w-full justify-center">{children}</Rise>
      </div>
    </div>
  );
}

/* Each row visual is a real dashboard screen, re-rendered with the app's
   own primitives (landing/app-mock.tsx) and scaled into the slot — no
   invented UI. */

export function VisualWindow({
  title,
  designWidth,
  designHeight,
  className,
  children,
}: {
  title: string;
  designWidth: number;
  designHeight: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <WindowFrame title={title} className={cn("w-full", className)}>
      <ScaledMock designWidth={designWidth} designHeight={designHeight}>
        <div className="space-y-6 bg-[#0e0e0f] p-6 text-[#f0efed]">{children}</div>
      </ScaledMock>
    </WindowFrame>
  );
}

/* Row 1 — Clients panel: stat cards, roster count, category groups. */

function CrmVisual() {
  return (
    <VisualShell>
      <VisualWindow title="clients" designWidth={760} designHeight={520} className="max-w-xl">
        <ClientsView compact />
      </VisualWindow>
    </VisualShell>
  );
}

/* Row 2 — Projects panel: tab strip, milestone fractions, budget chips. */

function ProjectsVisual() {
  return (
    <VisualShell>
      <VisualWindow
        title="projects"
        designWidth={820}
        designHeight={560}
        className="min-w-[420px] max-w-2xl"
      >
        <ProjectsView />
      </VisualWindow>
    </VisualShell>
  );
}

/* Row 3 — Settings → Automations panel. */

function AutomationsVisual() {
  return (
    <VisualShell>
      <VisualWindow
        title="settings / automations"
        designWidth={780}
        designHeight={540}
        className="max-w-xl"
      >
        <AutomationsView />
      </VisualWindow>
    </VisualShell>
  );
}

/* Row 4 — Contracts panel: signature state, version chips, expiry warnings. */

function ProposalsVisual() {
  return (
    <VisualShell>
      <VisualWindow
        title="contracts"
        designWidth={820}
        designHeight={540}
        className="min-w-[420px] max-w-2xl"
      >
        <ContractsView />
      </VisualWindow>
    </VisualShell>
  );
}

/* Row 5 — the real Ctrl+K command menu (components/common/CommandMenu.tsx). */

function QuickCaptureVisual() {
  return (
    <VisualShell>
      <WindowFrame title="the dashboard behind the palette" className="w-full max-w-lg">
        <div className="relative bg-[#0e0e0f] px-6 py-10">
          <div className="mb-6 flex justify-end">
            <span className="inline-flex w-64 items-center justify-between gap-3 rounded-xl border border-dashed border-[#38383b] bg-[#1d1d1f] px-3.5 py-2 text-xs text-[#a19d98] shadow-xs">
              <span className="flex items-center gap-2">
                <Search className="size-3.5 text-[#d46b28]" />
                Search anything...
              </span>
              <span className="rounded border border-[#28282a] bg-[#161617] px-1.5 py-0.5 font-mono text-[10px]">
                Ctrl K
              </span>
            </span>
          </div>
          <div className="bg-black/50">
            <CommandPalette />
          </div>
        </div>
      </WindowFrame>
    </VisualShell>
  );
}

/* Row 6 — the two connections the product really has: Google Calendar on
   the dashboard calendar, and the public payment link clients open. */

function IntegrationsVisual() {
  return (
    <VisualShell>
      <WindowFrame title="calendar / pay link" className="w-full max-w-md">
        <div className="space-y-5 bg-[#0e0e0f] p-6">
          <div className="flex items-center justify-between gap-3 border-b border-dashed border-[#28282a] pb-4">
            <h3 className="text-sm font-medium tracking-wide text-[#f0efed]">Calendar</h3>
            <GoogleCalendarPill email="alex@gmail.com" synced="09:12" />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#28282a] bg-[#161617] px-4 py-3">
            <span className="text-xs text-[#a19d98]">On another device?</span>
            <GoogleCalendarButton />
          </div>
          <PayLinkCard />
        </div>
      </WindowFrame>
    </VisualShell>
  );
}

export function FeatureRows() {
  return (
    <Section id="features" className="scroll-mt-24">
      <Container>
        <div className="space-y-24 sm:space-y-32">
          <FeatureRow
            eyebrow="Client CRM"
            title="Every client. One book."
            desc="Clients, their projects, files and history live together. Intake forms do the typing, and every invoice, call and proposal stays attached to the right relationship."
            visual={<CrmVisual />}
          />
          <FeatureRow
            reverse
            eyebrow="Parallel Projects"
            title="Run every project in parallel"
            desc="Kanban, milestones and a focus timer that keeps every billable minute accounted for. Status at a glance shows what's moving, what's blocked, and what's ready to send."
            visual={<ProjectsVisual />}
          />
          <FeatureRow
            eyebrow="Automations"
            title="Put recurring work in the background"
            desc="Payment reminders and meeting reminders email themselves on a schedule you set, and overdue invoices get flagged every day — so chasing money stops being your job."
            visual={<AutomationsVisual />}
          />
          <FeatureRow
            reverse
            eyebrow="Contracts & proposals"
            title="Every version, every signature, tracked"
            desc="Draft a proposal, turn it into a contract, and watch the status change on the card: Sent, Viewed by Client, ★ Executed. Each revision keeps its version number, and every link carries its own expiry."
            visual={<ProposalsVisual />}
          />
          <FeatureRow
            eyebrow="Command menu"
            title="Jump anywhere with Ctrl+K"
            desc="One keystroke opens the palette over the dashboard. Type a section name and you are there — clients, time, projects, invoices, settings — without hunting through the sidebar."
            visual={<QuickCaptureVisual />}
          />
          <FeatureRow
            reverse
            eyebrow="Connections"
            title="Plays well with your tools"
            desc="Connect Google Calendar and your bookings appear beside your billable hours. Every invoice carries a public pay link, so a client can settle up from any device without an account."
            visual={<IntegrationsVisual />}
          />
        </div>
      </Container>
    </Section>
  );
}

/* ========================== TESTIMONIALS ==========================
   Masonry columns of quiet cards — avatar, name, role, quote.
   Extra cards reveal on mobile behind a "Show all" button.
=================================================================== */

const testimonials = [
  {
    name: "Maya Farouk",
    role: "Product designer, Cairo",
    text: "I stopped losing invoices in email threads. Time → invoice in one click pays me a week earlier every month.",
  },
  {
    name: "Dan Kowalski",
    role: "Full-stack contractor, Kraków",
    text: "The client book remembers everything I forget. Intake forms alone saved the first hour of every project.",
  },
  {
    name: "Lukas Meyer",
    role: "Agency of one, Berlin",
    text: "It feels like Notion met an accountant. Slim, fast, and nothing glows at me for no reason.",
  },
  {
    name: "Priya Nair",
    role: "Brand strategist, Bengaluru",
    text: "Book AI drafts proposals that sound like me — and my win rate went from 40% to 65% in a quarter.",
  },
  {
    name: "Tomás Rivera",
    role: "Motion designer, Mexico City",
    text: "Pomodoro and time entries in one place. I finally know my real hourly rate — and I raised it.",
  },
  {
    name: "Amelie Fontaine",
    role: "Illustrator, Lyon",
    text: "Sent my first invoice in under a minute. My client paid the same day.",
  },
  {
    name: "Jonas Weber",
    role: "Dev contractor, Vienna",
    text: "Replaced Toggl, Notion and FreshBooks. One subscription less, zero tabs lost.",
  },
  {
    name: "Sara Haddad",
    role: "Copywriter, Dubai",
    text: "The Report Card showed I was undercharging by 30%. New rates went out the same week.",
  },
  {
    name: "Nina Petrova",
    role: "Photographer, Sofia",
    text: "Share links with view logs — clients approve contracts without a single email thread.",
  },
];

export function Testimonials() {
  const [showAll, setShowAll] = useState(false);

  return (
    <Section id="reviews">
      <Container>
        <Rise className="max-w-2xl mb-12 sm:mb-16">
          <h2 className="text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl lg:text-5xl">
            What freelancers say about the book
          </h2>
        </Rise>
        <div className="columns-1 gap-4 md:columns-2 lg:columns-3">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className={cn(
                "mb-4 break-inside-avoid p-4 bg-card border border-line hover:border-muted/50 transition-colors",
                i >= 5 && !showAll && "hidden md:block"
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface font-mono text-[12px] font-semibold text-fg/80">
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-fg">{t.name}</span>
                  </div>
                  <span className="text-sm text-muted">{t.role}</span>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-fg/90">
                {t.text}
              </p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 w-full border border-line bg-card px-4 py-3 text-sm font-medium text-fg transition-colors hover:border-muted/50 md:hidden"
        >
          Show all {testimonials.length}
        </button>
      </Container>
    </Section>
  );
}

/* ============================ SECURITY ============================ */

function TrustBadge({ className }: { className?: string }) {
  return (
    <svg
      width="128"
      height="128"
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-label="GDPR ready — data exported and encrypted"
      className={className}
    >
      <title>GDPR ready — full export, encrypted</title>
      <circle cx="60" cy="60" r="58.5" stroke="currentColor" strokeOpacity="0.25" />
      <circle cx="60" cy="60" r="41.5" stroke="currentColor" strokeOpacity="0.25" />
      <defs>
        <path id="fb-badge-top" d="M 10,60 A 50,50 0 0 1 110,60" />
        <path id="fb-badge-bottom" d="M 4,60 A 56,56 0 0 0 116,60" />
      </defs>
      <text textAnchor="middle" fontSize="6.5" letterSpacing="1.1" fill="currentColor" fillOpacity="0.7" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
        <textPath href="#fb-badge-top" startOffset="50%">
          ENCRYPTED IN TRANSIT
        </textPath>
      </text>
      <text textAnchor="middle" fontSize="6.5" letterSpacing="1.1" fill="currentColor" fillOpacity="0.7" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
        <textPath href="#fb-badge-bottom" startOffset="50%">
          FULL DATA EXPORT
        </textPath>
      </text>
      <circle cx="10" cy="60" r="1" fill="currentColor" fillOpacity="0.5" />
      <circle cx="110" cy="60" r="1" fill="currentColor" fillOpacity="0.5" />
      <circle cx="60" cy="44" r="2.5" fill="var(--brand)" />
      <text x="60" y="66" textAnchor="middle" fontSize="17" fontWeight="500" fill="currentColor" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
        GDPR
      </text>
      <text x="60" y="80" textAnchor="middle" fontSize="7" letterSpacing="2" fill="currentColor" fillOpacity="0.7" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
        READY
      </text>
    </svg>
  );
}

const securityCards = [
  {
    title: "Your data, your property",
    desc: "Full JSON/CSV export at any time. No vendor lock-in — leave whenever you want with every client, invoice and minute intact.",
    glyph: "↑↓",
  },
  {
    title: "Tokenized sharing",
    desc: "Invoices, contracts and quotes go out as revocable share links with access logs. Kill a link in one click when the job is done.",
    glyph: "⌘",
  },
  {
    title: "Encrypted everywhere",
    desc: "TLS in transit, encryption at rest, Clerk-issued JWTs and per-workspace scoping on every single query.",
    glyph: "≠",
  },
];

export function SecuritySection() {
  return (
    <Section id="security" className="scroll-mt-24">
      <Container>
        <Rise className="mb-16 flex items-start justify-between gap-8">
          <div className="space-y-4">
            <Eyebrow>Security</Eyebrow>
            <h2 className="text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl lg:text-5xl">
              Private by default.
              <br />
              You&apos;re in control.
            </h2>
            <p className="max-w-[700px] text-base font-light text-muted sm:text-lg">
              Your client data stays yours — exportable, revocable and encrypted, with explicit control over every share link.
            </p>
          </div>
          <TrustBadge className="hidden shrink-0 text-muted transition-colors hover:text-fg sm:block" />
        </Rise>
        <Rise>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {securityCards.map((c) => (
              <div key={c.title} className="relative rounded-[2px] border border-fg/10 bg-fg/[0.03] p-6">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-[2px] border border-line bg-surface font-mono text-fg/70">
                  {c.glyph}
                </div>
                <h3 className="mb-2 text-lg font-medium text-fg/90">{c.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{c.desc}</p>
              </div>
            ))}
          </div>
        </Rise>
      </Container>
    </Section>
  );
}

/* ============================== FAQ ===============================
   Native <details name> exclusive accordion — sticky heading on the
   left on xl screens, exactly like superset.
=================================================================== */

const faqs = [
  {
    q: "How is Freelance Book different from juggling six tools?",
    a: "Trello, Toggl, FreshBooks and Notion never talk to each other — you pay six times and re-type everything. Here the client opens into their projects, time flows into invoices, and proposals become contracts without a single copy-paste.",
    link: { href: "/features", label: "See all the modules" },
  },
  {
    q: "Is it actually free?",
    a: "Yes — the core operating system (clients, projects, time, invoices) is free forever. Book AI credits and multi-seat agency features are the only paid extras.",
  },
  {
    q: "Can I send invoices to real clients?",
    a: "Absolutely. Create an invoice, share a public pay page, accept Stripe or manual payment, and track paid / overdue status automatically.",
  },
  {
    q: "How is my data protected?",
    a: "Everything is scoped to your workspace behind JWT auth, stored in PostgreSQL, and shared links are tokenized and revocable at any time. Full export keeps you the owner of your data.",
    link: { href: "/#security", label: "Read the security details" },
  },
  {
    q: "Does time tracking run in the background?",
    a: "The web timer lives in your dashboard, and the desktop companion adds a global Ctrl+Shift+F quick-capture so you never lose the \u201cwhat was I working on\u201d moment.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes — the Android companion syncs clients, timers and invoices with offline support and push reminders, so the book travels with you.",
  },
  {
    q: "Can I import my existing clients?",
    a: "CSV and JSON import walk you in, and a Notion importer maps your client database automatically. And because export is always one click away, moving out stays just as easy.",
  },
  {
    q: "What is the Report Card?",
    a: "A personal scorecard of your business: on-time delivery, payment reliability, effective hourly rate and streaks — the numbers most freelancers guess at.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. Sign up free and create your first client in about 90 seconds — no card, no trial clock, no surprises.",
  },
];

export function FaqSection() {
  return (
    <Section id="faq" className="scroll-mt-24">
      <Container>
        <div className="grid grid-cols-1 gap-12 xl:grid-cols-[1fr_1.5fr] xl:gap-20">
          <div className="xl:sticky xl:top-24 xl:self-start">
            <h2 className="text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl lg:text-5xl">
              Frequently
              <br />
              asked questions
            </h2>
          </div>
          <div className="w-full">
            {faqs.map((f) => (
              <details key={f.q} name="home-faq" className="group border-b border-line">
                <summary className="flex w-full cursor-pointer list-none items-center justify-between py-6 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                  <span className="pr-4 text-base font-medium text-fg sm:text-lg">{f.q}</span>
                  <Plus className="size-5 shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none group-open:rotate-45" />
                </summary>
                <div className="space-y-3 pb-6 pr-12 text-base leading-relaxed text-muted">
                  <p>{f.a}</p>
                  {f.link && (
                    <Link
                      className="inline-block text-brand transition-colors hover:text-brand-light"
                      href={f.link.href}
                    >
                      {f.link.label} →
                    </Link>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}

/* ============================ CTA BAND ============================
   Centered headline, primary CTA with sliding arrow, and a tabbed
   terminal box with copy-to-clipboard — superset's closer.
=================================================================== */

const installTabs = [
  { id: "npm", cmd: "npx freelance-book init" },
  { id: "desktop", cmd: "winget install FreelanceBook.QuickCapture" },
  { id: "curl", cmd: "curl -fsSL https://freelance-book.app/install.sh | sh" },
];

export function CtaSection() {
  const [tab, setTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(installTabs[tab].cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  return (
    <Section>
      <Container className="flex flex-col items-center text-center">
        <Rise className="flex flex-col items-center">
          <h2 className="mb-8 text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl lg:text-5xl">
            Bring your whole business
            <br />
            into one book.
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            <Link href="/sign-up">
              <MkButton type="button">
                <span className="hidden sm:inline">Start for free</span>
                <span className="sm:hidden">Start</span>
                <span className="relative size-4 overflow-hidden">
                  <svg
                    stroke="currentColor"
                    fill="currentColor"
                    strokeWidth="0"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    className="size-4 transition-transform duration-300 ease-out group-hover:translate-y-full"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a.75.75 0 0 1-.75-.75V4.66L4.8 9.11a.75.75 0 0 1-1.06-1.06l6.25-6.25a.75.75 0 0 1 1.06 0l6.25 6.25a.75.75 0 1 1-1.06 1.06L10.75 4.66v12.59A.75.75 0 0 1 10 18Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <svg
                    stroke="currentColor"
                    fill="currentColor"
                    strokeWidth="0"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    className="absolute inset-0 size-4 -translate-y-full transition-transform duration-300 ease-out group-hover:translate-y-0"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a.75.75 0 0 1-.75-.75V4.66L4.8 9.11a.75.75 0 0 1-1.06-1.06l6.25-6.25a.75.75 0 0 1 1.06 0l6.25 6.25a.75.75 0 1 1-1.06 1.06L10.75 4.66v12.59A.75.75 0 0 1 10 18Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </MkButton>
            </Link>
            <Link href="/dashboard">
              <MkButton variant="outline" type="button">
                Live demo
              </MkButton>
            </Link>
          </div>
          <p className="mt-10 mb-4 text-sm text-muted">
            Or set up your workspace from the terminal:
          </p>
          <div className="w-full max-w-xl rounded-[2px] border border-line bg-fg/[0.03] text-left">
            <div className="flex items-center justify-between border-b border-line px-2">
              <div className="flex items-center">
                {installTabs.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(i)}
                    className={cn(
                      "px-3 py-2 font-mono text-xs transition-colors",
                      i === tab
                        ? "-mb-px border-b border-brand text-fg"
                        : "text-muted hover:text-fg"
                    )}
                  >
                    {t.id}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={copy}
                aria-label="Copy to clipboard"
                className="p-2 text-muted transition-colors hover:text-fg"
              >
                {copied ? (
                  <Check className="size-3.5 text-emerald-400" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
            <div className="flex items-start gap-2 overflow-x-auto px-4 py-3.5 font-mono text-sm">
              <span className="select-none text-muted">$</span>
              <code className="whitespace-nowrap text-fg">{installTabs[tab].cmd}</code>
            </div>
          </div>
        </Rise>
      </Container>
    </Section>
  );
}
