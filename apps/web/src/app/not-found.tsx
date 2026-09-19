import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Sparkles, Home, Layers, DollarSign, Heart } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-24 px-4">
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 mb-6">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span>404 — Page Not Found</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Lost in the Workspace?
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-8 max-w-md mx-auto">
            The page or document you are looking for might have been moved or does not exist. Explore our popular modules below:
          </p>

          <div className="grid grid-cols-2 gap-3 mb-8 text-left">
            <Link
              href="/features"
              className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-emerald-400">Features</div>
                <div className="text-[10px] text-slate-400">CRM, Time & Invoices</div>
              </div>
            </Link>

            <Link
              href="/pricing"
              className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-cyan-400">Pricing</div>
                <div className="text-[10px] text-slate-400">100% Free Core Plan</div>
              </div>
            </Link>

            <Link
              href="/ai"
              className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-indigo-400">Book AI</div>
                <div className="text-[10px] text-slate-400">AI Freelance Copilot</div>
              </div>
            </Link>

            <Link
              href="/about"
              className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center flex-shrink-0">
                <Heart className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-purple-400">About Us</div>
                <div className="text-[10px] text-slate-400">Story & Manifesto</div>
              </div>
            </Link>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20"
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
