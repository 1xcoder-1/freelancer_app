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

export default function Home() {
  return (
    <SmoothScroll>
      <div className="min-h-screen bg-bg text-fg flex flex-col">
        {/* Slim top navigation */}
        <Navbar />

        {/* Main Content Area */}
        <main className="flex-1">
          <Hero />
          <Features />
          <Workflow />
          <WallOfLove />
          <Faq />
          <CtaBand />
        </main>

        {/* Categorized Footer */}
        <Footer />
      </div>
    </SmoothScroll>
  );
}
