// Next.js convention: this file MUST live at src/app/not-found.tsx.
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Sparkles, Home, Layers, DollarSign, Heart } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col selection:bg-accent selection:text-accent-fg">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-24 px-4">
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-danger/10 border border-danger/20 text-xs font-semibold text-danger mb-6">
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
            <span>404 — Page Not Found</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl font-bold text-fg tracking-tight leading-tight mb-4">
            Lost in the Workspace?
          </h1>

          <p className="text-muted text-sm sm:text-base leading-relaxed mb-8 max-w-md mx-auto">
            The page or document you are looking for might have been moved or does not exist. Explore our popular modules below:
          </p>

          <div className="grid grid-cols-2 gap-3 mb-8 text-left">
            <Link
              href="/features"
              className="p-3.5 rounded-xl bg-card border border-line hover:border-accent transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-fg group-hover:text-accent">Features</div>
                <div className="text-[10px] text-muted">CRM, Time & Invoices</div>
              </div>
            </Link>

            <Link
              href="/pricing"
              className="p-3.5 rounded-xl bg-card border border-line hover:border-accent transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-accent-soft text-info flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-fg group-hover:text-info">Pricing</div>
                <div className="text-[10px] text-muted">100% Free Core Plan</div>
              </div>
            </Link>

            <Link
              href="/ai"
              className="p-3.5 rounded-xl bg-card border border-line hover:border-accent transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-info/10 text-info dark:text-info flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-fg group-hover:text-info dark:text-info">Book AI</div>
                <div className="text-[10px] text-muted">AI Freelance Copilot</div>
              </div>
            </Link>

            <Link
              href="/about"
              className="p-3.5 rounded-xl bg-card border border-line hover:border-accent transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
                <Heart className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-fg group-hover:text-accent">About Us</div>
                <div className="text-[10px] text-muted">Story & Manifesto</div>
              </div>
            </Link>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hi text-accent-fg font-bold text-xs transition-all shadow-sm"
          >
            <Home className="w-4 h-4" />
            <span>Return to Home</span>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
