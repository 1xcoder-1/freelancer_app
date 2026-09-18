import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { CheckCircle2, Zap, ArrowLeft, Rocket } from "lucide-react";
import { Spotlight } from "@/components/ui/aceternity/spotlight";
import { Badge } from "@/components/ui/badge";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      <Spotlight className="-top-30 right-0 md:right-1/4" fill="rgba(99, 102, 241, 0.25)" />

      {/* Left Column: Product Branding & Registration Benefits */}
      <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-900 bg-slate-950/60 backdrop-blur-xl z-10">
        <div>
          {/* Back Link & Brand Logo */}
          <div className="flex items-center justify-between mb-12">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white text-xs">
                FB
              </div>
              <span className="font-extrabold text-sm text-white tracking-tight">Freelance Book</span>
            </div>
          </div>

          <div className="max-w-md">
            <div className="inline-flex mb-6">
              <Badge variant="indigo" className="px-3.5 py-1 text-xs font-semibold gap-2">
                <Rocket className="w-3.5 h-3.5" /> Free Account Creation
              </Badge>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
              Get Started with <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-teal-300 to-emerald-400">
                Freelance Book OS
              </span>
            </h1>

            <p className="text-sm text-slate-400 leading-relaxed mb-8 font-normal">
              Join thousands of independent freelancers managing projects, CRM, invoices, time tracking, and AI priorities in one place.
            </p>

            {/* Registration Benefit Cards */}
            <div className="space-y-3">
              {[
                "100% Free Core Plan (Cloudflare D1 & R2 Edge infrastructure)",
                "Full Client CRM, Kanban, Timeline & Milestone tracking",
                "Built-in Book AI Assistant & PDF Invoice Generator",
              ].map((text, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs font-medium text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Notice */}
        <div className="mt-12 pt-6 border-t border-slate-900 flex items-center gap-2 text-xs text-slate-500 font-mono">
          <Zap className="w-4 h-4 text-indigo-400" />
          <span>No Credit Card Required • Instant Workspace Setup</span>
        </div>
      </div>

      {/* Right Column: Custom Clerk SignUp Component */}
      <div className="w-full lg:w-1/2 p-6 sm:p-12 flex items-center justify-center z-10 my-auto">
        <SignUp
          routing="path"
          path="/sign-up"
          appearance={{
            elements: {
              card: "bg-slate-900/90 backdrop-blur-2xl border border-slate-800 shadow-2xl text-slate-100 p-8 rounded-3xl w-full max-w-md",
              headerTitle: "text-white font-extrabold text-2xl tracking-tight",
              headerSubtitle: "text-slate-400 text-sm",
              socialButtonsBlockButton: "bg-slate-950 border border-slate-800 text-slate-200 hover:bg-slate-800 transition-all rounded-xl",
              formButtonPrimary: "bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition-all rounded-xl py-3 shadow-lg shadow-indigo-500/20",
              footerActionLink: "text-indigo-400 hover:text-indigo-300 font-semibold",
              formFieldLabel: "text-slate-300 font-medium text-xs",
              formFieldInput: "bg-slate-950 border-slate-800 text-white focus:border-indigo-500 focus:ring-indigo-500/20 rounded-xl",
              dividerLine: "bg-slate-800",
              dividerText: "text-slate-500 text-xs font-mono",
            },
          }}
        />
      </div>
    </div>
  );
}
