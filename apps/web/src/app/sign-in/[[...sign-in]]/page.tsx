import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Sparkles, ArrowLeft } from "lucide-react";
import { Spotlight } from "@/components/ui/aceternity/spotlight";
import { Badge } from "@/components/ui/badge";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row relative overflow-hidden selection:bg-emerald-500 selection:text-slate-950">
      <Spotlight className="-top-30 left-0 md:left-1/4" fill="rgba(16, 185, 129, 0.2)" />

      {/* Left Column: Product Branding & Features Highlights */}
      <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-900 bg-slate-950/60 backdrop-blur-xl z-10">
        <div>
          {/* Back Link & Brand Logo */}
          <div className="flex items-center justify-between mb-12">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-xs">
                FB
              </div>
              <span className="font-extrabold text-sm text-white tracking-tight">Freelance Book</span>
            </div>
          </div>

          <div className="max-w-md">
            <div className="inline-flex mb-6">
              <Badge variant="emerald" className="px-3.5 py-1 text-xs font-semibold gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Identity & Security
              </Badge>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
              Welcome back to your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Freelancer Operating System
              </span>
            </h1>

            <p className="text-sm text-slate-400 leading-relaxed mb-8 font-normal">
              Log in to sync projects, view active focus timers, review pending client invoices, and query Book AI.
            </p>

            {/* Feature Bullets */}
            <div className="space-y-3">
              {[
                "Instant time tracking across Web, Desktop & Android",
                "Cloudflare D1 serverless database security",
                "Automated invoice calculations & financial reports",
              ].map((text, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs font-medium text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Security Notice */}
        <div className="mt-12 pt-6 border-t border-slate-900 flex items-center gap-2 text-xs text-slate-500 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Secured by Clerk Identity & Encrypted JWT Bearer Tokens</span>
        </div>
      </div>

      {/* Right Column: Custom Clerk SignIn Component */}
      <div className="w-full lg:w-1/2 p-6 sm:p-12 flex items-center justify-center z-10 my-auto">
        <SignIn
          routing="path"
          path="/sign-in"
          appearance={{
            elements: {
              card: "bg-slate-900/90 backdrop-blur-2xl border border-slate-800 shadow-2xl text-slate-100 p-8 rounded-3xl w-full max-w-md",
              headerTitle: "text-white font-extrabold text-2xl tracking-tight",
              headerSubtitle: "text-slate-400 text-sm",
              socialButtonsBlockButton: "bg-slate-950 border border-slate-800 text-slate-200 hover:bg-slate-800 transition-all rounded-xl",
              formButtonPrimary: "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all rounded-xl py-3 shadow-lg shadow-emerald-500/20",
              footerActionLink: "text-emerald-400 hover:text-emerald-300 font-semibold",
              formFieldLabel: "text-slate-300 font-medium text-xs",
              formFieldInput: "bg-slate-950 border-slate-800 text-white focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl",
              dividerLine: "bg-slate-800",
              dividerText: "text-slate-500 text-xs font-mono",
            },
          }}
        />
      </div>
    </div>
  );
}
