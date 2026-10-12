import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  Container,
  Eyebrow,
  LandingShell,
  PageHero,
  Section,
} from "@/components/landing/layout";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "What shipped in Freelance Book, release by release — modules, marketing and engine work.",
};

/* ------------------------------------------------------------------
   Changelog — static, hand-curated from the feature history. New
   entry goes on top; each release is a dated block with hairline
   separation, mono date stamps matching the superset eyebrow style.
------------------------------------------------------------------- */

type Release = {
  date: string;
  title: string;
  groups: { heading: string; items: string[] }[];
};

const releases: Release[] = [
  {
    date: "Oct 11, 2026",
    title: "In-app docs, legal pages and a modular showcase",
    groups: [
      {
        heading: "New",
        items: [
          "Documentation site built into the app — getting started, every module, integrations and API reference.",
          "Privacy Policy and Terms of Service pages.",
          "Download page covering web, desktop and phone.",
          "Contact page and this changelog.",
        ],
      },
      {
        heading: "Changed",
        items: [
          "Home page rebuilt around live product mockups — dashboard window, phone fan and laptop that opens on scroll.",
          "Book AI got its own spotlight section with a self-playing demo.",
        ],
      },
    ],
  },
  {
    date: "Oct 8, 2026",
    title: "Engine week: dedup and availability",
    groups: [
      {
        heading: "New",
        items: [
          "Person dedup — the same human appearing as a lead, client and contact now merges cleanly, with database indexes to keep it fast.",
          "Booking availability backfill — public booking pages respect your existing calendar events.",
        ],
      },
      {
        heading: "Removed",
        items: [
          "Pricing page. Everything is free while the product is in open development.",
        ],
      },
    ],
  },
  {
    date: "Oct 2, 2026",
    title: "Leads, intake and clients get hands",
    groups: [
      {
        heading: "Changed",
        items: [
          "Leads panel rebuilt — every card opens, edits and converts inline, with full create/read/update/delete routes.",
          "Intake forms polished with interactive panels and the same CRUD routes.",
          "Client detail view tightened around the new roster cards.",
        ],
      },
    ],
  },
  {
    date: "Oct 1, 2026",
    title: "VIP clients, touchpoints and pay links",
    groups: [
      {
        heading: "New",
        items: [
          "VIP auto-category — clients who matter get flagged without you tagging them by hand.",
          "Touchpoint history per person — every call, email and meeting logged, with silent-days counted for you.",
          "Public pay links — send a client a /pay URL and get paid without an invoice round-trip.",
        ],
      },
      {
        heading: "Changed",
        items: [
          "Client roster cards overhauled, and the client portal refreshed around them.",
        ],
      },
    ],
  },
  {
    date: "Sep 29, 2026",
    title: "One card system everywhere",
    groups: [
      {
        heading: "New",
        items: [
          "Dedicated detail, preview and edit routes for leads, clients and intake — no more everything-in-a-modal.",
          "Shared category visual card component used across modules.",
        ],
      },
      {
        heading: "Changed",
        items: [
          "Leads, clients and intake switched to unified visual cards with pagination (20 per page).",
          "Projects module restructured around the same card system.",
        ],
      },
    ],
  },
  {
    date: "Sep 28, 2026",
    title: "Planner, Money and calendar sync",
    groups: [
      {
        heading: "New",
        items: [
          "Daily focus planner — boards for what needs doing, with date, priority, project and timebox on every item.",
          "Day history: look back at any past board and restore it.",
          "Shared read-only links for planner boards.",
          "Money module — cashflow view over invoices and expenses.",
          "Google Calendar sync, including a booking calendar callback.",
        ],
      },
    ],
  },
  {
    date: "Sep 21, 2026",
    title: "Report Card grows tabs",
    groups: [
      {
        heading: "New",
        items: [
          "Inspiration and Projects tabs on the report card, with real-time database sync.",
          "Brand logo set for the profile page.",
          "Automations page in the dashboard.",
          "Email jobs for invoices — reminders that send themselves.",
        ],
      },
      {
        heading: "Changed",
        items: [
          "Report card rendering and caching made significantly faster.",
        ],
      },
    ],
  },
  {
    date: "Sep 20, 2026",
    title: "Report Card and workspace auth",
    groups: [
      {
        heading: "New",
        items: [
          "Report Card module — a public profile page you compose from your real work.",
          "Workspace-scoped authentication across the API.",
          "Graphify cache layer.",
        ],
      },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <LandingShell>
      <Navbar />
      <main className="flex-1">
        <PageHero
          eyebrow="Changelog"
          title="Shipped, not"
          accent="announced."
          desc="Every release, in plain words. The book grows in public — new modules, engine work and the occasional removal."
        />
        <Section className="pt-4 sm:pt-8">
          <Container className="max-w-4xl">
            <div className="flex flex-col">
              {releases.map((release, i) => (
                <article
                  key={release.date}
                  className={
                    i === 0
                      ? "pb-16"
                      : "border-t border-line/60 py-16"
                  }
                >
                  <Eyebrow className="mb-3 text-xs">{release.date}</Eyebrow>
                  <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-fg">
                    {release.title}
                  </h2>
                  <div className="mt-8 flex flex-col gap-8">
                    {release.groups.map((group) => (
                      <div key={group.heading} className="grid gap-3 sm:grid-cols-[100px_1fr]">
                        <p className="font-mono text-xs uppercase tracking-widest text-muted/70 sm:pt-1">
                          {group.heading}
                        </p>
                        <ul className="flex flex-col gap-2.5">
                          {group.items.map((item) => (
                            <li
                              key={item}
                              className="flex gap-3 text-sm leading-relaxed text-muted"
                            >
                              <span
                                aria-hidden
                                className="mt-[0.55em] size-1.5 shrink-0 bg-brand/70"
                              />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </Container>
        </Section>
      </main>
      <Footer />
    </LandingShell>
  );
}
