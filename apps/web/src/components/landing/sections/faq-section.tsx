"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "@/components/animated-icons";
import { Container, Eyebrow, Section } from "@/components/landing/layout";
import { Stagger, StaggerItem } from "@/components/landing/motion";

/* ============================== FAQ ===============================
   Exclusive accordion with a real height animation (framer-motion):
   one item open at a time, first open by default, plus icon morphing
   into ×, hover-tinted rows, mono indices — sticky intro column with
   a "live demo" chip on xl screens.
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
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq" className="scroll-mt-24">
      <Container>
        <div className="grid grid-cols-1 gap-12 xl:grid-cols-[1fr_1.5fr] xl:gap-20">
          <div className="xl:sticky xl:top-24 xl:self-start">
            <Stagger className="space-y-4">
              <StaggerItem>
                <Eyebrow>FAQ</Eyebrow>
              </StaggerItem>
              <StaggerItem>
                <h2 className="text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl lg:text-5xl">
                  Frequently
                  <br />
                  asked questions
                </h2>
              </StaggerItem>
              <StaggerItem>
                <p className="max-w-sm text-base leading-relaxed text-muted">
                  The short answers. If something is still unclear, the dashboard is the
                  fastest way to see how the book fits together.
                </p>
              </StaggerItem>
              <StaggerItem>
                <Link
                  href="/dashboard"
                  className="group mt-2 inline-flex items-center gap-3 rounded-[2px] border border-line bg-fg/[0.03] px-4 py-3 text-sm font-medium text-fg transition-colors hover:border-brand/60 hover:bg-brand/10"
                >
                  <span className="relative flex size-2">
                    <span
                      aria-hidden
                      className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:animate-none"
                    />
                    <span className="relative inline-flex size-2 rounded-full bg-brand" />
                  </span>
                  Try the dashboard
                  <span
                    aria-hidden
                    className="text-muted transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </Link>
              </StaggerItem>
            </Stagger>
          </div>
          <Stagger className="w-full">
            {faqs.map((f, i) => {
              const isOpen = open === i;
              return (
                <StaggerItem key={f.q}>
                  <div className="border-b border-line">
                    <h3>
                      <button
                        type="button"
                        id={`faq-trigger-${i}`}
                        aria-expanded={isOpen}
                        aria-controls={`faq-panel-${i}`}
                        onClick={() => setOpen(isOpen ? null : i)}
                        className="group flex w-full cursor-pointer items-center justify-between gap-4 py-6 text-left transition-colors hover:bg-fg/[0.02] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
                      >
                        <span className="flex items-center gap-4 sm:gap-6">
                          <span className="hidden font-mono text-xs text-muted/70 sm:block">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="pr-2 text-base font-medium text-fg transition-colors group-hover:text-brand-light sm:text-lg">
                            {f.q}
                          </span>
                        </span>
                        <span
                          aria-hidden
                          className={`inline-flex size-8 shrink-0 items-center justify-center rounded-[2px] border transition-all duration-300 motion-reduce:transition-none ${
                            isOpen
                              ? "rotate-45 border-brand/60 bg-brand/10 text-brand"
                              : "border-line text-muted"
                          }`}
                        >
                          <Plus className="size-4" />
                        </span>
                      </button>
                    </h3>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="panel"
                          id={`faq-panel-${i}`}
                          role="region"
                          aria-labelledby={`faq-trigger-${i}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3 pb-6 pr-10 text-base leading-relaxed text-muted sm:pl-11">
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
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        </div>
      </Container>
    </Section>
  );
}
