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
   Privacy Policy. Superset legal register: a PageHero opener, then a
   sticky mono table-of-contents beside numbered, hairline-separated
   sections. Scroll-spy highlights the section currently in view.
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
    id: "who-we-are",
    title: "Who we are",
    blocks: [
      {
        kind: "p",
        text: "Freelance Book (“we”, “us” or “our”) operates the Freelance Book application and website (together, the “Service”). This Privacy Policy explains what personal data we collect, why we collect it, how we use and protect it, and the choices and rights you have.",
      },
      {
        kind: "p",
        text: "It applies to anyone who uses the Service, including freelancers who create an account and the clients whose information is processed inside a Freelance Book workspace. By using the Service you agree to the collection and use of information described here; if you do not agree, please do not use the Service.",
      },
    ],
  },
  {
    id: "information-we-collect",
    title: "Information we collect",
    blocks: [
      {
        kind: "p",
        text: "We collect the minimum data needed to run a business-management workspace. It falls into four categories.",
      },
      {
        kind: "ul",
        items: [
          "Account information — your name, email address, password or authentication details, and workspace settings when you sign up.",
          "Business data — the clients, projects, time entries, invoices, contracts and messages you store. This content is provided by you and may contain personal data about your own clients.",
          "Payment information — plan and billing details. Card numbers and payment credentials are handled by our payment providers; we never store full card numbers on our servers.",
          "Technical and usage data — device type, browser, IP address, log data and how you interact with features, collected to keep the Service reliable and secure.",
        ],
      },
    ],
  },
  {
    id: "how-we-use",
    title: "How we use your information",
    blocks: [
      { kind: "p", text: "We use the data we collect to:" },
      {
        kind: "ul",
        items: [
          "Provide, operate and maintain the Service, including time tracking, invoicing, contracts and scheduling.",
          "Authenticate your account and keep it secure.",
          "Process payments and send transactional messages such as receipts and invoice reminders.",
          "Provide support and respond to your requests.",
          "Understand how features are used so we can improve the product.",
          "Comply with legal obligations and enforce our Terms of Service.",
        ],
      },
    ],
  },
  {
    id: "legal-bases",
    title: "Legal bases for processing",
    blocks: [
      {
        kind: "p",
        text: "Where the GDPR applies, we process personal data on the following legal bases: the performance of our contract with you (providing the Service), our legitimate interests in operating and improving a secure product, your consent where we ask for it (for example marketing emails), and compliance with our legal obligations.",
      },
    ],
  },
  {
    id: "cookies",
    title: "Cookies and similar technologies",
    blocks: [
      {
        kind: "p",
        text: "We use essential cookies to keep you signed in and to secure sessions, and non-essential cookies and similar technologies for analytics and performance measurement. You can control cookies through your browser settings; blocking essential cookies may prevent parts of the Service from working.",
      },
    ],
  },
  {
    id: "sharing",
    title: "How we share information",
    blocks: [
      {
        kind: "p",
        text: "We do not sell your personal data. We share data only with trusted providers that help us operate the Service, and only to the extent necessary.",
      },
      {
        kind: "ul",
        items: [
          "Infrastructure and storage hosting.",
          "Payment processing.",
          "Email delivery for transactional messages.",
          "Product analytics and error monitoring.",
        ],
      },
      {
        kind: "p",
        text: "These processors act on our instructions and are bound by data-processing terms. We may also disclose information when required by law or to protect the rights, safety and property of Freelance Book and its users.",
      },
    ],
  },
  {
    id: "retention",
    title: "Data retention",
    blocks: [
      {
        kind: "p",
        text: "We keep personal data for as long as your account is active. Business content you store is retained until you delete it or close your account, after which it is removed from production systems within a reasonable period. Some information, such as billing records, is retained longer where the law requires it.",
      },
    ],
  },
  {
    id: "storage-security",
    title: "Where your data is stored and security",
    blocks: [
      {
        kind: "p",
        text: "Your data is stored on secure infrastructure managed by our providers. We use encryption in transit, access controls and monitoring consistent with industry standards. No method of transmission or storage is completely secure, so while we work to protect your data we cannot guarantee absolute security.",
      },
    ],
  },
  {
    id: "your-rights",
    title: "Your rights",
    blocks: [
      {
        kind: "p",
        text: "Depending on where you live, you may have the following rights over your personal data:",
      },
      {
        kind: "ul",
        items: [
          "Access — obtain a copy of the personal data we hold about you.",
          "Rectification — correct inaccurate or incomplete data.",
          "Erasure — request deletion of your personal data (“the right to be forgotten”).",
          "Restriction and objection — limit or object to certain processing.",
          "Portability — receive your data in a structured, machine-readable format.",
          "Withdraw consent — where processing relies on your consent.",
        ],
      },
      {
        kind: "p",
        text: "Under the CCPA/CPRA, California residents may additionally request disclosure of the categories of personal information collected, the sources, the business purposes and the third parties it is shared with, and may object to the “sale” or “sharing” of personal information. We do not sell personal information as those terms are defined by the CCPA.",
      },
      {
        kind: "p",
        text: "To exercise any right, contact privacy@freelancebook.app. We may need to verify your identity before responding, and we honor requests within the timeframes required by law.",
      },
    ],
  },
  {
    id: "transfers",
    title: "International data transfers",
    blocks: [
      {
        kind: "p",
        text: "Freelance Book may process and store data outside your country. Where personal data crosses borders we rely on appropriate safeguards, such as Standard Contractual Clauses and equivalent transfer mechanisms, to keep your data protected.",
      },
    ],
  },
  {
    id: "children",
    title: "Children's privacy",
    blocks: [
      {
        kind: "p",
        text: "The Service is intended for adults running or supporting a freelance business. It is not directed to children under 16 (or the minimum age in your region), and we do not knowingly collect their data. If we learn we have, we delete it.",
      },
    ],
  },
  {
    id: "changes",
    title: "Changes to this policy",
    blocks: [
      {
        kind: "p",
        text: "We may update this Privacy Policy as the Service evolves. When we make material changes we will update the “Last updated” date and, where appropriate, notify you in the workspace or by email. Continued use of the Service after changes take effect constitutes acceptance of the revised policy.",
      },
    ],
  },
  {
    id: "contact",
    title: "Contact us",
    blocks: [
      {
        kind: "p",
        text: "Questions about this Privacy Policy or how we handle your data can be sent to privacy@freelancebook.app. Where required, you may also contact our data protection officer or your local supervisory authority.",
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

export default function PrivacyPage() {
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
          eyebrow="Legal · Privacy"
          title="Privacy Policy"
          desc="How Freelance Book collects, uses, stores and protects your personal data — and the rights and choices you have over it."
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
                    Questions about your privacy or this policy? Reach us at{" "}
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
