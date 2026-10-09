import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import {
  PhoneShowcase,
  LogoGrid,
  FeatureRows,
  Testimonials,
  SecuritySection,
  FaqSection,
  CtaSection,
} from "@/components/landing/LandingSections";
import { Footer } from "@/components/landing/Footer";
import { LandingShell } from "@/components/landing/layout";

export default function Home() {
  return (
    <LandingShell>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <PhoneShowcase />
        <LogoGrid />
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
