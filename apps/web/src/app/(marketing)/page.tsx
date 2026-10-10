import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { AiSpotlight } from "@/components/landing/sections/ai-spotlight";
import { CtaSection } from "@/components/landing/sections/cta-section";
import { FaqSection } from "@/components/landing/sections/faq-section";
import { FeatureRows } from "@/components/landing/sections/feature-rows";
import { LaptopShowcase } from "@/components/landing/sections/laptop-showcase";
import { PhoneShowcase } from "@/components/landing/sections/phone-showcase";
import { SecuritySection } from "@/components/landing/sections/security-section";
import { Testimonials } from "@/components/landing/sections/testimonials";
import { WhyBand } from "@/components/landing/sections/why-band";
import { Footer } from "@/components/landing/Footer";
import { LandingShell } from "@/components/landing/layout";

export default function Home() {
  return (
    <LandingShell>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <PhoneShowcase />
        <LaptopShowcase />
        <AiSpotlight />
        <WhyBand />
        <FeatureRows />
        <Testimonials />
        <SecuritySection />
        <FaqSection />
        <CtaSection />
      </main>
      <Footer />
    </LandingShell>
  );
}
