"use client";

import Link from "next/link";
import { Check, Clock, Search } from "lucide-react";
import {
  AutomationsView,
  ClientsView,
  CommandPalette,
  ContractsView,
  GoogleCalendarButton,
  GoogleCalendarPill,
  PayLinkCard,
  ProjectsView,
  ScaledMock,
} from "@/components/landing/app";
import { Container, Eyebrow, RadialGlow, Section, WindowFrame } from "@/components/landing/layout";
import { Rise, Stagger, StaggerItem } from "@/components/landing/motion";
import { cn } from "@/lib/utils";

/* ========================== FEATURE ROWS ==========================
   Alternating text/visual rows. Visuals carry the same Agenforce-style
   3D tilt as the hero window (.mk-tilt, mirrored on reversed rows).
   The mask fade now stops late (black 78%) so every tile stays
   clearly readable to its bottom edge.
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
        <Stagger className="space-y-4">
          <StaggerItem>
            <Eyebrow>{eyebrow}</Eyebrow>
          </StaggerItem>
          <StaggerItem>
            <h3 className="text-2xl font-medium tracking-tight text-fg sm:text-3xl">{title}</h3>
          </StaggerItem>
          <StaggerItem>
            <p className="max-w-[500px] text-base leading-relaxed text-muted sm:text-lg">{desc}</p>
          </StaggerItem>
        </Stagger>
        {points && points.length > 0 && (
          <Stagger className="space-y-2.5 pt-1">
            {points.map((p) => (
              <StaggerItem key={p}>
                <div className="flex items-start gap-2.5 text-[13px] leading-5 text-fg/90">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
                  <span>{p}</span>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
      <div className={reverse ? "lg:order-1" : "lg:order-2"}>{visual}</div>
    </div>
  );
}

export function VisualShell({
  children,
  flip = false,
}: {
  children: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="relative w-full overflow-hidden min-h-[360px] lg:aspect-4/3">
      <RadialGlow />
      <div className="relative z-10 flex h-full w-full items-center justify-center p-4 [perspective:1600px] sm:p-6">
        <Rise className="flex w-full justify-center">
          <div
            className={cn(
              "w-full max-w-xl [mask-image:linear-gradient(to_bottom,black_78%,transparent_99%)]",
              flip ? "mk-tilt-flip" : "mk-tilt"
            )}
            style={{ transformOrigin: "50% 42%" }}
          >
            {children}
          </div>
        </Rise>
      </div>
    </div>
  );
}

/* Each row visual is a real dashboard screen, re-rendered with the app's
   own primitives (landing/app) and scaled into the slot — no invented UI. */

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

/* Row 5 — the real Ctrl+K palette floating over a dimmed dashboard, so
   the tile reads at a glance as "command menu over your whole book". */
export function CommandMenuVisual() {
  return (
    <VisualShell>
      <WindowFrame title="command menu · Ctrl+K" className="w-full max-w-xl">
        <ScaledMock designWidth={800} designHeight={500}>
          <div className="relative h-full w-full overflow-hidden bg-[#0e0e0f]">
            {/* the dashboard behind the palette — dimmed, out of focus */}
            <div aria-hidden className="absolute inset-0 flex opacity-45 blur-[1.5px]">
              <div className="w-[168px] shrink-0 space-y-2 border-r border-[#28282a] bg-[#161617] p-3">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-lg border border-[#d46b28]/40 bg-[#261912] font-mono text-[8px] font-bold text-[#f0efed]">
                    fb
                  </span>
                  <span className="text-[10px] font-bold text-[#f0efed]">FreelanceBook</span>
                </div>
                {["Home", "Clients", "Projects", "Time", "Money", "Proposals"].map((n, i) => (
                  <div
                    key={n}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[10px]",
                      i === 1
                        ? "border border-[#d46b28]/40 bg-[#261912] font-bold text-[#f0efed]"
                        : "text-[#a19d98]"
                    )}
                  >
                    <span className="size-2.5 rounded-[3px] bg-current opacity-50" />
                    {n}
                  </div>
                ))}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex h-9 items-center justify-end border-b border-[#28282a] bg-[#161617] px-4">
                  <span className="flex h-5 w-[150px] items-center gap-1.5 rounded-full border border-[#28282a] bg-[#0e0e0f] px-2 text-[9px] text-[#6f6b66]">
                    <Search className="size-2.5" />
                    Search or run a command
                  </span>
                </div>
                <div className="grid flex-1 grid-cols-4 gap-3 p-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-[#28282a] bg-[#161617]" />
                  ))}
                </div>
              </div>
            </div>
            <div aria-hidden className="absolute inset-0 bg-black/50" />
            {/* the palette, centered */}
            <div className="absolute left-1/2 top-[13%] w-[440px] -translate-x-1/2">
              <CommandPalette query="nova" />
            </div>
          </div>
        </ScaledMock>
      </WindowFrame>
    </VisualShell>
  );
}

/* Row 6 — the two connections the product really has: Google Calendar on
   the dashboard calendar, and the public payment link clients open. */
