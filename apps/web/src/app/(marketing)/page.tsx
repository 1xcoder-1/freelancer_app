import { SmoothScroll } from "@/components/providers/SmoothScroll";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import {
  Features,
  Workflow,
  WallOfLove,
  Faq,
  CtaBand,
} from "@/components/landing/LandingSections";
import { Footer } from "@/components/landing/Footer";
import { LandingShell } from "@/components/landing/layout";

export default function Home() {
  return (
    <SmoothScroll>
      <LandingShell>
        <Navbar />
        <main className="flex-1">
          <Hero />
          <Features />
          <Workflow />
          <WallOfLove />
          <Faq />
          <CtaBand />
        </main>
        <Footer />
      </LandingShell>
    </SmoothScroll>
  );
}
