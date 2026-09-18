import { SmoothScroll } from "@/components/providers/SmoothScroll";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { TechStack } from "@/components/landing/TechStack";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <SmoothScroll>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
        {/* Top Glassmorphic Navigation */}
        <Navbar />

        {/* Main Content Area */}
        <main className="flex-1">
          {/* Hero Section with Interactive OS Preview */}
          <Hero />

          {/* Feature Grid of Product Modules */}
          <FeatureGrid />

          {/* Tech Stack & Architecture Matrix */}
          <TechStack />
        </main>

        {/* Categorized Footer */}
        <Footer />
      </div>
    </SmoothScroll>
  );
}