function ConnectionsVisual() {
  return (
    <VisualShell flip>
      <WindowFrame title="calendar / pay link" className="w-full max-w-xl">
        <ScaledMock designWidth={800} designHeight={470}>
          <div className="grid h-full w-full grid-cols-[1.05fr_1fr] gap-5 bg-[#0e0e0f] p-6 text-[#f0efed]">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 border-b border-dashed border-[#28282a] pb-3">
                <h3 className="text-sm font-medium tracking-wide">Calendar</h3>
                <GoogleCalendarPill email="alex@gmail.com" synced="09:12" />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#28282a] bg-[#161617] px-3.5 py-2.5">
                <span className="text-xs text-[#a19d98]">On another device?</span>
                <GoogleCalendarButton />
              </div>
              <div className="space-y-2">
                {[
                  { t: "09:30", d: "Standup · Acme Corp", tone: "sky" },
                  { t: "11:00", d: "Intro call · booked via link", tone: "accent" },
                  { t: "15:00", d: "Design review · Nova Studio", tone: "violet" },
                ].map((e) => (
                  <div
                    key={e.t}
                    className="flex items-center gap-2.5 rounded-xl border border-[#28282a] bg-[#161617] px-3 py-2.5"
                  >
                    <span className="flex size-7 items-center justify-center rounded-lg bg-[#6ea8dc]/10 text-[#6ea8dc]">
                      <Clock className="size-3.5" />
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-[#f0efed]">
                      {e.t}
                    </span>
                    <span className="min-w-0 truncate text-xs text-[#a19d98]">{e.d}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              <PayLinkCard />
            </div>
          </div>
        </ScaledMock>
      </WindowFrame>
    </VisualShell>
  );
}

function IntegrationsVisual() {
  return <ConnectionsVisual />;
}

function QuickCaptureVisual() {
  return <CommandMenuVisual />;
}

export function FeatureRows() {
  return (
    <Section id="features" className="scroll-mt-24">
      <Container>
        <div className="space-y-24 sm:space-y-32">
          <FeatureRow
            eyebrow="Client CRM"
            title="Every client, one page."
            desc="The book remembers what the inbox forgets. Clients, their projects, files and full history live together — intake forms do the typing, and every invoice, call and proposal stays attached to the right relationship."
            visual={<CrmVisual />}
          />
          <FeatureRow
            reverse
            eyebrow="Parallel Projects"
            title="All your projects, in parallel."
            desc="Kanban, milestones and a focus timer that accounts for every billable minute. See what's moving, what's blocked and what's ready to send — without sitting through a single status meeting."
            visual={<ProjectsVisual />}
          />
          <FeatureRow
            eyebrow="Automations"
            title="Recurring work, handled."
            desc="Payment and meeting reminders send themselves on the schedule you set, and overdue invoices are flagged every morning. Chasing money quietly stops being your job."
            visual={<AutomationsVisual />}
          />
          <FeatureRow
            reverse
            eyebrow="Contracts & proposals"
            title="From proposal to signature."
            desc="Draft it, send it, watch the card turn Executed. Every revision keeps its version number, every link carries its own expiry, and the status updates itself — Sent, Viewed by Client, ★ Executed."
            visual={<ProposalsVisual />}
          />
          <FeatureRow
            eyebrow="Command menu"
            title="Your business, one keystroke away."
            desc="Ctrl+K opens the palette over your whole book. Type where you want to go — clients, time, projects, invoices — and you're already there. No hunting through the sidebar."
            visual={<QuickCaptureVisual />}
          />
          <FeatureRow
            reverse
            eyebrow="Connections"
            title="Plays well with your stack."
            desc="Google Calendar puts your bookings beside your billable hours, and every invoice carries a public pay link your client can settle from any device — no account required."
            visual={<IntegrationsVisual />}
          />
          <FeatureRow
            eyebrow="Keep moving"
            title="See every module up close."
            desc="The features page walks the whole book module by module — time, money, proposals, booking, Book AI — each one with the screen it actually ships."
            points={undefined}
            visual={
              <VisualShell flip>
                <WindowFrame title="all modules" className="w-full max-w-md">
                  <div className="space-y-3 bg-[#0e0e0f] p-6 text-[#f0efed]">
                    {[
                      ["01", "Client roster & intake", "CRM"],
                      ["02", "Projects, milestones, budgets", "Delivery"],
                      ["03", "Timer that survives refresh", "Time"],
                      ["04", "Invoices & pay links", "Money"],
                      ["05", "Proposals → contracts", "Paper trail"],
                      ["06", "Booking & reminders", "Automation"],
                    ].map(([n, t, g]) => (
                      <div
                        key={n}
                        className="flex items-center gap-3 rounded-xl border border-[#28282a] bg-[#161617] px-4 py-3"
                      >
                        <span className="font-mono text-[11px] text-[#d46b28]">{n}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{t}</span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-[#6f6b66]">
                          {g}
                        </span>
                      </div>
                    ))}
                    <Link
                      href="/features"
                      className="mt-1 flex h-10 w-full items-center justify-center rounded-xl bg-[#d46b28] text-sm font-semibold text-white"
                    >
                      Browse all modules →
                    </Link>
                  </div>
                </WindowFrame>
              </VisualShell>
            }
          />
        </div>
      </Container>
    </Section>
  );
}
