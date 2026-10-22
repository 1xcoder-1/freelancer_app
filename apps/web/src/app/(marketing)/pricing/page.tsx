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
import { CtaSection } from "@/components/landing/sections/cta-section";
import { PricingSection } from "@/components/landing/sections/pricing-section";
import { Stagger, StaggerItem } from "@/components/landing/motion";
import type { PlanKey } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Four sizes of the same book. Start free, or upgrade for room to grow — every module included on every plan.",
};

const billingNotes = [
  {
    q: "What happens when I reach a limit?",
    a: "The create action pauses and points you to Billing. Nothing is deleted — every existing client and service stays editable, and you can upgrade whenever you need the extra room.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. Upgrades apply immediately; downgrades take effect at the end of the current billing period, so you keep the larger limits until then.",
  },
  {
    q: "Who handles the payment?",
    a: "Checkout and invoices run through Clerk Billing. Freelance Book never sees or stores your card details.",
  },
  {
    q: "Which currency am I billed in?",
    a: "Plans are billed monthly in USD. That is separate from your workspace currency — you can still invoice clients in whatever currency you work in.",
  },
];

/* ============================ PRICING FAQ =========================
   Same two-column grammar as the home WhyBand: quiet left-hand
   statement, hairline-divided answers on the right.
=================================================================== */

function BillingNotes() {
  return (
    <Section className="border-t border-line/60">
      <Container>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
          <Stagger>
            <StaggerItem>
              <Eyebrow>Billing, plainly</Eyebrow>
            </StaggerItem>
            <StaggerItem>
              <h2 className="mt-4 max-w-md text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl">
                No surprise invoices.
              </h2>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-4 max-w-md text-base font-light leading-relaxed text-muted sm:text-lg">
                Four straightforward answers about limits, upgrades and who
                touches your money.
              </p>
            </StaggerItem>
          </Stagger>

          <Stagger className="divide-y divide-line/50 border-y border-line/50">
            {billingNotes.map((note) => (
              <StaggerItem key={note.q}>
                <div className="py-5">
                  <h3 className="text-[15px] font-medium text-fg">{note.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{note.a}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Container>
    </Section>
  );
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  // An in-app upgrade CTA arrives here with the tier it wants the visitor to
  // see; anything unrecognized is ignored rather than highlighting nothing wrong.
  const { focus } = await searchParams;
  const isTier =
    focus === "free" ||
    focus === "starter" ||
    focus === "growth" ||
    focus === "pro";
  return (
    <LandingShell>
      <Navbar />

      <main className="flex-1">
        <PageHero
          eyebrow="Pricing"
          title="Room for the work"
          accent="you actually have."
          desc="The whole book is included on every plan. The only difference is how much room you get — start free and move up when the roster does."
        />

        <PricingSection
          showHeading={false}
          focus={isTier ? (focus as PlanKey) : undefined}
        />
        <BillingNotes />

        <CtaSection />
      </main>

      <Footer />
    </LandingShell>
  );
}
