"use client";

import Link from "next/link";
import {
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
  FeatureRow,
  VisualShell,
  VisualWindow,
} from "@/components/landing/LandingSections";
import {
  ClientsView,
  CommandPalette,
  MoneyView,
  ProjectsView,
  TimeView,
} from "@/components/landing/app-mock";
import {
  Container,
  LandingShell,
  MkButton,
  PageHero,
  Section,
  WindowFrame,
} from "@/components/landing/layout";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Features page — same superset grammar as the home page: alternating
   window rows for the flagship modules, then the full module matrix
   as a compact hairline-card grid. Every row visual is the real
   dashboard screen for that module.
------------------------------------------------------------------- */

/* Row visuals ------------------------------------------------------ */

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
    <VisualShell>
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
  return (
    <VisualShell>
      <WindowFrame title="command menu · Ctrl+K" className="w-full max-w-lg">
        <div className="bg-[#0e0e0f] px-6 py-10">
          <div className="bg-black/50">
            <CommandPalette />
          </div>
        </div>
      </WindowFrame>
    </VisualShell>
  );
}

/* Module matrix ---------------------------------------------------- */

const modules = [
  {
    icon: Users,
    group: "CRM & Pipeline",
    title: "Client roster, grouped the way you work",
    desc: "Clients, projects, invoices and notes in one book, with VIP and silence signals on every card.",
    metric: "5 roster groups",
    href: "/features#crm",
  },
  {
    icon: Kanban,
    group: "Project engine",
    title: "Milestones, budgets and unbilled hours",
    desc: "Every project card shows its milestone fraction, budget, deadline risk and the hours not yet invoiced.",
    metric: "7 live projects",
    href: "/features#projects",
  },
  {
    icon: Clock,
    group: "Time & focus",
    title: "One-click time tracking that survives a refresh",
    desc: "Start the clock on a project, close the tab, come back — it kept counting, and the entry is billable.",
    metric: "Keeps counting",
    href: "/features#time",
  },
  {
    icon: FileText,
    group: "Finance & profit",
    title: "Invoices, expenses and cash flow",
    desc: "Draft to Paid with a public pay link on every invoice, plus expenses and a cash-flow view.",
    metric: "4 invoice states",
    href: "/features#finance",
  },
  {
    icon: Command,
    group: "Command menu",
    title: "Ctrl+K to any section",
    desc: "The palette indexes Home, Clients, Leads, Time, Projects, Invoices, Money, Proposals, Booking and Settings.",
    metric: "13 destinations",
    href: "/features#palette",
  },
  {
    icon: Sparkles,
    group: "Proposals",
    title: "AI pitch writer with a saved library",
    desc: "Describe the job, set a budget, and keep every generated pitch in a Draft → Sent → Accepted lifecycle.",
    metric: "Saved pitches",
    href: "/features#ai",
  },
  {
    icon: Receipt,
    group: "Automations",
    title: "Payment and meeting reminders, sent for you",
    desc: "Late invoices are checked daily, nudges go out on your grace period, and clients get a note 24h before a call.",
    metric: "Runs daily",
    href: "/features#automations",
  },
  {
    icon: FolderLock,
    group: "Contracts",
    title: "E-sign links with a version trail",
    desc: "Send a public signature link, watch it move to Viewed by Client and ★ Executed, and keep each revision numbered.",
    metric: "v1 → v3 diffs",
    href: "/features#contracts",
  },
];

const rows = [
  {
    id: "crm",
    eyebrow: "CRM & Pipeline",
    title: "Know every client by heart",
    desc: "The roster groups clients however you like — VIP & Enterprise, Repeat Clients, Active Retainers — and every card carries the signals that matter: hourly rate, days since the last touch, lifetime value.",
    points: [
      "VIP and Standard badges on every client card",
      "Silence warnings when a client has gone quiet",
      "Intake forms and leads feed the same roster",
    ],
    visual: <CrmVisual />,
  },
  {
    id: "projects",
    eyebrow: "Project engine",
    title: "Every job, its budget and its unbilled hours",
    desc: "Projects are grouped by category and show milestone progress as a fraction, so a glance tells you what is moving, what is slipping, and what is finished but not yet invoiced.",
    points: [
      "Milestone progress on the card face",
      "Deadline risk: \"6d left\" or \"2d overdue\"",
      "Unbilled hours roll straight into a draft invoice",
    ],
    visual: <ProjectsVisual />,
    reverse: true,
  },
  {
    id: "time",
    eyebrow: "Time & focus",
    title: "Every billable minute, kept",
    desc: "Pick a project, say what you are doing, start the clock. It keeps counting if you close the tab or switch devices, and every entry lands in the list ready to bill.",
    points: [
      "Live timer that survives a refresh",
      "Entries grouped by project and day",
      "Tracked time converts into invoice lines",
    ],
    visual: <TimeVisual />,
  },
  {
    id: "finance",
    eyebrow: "Finance & profit",
    title: "From hours to paid, in minutes",
    desc: "Invoices are grouped by what needs your attention — Overdue Payments first, Paid & Settled below — each with its amount, due date and status. Clients settle up from a public pay link.",
    points: [
      "Draft → Sent → Paid → Overdue lifecycle",
      "A public pay link on every invoice",
      "Expenses and cash flow in the same book",
    ],
    visual: <FinanceVisual />,
    reverse: true,
  },
  {
    id: "palette",
    eyebrow: "Command menu",
    title: "Jump anywhere with Ctrl+K",
    desc: "The palette sits in the dashboard's top bar and indexes every section. Start typing and the destination is one Enter away.",
    points: [
      "Search anything from the top bar",
      "Every section, one keystroke down",
      "ESC closes it where you were",
    ],
    visual: <PaletteVisual />,
  },
];

export default function FeaturesPage() {
  return (
    <LandingShell>
      <Navbar />

      <main className="flex-1">
        <PageHero
          eyebrow="Modules"
          title="Eight modules."
          accent="One book."
          desc="Everything an independent freelancer needs to run the business — clients, projects, time, money, proposals, contracts, booking and a planner — in one workspace."
        />

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

        <section className="relative py-20 sm:py-24">
          <Container>
            <div className="mb-12 max-w-2xl">
              <h2 className="text-3xl font-medium leading-[1.1] tracking-tight text-fg sm:text-4xl lg:text-5xl">
                The full matrix
              </h2>
              <p className="mt-5 text-base font-light text-muted sm:text-lg">
                Every module ships on day one — one workspace, one login, nothing to wire up.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {modules.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.title}
                    id={m.href.split("#")[1]}
                    className={cn(
                      "group relative flex scroll-mt-24 flex-col rounded-[2px] border border-fg/10 bg-fg/[0.03] p-5 transition-colors hover:border-fg/20"
                    )}
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
                  </div>
                );
              })}
            </div>

            <div className="mt-16 flex flex-col items-center border-t border-line/60 pt-12 text-center">
              <p className="text-sm text-muted">All eight modules ship with the free core plan.</p>
              <Link href="/sign-up" className="mt-5">
                <MkButton type="button">Open your workspace</MkButton>
              </Link>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </LandingShell>
  );
}
