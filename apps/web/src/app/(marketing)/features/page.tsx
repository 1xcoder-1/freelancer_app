"use client";

import { Fragment, type ElementType, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Check,
  Clock,
  Command,
  FileText,
  FolderLock,
  Kanban,
  Receipt,
  Sparkles,
  Users,
} from "@/components/animated-icons";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  CommandMenuVisual,
  FeatureRow,
  VisualShell,
  VisualWindow,
} from "@/components/landing/sections/feature-rows";
import {
  AppSidebar,
  AppTopbar,
  AutomationsView,
  ClientsView,
  ContractsView,
  HomeView,
  MoneyView,
  ProjectsView,
  ScaledMock,
  T,
  TimeView,
} from "@/components/landing/app";
import {
  Container,
  Eyebrow,
  LandingShell,
  MkButton,
  PageHero,
  RadialGlow,
  Section,
  WindowFrame,
} from "@/components/landing/layout";
import { Rise, Stagger, StaggerItem } from "@/components/landing/motion";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Features page: the whole book, module by module, in the same
   superset grammar as the home page: a hero-grade dashboard window
   under the page hero, a six-tabs problem band, the flagship feature
   rows, an hours-to-paid pipeline, Book AI, automations, contracts,
   booking, and the full module matrix.
------------------------------------------------------------------- */

/* ============================ TYPES =============================== */

type RowDef = {
  id: string;
  eyebrow: string;
  title: string;
  desc: string;
  points: string[];
  visual: ReactNode;
  reverse?: boolean;
};

type ModuleDef = {
  icon: ElementType;
  group: string;
  title: string;
  desc: string;
  metric: string;
  href: string;
};

type FlowStep = { n: string; title: string; sub: string; tag: string };

/* ========================= HERO VISUAL ============================
   The real dashboard home screen at 1280x800 (sidebar + topbar +
   HomeView), the same composition the landing hero uses: wide
   WindowFrame on a brand glow, slight .mk-tilt, bottom mask fade.
=================================================================== */

function HeroAppWindow() {
  return (
    <div className="flex h-full" style={{ background: T.bg }}>
      <AppSidebar active="Home" />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <div className="relative min-h-0 flex-1 overflow-hidden px-8 py-6">
          <HomeView />
        </div>
      </div>
    </div>
  );
}

function HeroDashboard() {
  return (
    <div className="relative mx-auto w-full max-w-6xl">
      <RadialGlow />
      <Rise className="relative z-10 w-full [perspective:2800px]">
        <div
          className="mk-tilt w-full"
          style={{
            transformOrigin: "50% 42%",
            maskImage: "linear-gradient(to bottom, black 78%, transparent 99%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 78%, transparent 99%)",
          }}
        >
          <WindowFrame title="freelance book / home" className="w-full">
            <ScaledMock designWidth={1280} designHeight={800}>
              <HeroAppWindow />
            </ScaledMock>
          </WindowFrame>
        </div>
      </Rise>
    </div>
  );
}

/* ========================= SIX TABS BAND ==========================
   Problem/solution band in the home WhyBand's register: quiet mono
   list of the tools most freelancers juggle on the left, the same
   list restated as solved on the right, one Check per row.
=================================================================== */

const shuffleTabs = [
  { n: "01", text: "Email, for clients and their history" },
  { n: "02", text: "A spreadsheet, for invoices" },
  { n: "03", text: "A timer app, for billable hours" },
  { n: "04", text: "A notes app, for project details" },
  { n: "05", text: "An e-sign tool, for contracts" },
  { n: "06", text: "A calendar, for calls" },
];

const closedTabs = [
  { n: "01", text: "Clients live in the book, with every project, file and call attached." },
  { n: "02", text: "Invoices are drafted straight from tracked time." },
  { n: "03", text: "Hours sit in one timer that never drops an entry." },
  { n: "04", text: "Proposals and contracts go out as signature links." },
  { n: "05", text: "Calls are booked on a page the client fills in." },
  { n: "06", text: "The numbers agree, because they share one source." },
];

