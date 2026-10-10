"use client";

import { Container, Eyebrow, Section } from "@/components/landing/layout";
import { Rise, Stagger, StaggerItem } from "@/components/landing/motion";

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
      <text
        textAnchor="middle"
        fontSize="6.5"
        letterSpacing="1.1"
        fill="currentColor"
        fillOpacity="0.7"
        style={{ fontFamily: "var(--font-geist-mono), monospace" }}
      >
        <textPath href="#fb-badge-top" startOffset="50%">
          ENCRYPTED IN TRANSIT
        </textPath>
      </text>
      <text
        textAnchor="middle"
        fontSize="6.5"
        letterSpacing="1.1"
        fill="currentColor"
        fillOpacity="0.7"
        style={{ fontFamily: "var(--font-geist-mono), monospace" }}
      >
        <textPath href="#fb-badge-bottom" startOffset="50%">
          FULL DATA EXPORT
        </textPath>
      </text>
      <circle cx="10" cy="60" r="1" fill="currentColor" fillOpacity="0.5" />
      <circle cx="110" cy="60" r="1" fill="currentColor" fillOpacity="0.5" />
      <circle cx="60" cy="44" r="2.5" fill="var(--brand)" />
      <text
        x="60"
        y="66"
        textAnchor="middle"
        fontSize="17"
        fontWeight="500"
        fill="currentColor"
        style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
      >
        GDPR
      </text>
      <text
        x="60"
        y="80"
        textAnchor="middle"
        fontSize="7"
        letterSpacing="2"
        fill="currentColor"
        fillOpacity="0.7"
        style={{ fontFamily: "var(--font-geist-mono), monospace" }}
      >
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
          <Stagger className="space-y-4">
            <StaggerItem>
              <Eyebrow>Security</Eyebrow>
            </StaggerItem>
            <StaggerItem>
              <h2 className="text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl lg:text-5xl">
                Private by default.
                <br />
                You&apos;re in control.
              </h2>
            </StaggerItem>
            <StaggerItem>
              <p className="max-w-[700px] text-base font-light text-muted sm:text-lg">
                Your client data stays yours — exportable, revocable and encrypted, with
                explicit control over every share link.
              </p>
            </StaggerItem>
          </Stagger>
          <TrustBadge className="hidden shrink-0 text-muted transition-colors hover:text-fg sm:block" />
        </Rise>
        <Rise>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {securityCards.map((c) => (
              <div
                key={c.title}
                className="relative rounded-[2px] border border-fg/10 bg-fg/[0.03] p-6"
              >
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
