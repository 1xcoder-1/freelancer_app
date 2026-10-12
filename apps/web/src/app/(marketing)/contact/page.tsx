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
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Questions, feedback or security reports — email the Freelance Book team and get a real answer.",
};

/* ------------------------------------------------------------------
   Contact — one honest channel: email. Three reason-cards keep it
   routable without a support-ticket system; socials live in the
   footer and here, both sourced from lib/site.
------------------------------------------------------------------- */

const reasons = [
  {
    id: "support",
    title: "Support",
    desc: "Something broken, a bill that looks wrong, or a question about your workspace. Include the email you signed up with.",
  },
  {
    id: "feedback",
    title: "Feedback & feature ideas",
    desc: "Tell us what the book is missing. The sharpest product notes come from people mid-project — yours get read by the person building it.",
  },
  {
    id: "security",
    title: "Security & privacy",
    desc: "Found a vulnerability or a data concern? Report it here. We treat every report as confidential and respond before anything else.",
  },
];

export default function ContactPage() {
  return (
    <LandingShell>
      <Navbar />
      <main className="flex-1">
        <PageHero
          eyebrow="Contact"
          title="One inbox,"
          accent="actually read."
          desc="No ticket queues, no chatbots. Email us and a person replies — usually within a day, always eventually."
        >
          <a
            href={`mailto:${site.contactEmail}?subject=${encodeURIComponent(
              "Freelance Book"
            )}`}
            className="group inline-flex items-center gap-3 bg-fg px-6 py-3 text-sm text-bg transition-colors duration-150 hover:bg-brand hover:text-white"
          >
            <span className="font-mono tracking-tight">{site.contactEmail}</span>
            <span
              aria-hidden
              className="transition-transform duration-150 group-hover:translate-x-1"
            >
              →
            </span>
          </a>
        </PageHero>

        <Section className="pt-4 sm:pt-8">
          <Container>
            <div className="grid gap-px border border-line bg-line sm:grid-cols-3">
              {reasons.map((r) => (
                <div key={r.id} className="flex flex-col gap-3 bg-bg p-8">
                  <Eyebrow className="text-xs">{r.id.replace("-", " ")}</Eyebrow>
                  <h2 className="text-xl font-medium tracking-tight text-fg">
                    {r.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-muted">{r.desc}</p>
                </div>
              ))}
            </div>

            <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-muted">
              Not sure where it fits? Send it anyway. For product questions,
              the fastest answer is often already in the{" "}
              <a
                href="/docs"
                className="text-fg underline decoration-line underline-offset-4 hover:decoration-brand"
              >
                docs
              </a>
              .
            </p>
          </Container>
        </Section>
      </main>
      <Footer />
    </LandingShell>
  );
}
