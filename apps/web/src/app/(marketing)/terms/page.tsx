"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  Container,
  Eyebrow,
  LandingShell,
  MkButton,
  PageHero,
  Section,
} from "@/components/landing/layout";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Terms of Service. Same superset legal register as the privacy
   page: a PageHero opener, a sticky mono table-of-contents and
   numbered, hairline-separated sections with scroll-spy highlighting.
------------------------------------------------------------------- */

type Block =
  | { kind: "p"; text: ReactNode }
  | { kind: "ul"; items: string[] };

type SectionDef = {
  id: string;
  title: string;
  blocks: Block[];
};

const sections: SectionDef[] = [
  {
    id: "acceptance",
    title: "Acceptance of these terms",
    blocks: [
      {
        kind: "p",
        text: "These Terms of Service (“Terms”) govern your access to and use of Freelance Book and its related websites, applications and services (the “Service”). By creating an account or using the Service you agree to be bound by these Terms. If you use the Service on behalf of an organization, you agree on behalf of that organization.",
      },
    ],
  },
  {
    id: "the-service",
    title: "The service",
    blocks: [
      {
        kind: "p",
        text: "Freelance Book is a business-management workspace for independent professionals: client records, projects, time tracking, invoicing, contracts, scheduling and related tools. We may add or remove features and change how the Service works over time.",
      },
    ],
  },
  {
    id: "accounts",
    title: "Accounts and registration",
    blocks: [
      {
        kind: "ul",
        items: [
          "You must provide accurate information and keep your credentials secure.",
          "You are responsible for all activity that happens under your account.",
          "You must be legally able to form a contract and be at least the age of majority in your region.",
          "Notify us promptly of any unauthorized use of your account.",
        ],
      },
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    blocks: [
      {
        kind: "p",
        text: "You agree not to misuse the Service. Without limiting the above, you may not:",
      },
      {
        kind: "ul",
        items: [
          "Break or attempt to breach the security of the Service, or access data you are not authorized to view.",
          "Upload malicious code, or probe, scan or test systems without permission.",
          "Infringe the rights of others or post unlawful, harmful or abusive content.",
          "Use the Service to send spam or unauthorized communications.",
          "Reverse engineer, resell or automate access in ways that harm the Service or violate our intent.",
          "Violate any applicable law or regulation while using the Service.",
        ],
      },
    ],
  },
  {
    id: "billing",
    title: "Plans, billing and subscriptions",
    blocks: [
      {
        kind: "p",
        text: "Freelance Book offers a free core plan and one or more paid plans. Paid features are billed in advance as a recurring subscription.",
      },
      {
        kind: "ul",
        items: [
          "Renewal — subscriptions renew automatically at the end of each period until you cancel.",
          "Trials — free trials, if offered, convert to a paid plan unless cancelled before the trial ends.",
          "Cancelling — you can cancel at any time; your plan stays active until the end of the current billing period.",
          "Refunds — unless required by law or stated otherwise, fees already paid are not refunded for partial periods.",
          "Price changes — we may adjust pricing with reasonable notice; continued use means you accept the new price.",
        ],
      },
      {
        kind: "p",
        text: "You are responsible for any taxes that apply to your purchase.",
      },
    ],
  },
  {
    id: "your-content",
    title: "Your content and data",
    blocks: [
      {
        kind: "p",
        text: "You keep all rights to the data and content you put in your workspace, and you are responsible for having the right to use it. You grant Freelance Book a limited license to store, process and display that content only as needed to provide the Service. We do not claim ownership of your business data.",
      },
    ],
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    blocks: [
      {
        kind: "p",
        text: "The Service itself — including its software, design, branding, text and original graphics — is owned by Freelance Book and protected by intellectual-property laws. These Terms do not grant you a right to use our trademarks, logos or brand assets without written permission.",
      },
    ],
  },
  {
    id: "third-party",
    title: "Third-party services",
    blocks: [
      {
        kind: "p",
        text: "The Service may integrate with or link to third-party tools and providers. Those services have their own terms and privacy practices, and we are not responsible for them. Your use of a third-party feature is at your own discretion and risk.",
      },
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    blocks: [
      {
        kind: "p",
        text: "The Service is provided “as is” and “as available” without warranties of any kind, whether express or implied, including warranties of merchantability, fitness for a particular purpose and non-infringement. We do not warrant that the Service will be uninterrupted or error-free, or that results obtained will be accurate. Financial, tax and legal outcomes are your responsibility; Freelance Book is not a substitute for professional advice.",
      },
    ],
  },
  {
    id: "liability",
    title: "Limitation of liability",
    blocks: [
      {
        kind: "p",
        text: "To the maximum extent permitted by law, Freelance Book is not liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, data or goodwill, arising from your use of the Service. Our total liability for any claim is limited to the amount you paid us, if any, in the twelve months before the claim arose.",
      },
    ],
  },
  {
    id: "indemnification",
    title: "Indemnification",
    blocks: [
      {
        kind: "p",
        text: "You agree to indemnify and hold Freelance Book harmless from claims, losses and expenses (including reasonable legal fees) arising from your use of the Service, your content, your violation of these Terms, or your infringement of any third party’s rights.",
      },
    ],
  },
  {
    id: "termination",
    title: "Termination",
    blocks: [
      {
        kind: "p",
        text: "You may stop using the Service and close your account at any time. We may suspend or terminate access if you violate these Terms, if we must for legal reasons, or if the account is inactive. Provisions that by their nature should survive — such as ownership, disclaimers and liability limits — continue after termination.",
      },
    ],
  },
  {
    id: "changes",
    title: "Changes to these terms and the service",
    blocks: [
      {
        kind: "p",
        text: "We may update these Terms as the Service changes. For material updates we will give reasonable notice, such as an in-workspace notice or an email. If you do not accept the new Terms you should stop using the Service; continuing to use it after changes take effect means you accept them.",
      },
    ],
  },
  {
    id: "governing-law",
    title: "Governing law",
    blocks: [
      {
        kind: "p",
        text: "These Terms are governed by the laws of [Governing Jurisdiction], without regard to conflict-of-law rules, and any disputes will be resolved in the courts of that jurisdiction, except where consumer-protection or mandatory local law requires otherwise.",
      },
    ],
  },
  {
    id: "contact",
    title: "Contact",
    blocks: [
      {
        kind: "p",
        text: "Questions about these Terms can be sent to privacy@freelancebook.app. Please include enough detail about your account or usage so we can help.",
      },
    ],
  },
];

function num(n: number) {
  return String(n).padStart(2, "0");
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((b, i) =>
        b.kind === "p" ? (
          <p key={i} className="text-sm leading-7 text-muted sm:text-[15px]">
            {b.text}
          </p>
        ) : (
          <ul key={i} className="space-y-2.5">
            {b.items.map((item, j) => (
              <li
                key={j}
                className="flex gap-3 text-sm leading-7 text-muted sm:text-[15px]"
              >
                <span aria-hidden className="shrink-0 pt-px font-mono text-brand">
                  ›
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function Toc({ active }: { active: string }) {
  return (
    <nav className="space-y-0.5">
      {sections.map((s, i) => {
        const isActive = s.id === active;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={cn(
              "group flex items-baseline gap-3 rounded-[2px] px-2.5 py-1.5 text-[13px] transition-colors",
              isActive ? "bg-surface text-fg" : "text-muted hover:text-fg"
            )}
          >
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums",
                isActive ? "text-brand" : "text-muted/40 group-hover:text-muted/70"
              )}
            >
              {num(i + 1)}
            </span>
            <span className="truncate">{s.title}</span>
          </a>
        );
      })}
    </nav>
  );
}

export default function TermsPage() {
  const [active, setActive] = useState(sections[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <LandingShell>
      <Navbar />

      <main className="flex-1">
        <PageHero
          eyebrow="Legal · Terms"
          title="Terms of Service"
          desc="The rules and terms that govern your use of Freelance Book, from accounts and billing to ownership, disclaimers and liability."
        />

        <Section className="pt-0">
          <Container>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
              <aside className="hidden lg:block">
                <div className="sticky top-28">
                  <Eyebrow className="mb-4 text-[10px] tracking-[0.18em] text-muted/50">
                    On this page
                  </Eyebrow>
                  <Toc active={active} />
                </div>
              </aside>

              <div>
                <p className="mb-10 font-mono text-[11px] uppercase tracking-[0.18em] text-muted/60">
                  Last updated: October 10, 2026
                </p>

                <div className="divide-y divide-line/50">
                  {sections.map((s, i) => (
                    <section
                      key={s.id}
                      id={s.id}
                      className="scroll-mt-28 py-10 first:pt-0"
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-xs tabular-nums text-muted/50">
                          {num(i + 1)}
                        </span>
                        <h2 className="text-lg font-medium tracking-tight text-fg sm:text-xl">
                          {s.title}
                        </h2>
                      </div>
                      <div className="mt-4 pl-0 sm:pl-9">
                        <Blocks blocks={s.blocks} />
                      </div>
                    </section>
                  ))}
                </div>

                <div className="mt-12 rounded-[2px] border border-line bg-card p-6">
                  <p className="text-sm leading-6 text-muted">
                    Questions about these Terms? Reach us at{" "}
                    <span className="font-mono text-fg">
                      privacy@freelancebook.app
                    </span>
                    .
                  </p>
                  <a href="mailto:privacy@freelancebook.app" className="mt-5 inline-flex">
                    <MkButton variant="outline" type="button">
                      Contact support
                    </MkButton>
                  </a>
                </div>
              </div>
            </div>
          </Container>
        </Section>
      </main>

      <Footer />
    </LandingShell>
  );
}
