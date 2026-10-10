"use client";

import Link from "next/link";
import { ArrowRight, Globe } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  LandingShell,
  MkButton,
  PageHero,
} from "@/components/landing/layout";
import { DownloadHeroVisual } from "@/components/landing/sections/download-hero";
import { PhoneShowcase } from "@/components/landing/sections/phone-showcase";
import { LaptopShowcase } from "@/components/landing/sections/laptop-showcase";
import { DownloadSection } from "@/components/landing/sections/download-section";
import { CtaSection } from "@/components/landing/sections/cta-section";

/* ------------------------------------------------------------------
   Download page — the book on every screen: leaning phone hero, the
   three-app fan, the full MacBook showcase, and the honest pre-launch
   native-app tiles with the web app as the instant path.
------------------------------------------------------------------- */

export default function DownloadPage() {
  return (
    <LandingShell>
      <Navbar />

      <main className="flex-1">
        <PageHero
          eyebrow="Download"
          title="The book on"
          accent="every screen"
          suffix="you own."
          desc="Start on the web in seconds — the Android and Windows companions are in final testing, built for the moments a browser can't reach."
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up">
              <MkButton>
                Open the web app
                <span className="relative size-4 overflow-hidden">
                  <ArrowRight className="absolute inset-0 size-4 transition-transform duration-300 ease-out group-hover:translate-x-full" />
                  <ArrowRight className="absolute inset-0 size-4 -translate-x-full transition-transform duration-300 ease-out group-hover:translate-x-0" />
                </span>
              </MkButton>
            </Link>
            <Link href="#download">
              <MkButton variant="outline">
                <Globe className="size-4" />
                See what&apos;s shipping
              </MkButton>
            </Link>
          </div>
        </PageHero>

        <DownloadHeroVisual />
        <PhoneShowcase />
        <LaptopShowcase />
        <DownloadSection />
        <CtaSection />
      </main>

      <Footer />
    </LandingShell>
  );
}
