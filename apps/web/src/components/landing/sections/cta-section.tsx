"use client";

import Link from "next/link";
import { Container, Section } from "@/components/landing/layout";
import { Rise, Stagger, StaggerItem } from "@/components/landing/motion";
import { TextureOverlay } from "@/components/ui/texture-overlay";
import { GradientText } from "@/components/ui/gradient-text";

/* ============================ CTA BAND ============================
   Masterji-style closing panel: one big rounded card in warm paper
   tones that pops against the dark page, accent-colored words in the
   headline, dark pill CTA — mirrored by the footer below it.
=================================================================== */

export function CtaSection() {
  return (
    <Section className="py-12 sm:py-16 pb-24 sm:pb-32">
      <Container>
        <Rise>
          <div className="relative overflow-hidden rounded-[28px] bg-[#e9e6e0] px-6 py-10 text-center sm:rounded-[36px] sm:py-12">
            {/* dotted texture, strongest toward the edges */}
            <TextureOverlay
              texture="dots"
              tone="dark"
              opacity={0.32}
              style={{
                backgroundSize: "20px 20px",
                maskImage:
                  "radial-gradient(ellipse 72% 72% at 50% 50%, transparent 32%, black 100%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 72% 72% at 50% 50%, transparent 32%, black 100%)",
              }}
            />
            <Stagger className="relative flex flex-col items-center">
              <StaggerItem>
                <span className="mb-5 font-mono text-sm uppercase tracking-widest text-brand">
                  Get started
                </span>
              </StaggerItem>
              <StaggerItem>
                <h2 className="max-w-3xl text-3xl font-medium tracking-tight leading-[1.08] text-[#141311] sm:text-4xl lg:text-5xl">
                  Ready to run your business from{" "}
                  <GradientText>one calm book</GradientText>?
                </h2>
              </StaggerItem>
              <StaggerItem>
                <p className="mt-4 max-w-xl text-base text-[#141311]/65 sm:text-lg">
                  Clients, projects, time and invoices — set up in minutes, and free where
                  it matters.
                </p>
              </StaggerItem>
              <StaggerItem>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/sign-up"
                    className="group inline-flex items-center gap-2 rounded-full bg-[#141311] px-7 py-3.5 text-sm font-medium text-[#f5f3ef] transition-colors hover:bg-black"
                  >
                    Start for free
                    <span
                      aria-hidden
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </Link>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center rounded-full border border-[#141311]/25 px-7 py-3.5 text-sm font-medium text-[#141311] transition-colors hover:border-[#141311]/60"
                  >
                    Open the dashboard
                  </Link>
                </div>
              </StaggerItem>
              <StaggerItem>
                <p className="mt-5 text-xs text-[#141311]/55">
                  Free to start · No credit card required
                </p>
              </StaggerItem>
            </Stagger>
          </div>
        </Rise>
      </Container>
    </Section>
  );
}