function SixTabsBand() {
  return (
    <section className="relative overflow-hidden border-y border-line/60 py-20 sm:py-28">
      <Container>
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-20">
          <Stagger>
            <StaggerItem>
              <h2 className="text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl">
                Running alone usually means six tabs.
              </h2>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
                The work is not the problem. The bookkeeping around it lives
                in six places, and none of them agree on the numbers.
              </p>
            </StaggerItem>
            <StaggerItem>
              <div className="mt-8 space-y-3 border-l border-line/60 pl-5">
                {shuffleTabs.map((s) => (
                  <div key={s.n} className="flex items-baseline gap-4">
                    <span className="font-mono text-xs text-muted/50">{s.n}</span>
                    <span className="text-sm text-muted">{s.text}</span>
                  </div>
                ))}
              </div>
            </StaggerItem>
          </Stagger>
          <Stagger>
            <StaggerItem>
              <h2 className="text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl">
                One book closes all of them.
              </h2>
            </StaggerItem>
            <StaggerItem>
              <div className="mt-8 divide-y divide-line/40 border-y border-line/40">
                {closedTabs.map((s) => (
                  <div key={s.n} className="flex items-start gap-3.5 py-3.5">
                    <span className="pt-0.5 font-mono text-xs text-muted/50">{s.n}</span>
                    <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
                    <span className="text-sm leading-5 text-fg/90">{s.text}</span>
                  </div>
                ))}
              </div>
            </StaggerItem>
          </Stagger>
        </div>
      </Container>
    </section>
  );
}

/* ====================== FLAGSHIP ROW VISUALS ======================
   Every visual is the real dashboard screen for that module,
   re-rendered from landing/app and scaled into its slot.
=================================================================== */

function CrmVisual() {
  return (
    <VisualShell>
      <VisualWindow title="clients" designWidth={760} designHeight={520} className="max-w-xl">
        <ClientsView compact />
      </VisualWindow>
    </VisualShell>
  );
}

function ProjectsVisual() {
  return (
    <VisualShell flip>
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

function TimeVisual() {
  return (
    <VisualShell>
      <VisualWindow
        title="time-tracker"
        designWidth={860}
        designHeight={430}
        className="min-w-[420px] max-w-2xl"
      >
        <TimeView />
      </VisualWindow>
    </VisualShell>
  );
}

function FinanceVisual() {
  return (
    <VisualShell flip>
      <VisualWindow
        title="invoices"
        designWidth={820}
        designHeight={540}
        className="min-w-[420px] max-w-2xl"
      >
        <MoneyView />
      </VisualWindow>
    </VisualShell>
  );
}

function PaletteVisual() {
  return <CommandMenuVisual />;
}

const rows: RowDef[] = [
  {
    id: "crm",
    eyebrow: "Client CRM",
    title: "Every client, one page.",
    desc: "The roster is the front of the book. Clients sit in the groups you actually use, and every card shows the rate, the last touch and the work underneath it. No inbox archaeology.",
    points: [
      "VIP and Standard badges on every card",
      "Silence warnings like 47d silent, right on the card",
      "Intake forms and leads land in the same roster",
    ],
    visual: <CrmVisual />,
  },
  {
    id: "projects",
    eyebrow: "Project engine",
    title: "Every job, its budget, its unbilled hours.",
    desc: "Each project card answers three questions at a glance: how far along, how much is left in the budget, and how much work is finished but not billed. Slipping jobs say so out loud.",
    points: [
      "Milestones as fractions: 3/5 done",
      "Deadline risk on the card face: 6d left, 2d overdue",
      "12h unbilled rolls into a draft invoice in one click",
    ],
    visual: <ProjectsVisual />,
    reverse: true,
  },
  {
    id: "time",
    eyebrow: "Time & focus",
    title: "Start the clock. It keeps counting.",
    desc: "Pick a project, say what you are doing, start the timer. Close the tab, switch devices, come back tomorrow: the entry is still running, down to the second, and already marked billable.",
    points: [
      "Survives refreshes, closed tabs and restarts",
      "Entries grouped by project and day",
      "Tracked time turns into invoice lines",
    ],
    visual: <TimeVisual />,
  },
  {
    id: "finance",
    eyebrow: "Finance & profit",
    title: "Every invoice, from draft to Paid.",
    desc: "Invoices group by what needs you: overdue first, paid below. Every invoice carries a public pay link, so a client can settle from their phone and the status flips to Paid on its own.",
    points: [
      "Draft, Sent, Paid, Overdue on one board",
      "A public pay link on every invoice",
      "Expenses next to income, so profit is a real number",
    ],
    visual: <FinanceVisual />,
    reverse: true,
  },
  {
    id: "palette",
    eyebrow: "Command menu",
    title: "Ctrl+K opens the whole book.",
    desc: "The palette indexes every section: clients, time, projects, invoices, settings. Type two letters, press Enter, and you are there. ESC puts you back where you were.",
    points: [
      "Every section, one keystroke away",
      "Search from the top bar, no mouse needed",
      "Works over any page in the dashboard",
    ],
    visual: <PaletteVisual />,
  },
];

/* ====================== FROM HOURS TO PAID ========================
   Diagram moment: the whole money pipeline as four mono-numbered
   steps joined by hairline arrows. Stacks vertically on mobile.
=================================================================== */

const flowSteps: FlowStep[] = [
  { n: "01", title: "Track", sub: "Start the clock on a project", tag: "live timer" },
  { n: "02", title: "Invoice", sub: "The hours become a draft invoice", tag: "1 click" },
  { n: "03", title: "Share pay link", sub: "The client opens a public page", tag: "no login" },
  { n: "04", title: "Paid", sub: "Status flips, cash flow updates", tag: "automatic" },
];

function FlowStrip() {
  return (
    <Section className="overflow-hidden py-20 sm:py-24">
      <Container className="relative">
        <RadialGlow />
        <div className="relative z-10">
          <Stagger className="max-w-2xl">
            <StaggerItem>
              <Eyebrow>From hours to paid</Eyebrow>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-4 text-base text-muted sm:text-lg">
                The whole pipeline lives in one book. This is the entire
                distance between a minute worked and money in the bank.
              </p>
            </StaggerItem>
          </Stagger>
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] sm:items-stretch">
            {flowSteps.map((s, i) => (
              <Fragment key={s.n}>
                <Rise delay={i * 0.07} className="h-full">
                  <div
                    className={cn(
                      "h-full rounded-[2px] border p-5 transition-colors",
                      i === flowSteps.length - 1
                        ? "border-brand/30 bg-brand/[0.06] hover:border-brand/50"
                        : "border-line bg-card hover:border-fg/20"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs text-muted/60">{s.n}</span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-brand-light">
                        {s.tag}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-medium tracking-tight text-fg">
                      {s.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-5 text-muted">{s.sub}</p>
                  </div>
                </Rise>
                {i < flowSteps.length - 1 && (
                  <div
                    aria-hidden
                    className="flex items-center justify-center font-mono text-lg text-brand"
                  >
                    <span className="rotate-90 sm:rotate-0">→</span>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}

/* =========================== BOOK AI ==============================
   CSS-only chat mock in the app's own palette: user bubble right,
   AI bubble left with a mini proposal draft card inside, Generate
   chip, and an input row. Pure divs, no screenshots.
=================================================================== */

function AiVisual() {
  return (
    <VisualShell>
      <WindowFrame title="book ai" className="w-full">
        <div className="space-y-4 bg-[#0e0e0f] p-5 text-[#f0efed] sm:p-6">
          <div className="flex justify-end">
            <div className="max-w-[85%]">
              <span className="mb-1.5 block text-right font-mono text-[10px] uppercase tracking-[0.18em] text-[#6f6b66]">
                you
              </span>
              <p className="rounded-xl border border-[#38383b] bg-[#1d1d1f] px-4 py-2.5 text-sm leading-6">
                Draft a proposal for the Nova Studio brand refresh. Budget
                around $3,200.
              </p>
            </div>
          </div>

          <div className="flex justify-start">
            <div className="w-[94%]">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-[#d46b28]">
                book ai
              </span>
              <div className="space-y-3 rounded-xl border border-[#28282a] bg-[#161617] p-4">
                <p className="text-sm leading-6">
                  Here is a first draft. It uses their rate and the scope from
                  the last project.
                </p>
                <div className="rounded-lg border border-[#28282a] bg-[#0e0e0f] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#a19d98]">
                      proposal draft
                    </span>
                    <span className="rounded border border-[#28282a] bg-[#161617] px-1.5 py-0.5 font-mono text-[10px] text-[#a19d98]">
                      v1
                    </span>
                  </div>
                  <p className="mt-2.5 text-[13px] font-semibold">
                    Brand refresh · Nova Studio
                  </p>
                  <ul className="mt-2 space-y-1 text-[12px] leading-5 text-[#a19d98]">
                    <li>Scope: logo system, palette, social kit</li>
                    <li>Timeline: 3 weeks, two revision rounds</li>
                    <li>Fee: $3,200 · 40% due upfront</li>
                  </ul>
                  <div className="mt-3 flex items-center justify-between border-t border-[#28282a] pt-3">
                    <span className="font-mono text-[10px] text-[#6f6b66]">
                      ready to send
                    </span>
                    <span className="rounded-lg bg-[#d46b28] px-2.5 py-1 text-[11px] font-semibold text-white">
                      Generate
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-[#28282a] bg-[#161617] px-3.5 py-2.5">
            <Sparkles className="size-3.5 shrink-0 text-[#d46b28]" />
            <span className="min-w-0 flex-1 truncate text-xs text-[#6f6b66]">
              Ask the book anything
            </span>
            <span className="shrink-0 rounded border border-[#28282a] bg-[#1d1d1f] px-1.5 py-0.5 font-mono text-[10px] text-[#a19d98]">
              ↵
            </span>
          </div>
        </div>
      </WindowFrame>
    </VisualShell>
  );
}

/* ==================== AUTOMATIONS & CONTRACTS ===================== */

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

function ContractsVisual() {
  return (
    <VisualShell flip>
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

/* ============================ BOOKING =============================
   No booking screen exists in the mock set, so this visual is built
   CSS-only in the app palette: mono page header, selectable day and
   time chips with one picked in brand, and a confirm row.
=================================================================== */

const bookingDays = [
  { d: "Mon", n: "13" },
  { d: "Tue", n: "14" },
  { d: "Wed", n: "15" },
];

const bookingTimes = ["09:00", "10:30", "13:00"];

function BookingVisual() {
  return (
    <VisualShell flip>
      <WindowFrame title="freelancebook.app/book/alex" className="w-full max-w-md">
        <div className="bg-[#0e0e0f] p-6 text-[#f0efed]">
          <div className="flex items-center justify-between gap-3 border-b border-dashed border-[#28282a] pb-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#a19d98]">
                alex / booking
              </p>
              <p className="mt-1.5 text-sm font-semibold">Intro call · 30 minutes</p>
            </div>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#28282a] bg-[#161617] font-mono text-xs font-bold">
              A
            </span>
          </div>

          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#a19d98]">
            Pick a day
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {bookingDays.map((day) => (
              <span
                key={day.d}
                className={cn(
                  "flex flex-col items-center rounded-xl border py-2.5 transition-colors",
                  day.d === "Tue"
                    ? "border-[#d46b28] bg-[#d46b28] text-white"
                    : "border-[#28282a] bg-[#161617] text-[#a19d98] hover:border-[#38383b]"
                )}
              >
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-widest",
                    day.d === "Tue" ? "text-white/70" : "text-[#6f6b66]"
                  )}
                >
                  {day.d}
                </span>
                <span className="mt-0.5 text-sm font-semibold">{day.n}</span>
              </span>
            ))}
          </div>

          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[#a19d98]">
            Pick a time · 30 min
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {bookingTimes.map((t) => (
              <span
                key={t}
                className={cn(
                  "flex items-center justify-center rounded-xl border py-2 font-mono text-xs font-semibold transition-colors",
                  t === "10:30"
                    ? "border-[#d46b28] bg-[#d46b28] text-white"
                    : "border-[#28282a] bg-[#161617] text-[#a19d98] hover:border-[#38383b]"
                )}
              >
                {t}
              </span>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-[#28282a] bg-[#161617] px-4 py-3">
            <span className="min-w-0 truncate text-xs text-[#a19d98]">
              Tue 14 · 10:30 · your time zone
            </span>
            <span className="shrink-0 rounded-lg bg-[#d46b28] px-3 py-1.5 text-xs font-semibold text-white">
              Confirm booking
            </span>
          </div>
        </div>
      </WindowFrame>
    </VisualShell>
  );
}

/* ========================= MODULE MATRIX ==========================
   The full 9-card grid: hairline rounded-[2px] cards, icon tile,
   mono group label, metric on the right. Each card links to its
   section anchor above.
=================================================================== */

const modules: ModuleDef[] = [
  {
    icon: Users,
    group: "CRM & Pipeline",
    title: "Client roster, grouped the way you work",
    desc: "Clients, projects, invoices and notes in one book, with VIP and silence signals on every card.",
    metric: "5 roster groups",
    href: "#crm",
  },
  {
    icon: Kanban,
    group: "Project engine",
    title: "Milestones, budgets and unbilled hours",
    desc: "Every project card shows its milestone fraction, budget, deadline risk and the hours not yet invoiced.",
    metric: "7 live projects",
    href: "#projects",
  },
  {
    icon: Clock,
    group: "Time & focus",
    title: "One-click time tracking that survives a refresh",
    desc: "Start the clock on a project, close the tab, come back: it kept counting, and the entry is billable.",
    metric: "Keeps counting",
    href: "#time",
  },
  {
    icon: FileText,
    group: "Finance & profit",
    title: "Invoices, expenses and cash flow",
    desc: "Draft to Paid with a public pay link on every invoice, plus expenses and a cash-flow view.",
    metric: "4 invoice states",
    href: "#finance",
  },
  {
    icon: Command,
    group: "Command menu",
    title: "Ctrl+K to any section",
    desc: "The palette indexes Home, Clients, Leads, Time, Projects, Invoices, Money, Proposals, Booking and Settings.",
    metric: "13 destinations",
    href: "#palette",
  },
  {
    icon: Sparkles,
    group: "Book AI",
    title: "A copilot that has read the book",
    desc: "Drafts proposals from your rates, answers money questions with live numbers, and sends a Monday digest.",
    metric: "Drafts & answers",
    href: "#ai",
  },
  {
    icon: Receipt,
    group: "Automations",
    title: "Payment and meeting reminders, sent for you",
    desc: "Late invoices are checked daily, nudges go out on your grace period, and clients get a note 24h before a call.",
    metric: "Runs daily",
    href: "#automations",
  },
  {
    icon: FolderLock,
    group: "Contracts",
    title: "E-sign links with a version trail",
    desc: "Send a public signature link, watch it move to Viewed by Client and Executed, and keep each revision numbered.",
    metric: "v1 to v3",
    href: "#contracts",
  },
  {
    icon: CalendarCheck,
    group: "Booking",
    title: "A public page where clients book themselves",
    desc: "Day and time chips, your availability rules, reminders before every call. One link, always current.",
    metric: "Self-serve",
    href: "#booking",
  },
];

/* ============================= PAGE =============================== */

export default function FeaturesPage() {
  return (
    <LandingShell>
      <Navbar />

      <main className="flex-1">
        <PageHero
          eyebrow="Modules"
          title="Eight modules."
          accent="One book."
          desc="Everything an independent freelancer needs to run the business: clients, projects, time, money, proposals, contracts, booking and a planner. One workspace, one login, one book."
        >
          <HeroDashboard />
        </PageHero>

        <SixTabsBand />

        {/* flagship rows */}
        <Section>
          <Container>
            <div className="space-y-24 sm:space-y-32">
              {rows.map((r) => (
                <div key={r.id} id={r.id} className="scroll-mt-24">
                  <FeatureRow
                    eyebrow={r.eyebrow}
                    title={r.title}
                    desc={r.desc}
                    points={r.points}
                    visual={r.visual}
                    reverse={r.reverse}
                  />
                </div>
              ))}
            </div>
          </Container>
        </Section>

        <FlowStrip />

        {/* Book AI, automations, contracts, booking */}
        <Section>
          <Container>
            <div className="space-y-24 sm:space-y-32">
              <div id="ai" className="scroll-mt-24">
                <FeatureRow
                  eyebrow="Book AI"
                  title="A copilot that knows the book."
                  desc="Book AI has read your whole book. Ask who owes you what and it answers with live numbers. Hand it a job brief and it drafts the proposal. On Monday morning you get a digest: what went out, what came in, what is stuck."
                  points={[
                    "Proposals drafted from your rates and past scopes",
                    "Answers like: Nova Studio owes $3,000, 12 days overdue",
                    "A Monday digest, before your first coffee",
                  ]}
                  visual={<AiVisual />}
                />
              </div>

              <div id="automations" className="scroll-mt-24">
                <FeatureRow
                  eyebrow="Automations"
                  title="Chasing money is not your job anymore."
                  desc="The book checks your invoices every morning. When one passes its due date, a reminder goes out on the schedule you set, and the dashboard flags it. Clients get a note 24 hours before a booked call."
                  points={[
                    "Payment reminders, timed to your grace period",
                    "Overdue invoices flagged the day they slip",
                    "Meeting reminders sent 24h ahead",
                  ]}
                  visual={<AutomationsVisual />}
                />
              </div>

              <div id="contracts" className="scroll-mt-24">
                <FeatureRow
                  reverse
                  eyebrow="Contracts & proposals"
                  title="From draft to Executed, with a paper trail."
                  desc="Send a public signature link and watch the status move: Sent, Viewed by Client, Executed. Every revision keeps its version number, every link carries its own expiry, and the log remembers who signed and when."
                  points={[
                    "Public signature links, revocable anytime",
                    "Version numbers on every revision",
                    "Expiry warnings like: expires in 2d",
                  ]}
                  visual={<ContractsVisual />}
                />
              </div>

              <div id="booking" className="scroll-mt-24">
                <FeatureRow
                  eyebrow="Booking"
                  title="A public page where clients book themselves."
                  desc="Send the link once. The client picks a day, picks a slot, and the call lands in your book with a reminder attached. No scheduling emails, no time-zone math."
                  points={[
                    "Day and time chips from your availability rules",
                    "One link for every client, always current",
                    "Reminders go out before every call",
                  ]}
                  visual={<BookingVisual />}
                />
              </div>
            </div>
          </Container>
        </Section>

        {/* full matrix + closing band */}
        <Section>
          <Container>
            <div className="mb-12 max-w-2xl">
              <Eyebrow>All modules</Eyebrow>
              <h2 className="mt-4 text-3xl font-medium leading-[1.1] tracking-tight text-fg sm:text-4xl">
                The full matrix
              </h2>
              <p className="mt-5 text-base font-light text-muted sm:text-lg">
                Every module ships on day one: one workspace, one login,
                nothing to wire up.
              </p>
            </div>
            <Rise>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {modules.map((m) => {
                  const Icon = m.icon;
                  return (
                    <Link
                      key={m.title}
                      href={m.href}
                      className="group relative flex flex-col rounded-[2px] border border-fg/10 bg-fg/[0.03] p-5 transition-colors hover:border-fg/20"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <span className="flex size-8 items-center justify-center rounded-[2px] border border-line bg-surface text-fg/70">
                          <Icon className="size-4" />
                        </span>
                        <span className="font-mono text-[10px] tabular-nums text-brand-light">
                          {m.metric}
                        </span>
                      </div>
                      <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted/55">
                        {m.group}
                      </div>
                      <h3 className="text-[15px] font-medium text-fg/90">{m.title}</h3>
                      <p className="mt-2 text-[12.5px] leading-5 text-muted">{m.desc}</p>
                    </Link>
                  );
                })}
              </div>
            </Rise>

            <Rise className="mt-16 flex flex-col items-center border-t border-line/60 pt-12 text-center">
              <p className="text-sm text-muted">
                All modules ship with the free core plan.
              </p>
              <Link href="/sign-up" className="mt-5">
                <MkButton type="button">Open your workspace</MkButton>
              </Link>
            </Rise>
          </Container>
        </Section>
      </main>

      <Footer />
    </LandingShell>
  );
}
