"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  Sparkles,
  Bot,
  Zap,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { SparklesCore } from "@/components/ui/aceternity/sparkles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function BookAIPage() {
  const [selectedPromptIndex, setSelectedPromptIndex] = useState(0);

  const demoScenarios = [
    {
      title: "Auto-Generate Project Scope & Milestones",
      category: "Project Planning",
      badgeVariant: "indigo" as const,
      prompt: "I have a new client who wants a Next.js 16 e-commerce store with Stripe Checkout and Cloudflare R2 image uploads. Draft a 3-milestone project plan with estimated hours and pricing at $95/hr.",
      response: `### 🎯 Project Proposal & Milestone Plan: Next.js 16 E-Commerce Store

**Total Estimated Hours:** 45 Hours  
**Target Rate:** $95.00 / Hour  
**Total Proposed Budget:** $4,275.00  

---

#### 📌 Milestone 1: Architecture & UI Scaffolding ($1,425.00)
- Next.js 16 App Router setup with Tailwind CSS v4 design system
- Product catalog grid, filter drawer, and dynamic responsive layouts
- **Estimated Effort:** 15 Hours

#### 📌 Milestone 2: Cloudflare R2 Asset Pipeline & Cart ($1,425.00)
- Cloudflare R2 bucket integration for fast product image uploads
- Persistent shopping cart with optimistic UI updates
- **Estimated Effort:** 15 Hours

#### 📌 Milestone 3: Stripe Checkout & Testing ($1,425.00)
- Stripe Elements checkout flow with webhook handlers for order fulfillment
- End-to-end testing, invoice generation, and production deployment
- **Estimated Effort:** 15 Hours`,
    },
    {
      title: "Draft Courteous Overdue Invoice Reminder",
      category: "Client Communication",
      badgeVariant: "amber" as const,
      prompt: "Invoice #INV-2026-089 for $2,800.00 to Acme Corp is 7 days overdue. Draft a professional, friendly reminder email with payment link.",
      response: `**Subject:** Friendly Follow-Up: Invoice #INV-2026-089 for Acme Corp

Hi Sarah,

I hope you're having a productive week!

I'm checking in regarding invoice **#INV-2026-089** for **$2,800.00** (Full-Stack Web Replatforming), which was due on September 11, 2026.

For your convenience, you can review the invoice details and complete payment directly via the secure portal link below:
👉 [Pay Invoice #INV-2026-089 Securely](https://freelance-book.app/portal/acme/pay)

If payment has already been scheduled from your accounts department, please disregard this note. Let me know if you need any additional tax documentation or PO adjustments!

Best regards,  
Alex Rivers | Freelance Engineer`,
    },
    {
      title: "Effective Hourly Rate & Profitability Audit",
      category: "Financial Analytics",
      badgeVariant: "emerald" as const,
      prompt: "Analyze my last 3 projects: Project Alpha (Fixed $5,000, 62 hours), Project Beta (Hourly $85/hr, 40 hours), and Project Gamma (Fixed $2,500, 18 hours). What is my real effective rate?",
      response: `### 📊 Real Effective Hourly Rate (EHR) Breakdown

1. **Project Alpha (Fixed Price):**
   - Revenue: $5,000.00 | Tracked Hours: 62.0 hrs
   - **Effective Hourly Rate:** **$80.64 / hr** *(Scope creep reduced initial target)*

2. **Project Beta (Hourly Retainer):**
   - Revenue: $3,400.00 | Tracked Hours: 40.0 hrs
   - **Effective Hourly Rate:** **$85.00 / hr** *(Exact target matched)*

3. **Project Gamma (Fixed Price):**
   - Revenue: $2,500.00 | Tracked Hours: 18.0 hrs
   - **Effective Hourly Rate:** **$138.89 / hr** *(High efficiency result)*

---
**💡 Book AI Strategic Recommendation:**  
Your weighted average EHR is **$91.66 / hr**. Fixed-price projects with tight scoping (like Gamma) yielded **+63% higher returns** than your baseline hourly billing. Consider standardizing a minimum $120/hr floor for future fixed bids.`,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section with Sparkles Particles */}
        <section className="relative pt-20 pb-16 overflow-hidden border-b border-slate-900 bg-gradient-to-b from-slate-950 via-indigo-950/20 to-slate-950">
          <div className="absolute inset-0 w-full h-full pointer-events-none -z-10">
            <SparklesCore
              id="aiSparkles"
              background="transparent"
              minSize={0.6}
              maxSize={1.8}
              particleDensity={50}
              particleColor="#818cf8"
              speed={0.8}
            />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex mb-6"
            >
              <Badge variant="indigo" className="px-4 py-1.5 text-xs font-semibold gap-2">
                <Bot className="w-3.5 h-3.5" /> Context-Aware AI Copilot
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto mb-6"
            >
              Meet <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-teal-300 to-emerald-400">Book AI</span>.{" "}
              Your 24/7 Strategic Freelance Partner.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-normal"
            >
              Eliminate administrative fatigue. Book AI understands your active clients, tracked time, milestones, and invoice history to draft proposals and analyze profitability.
            </motion.p>
          </div>
        </section>

        {/* Live Interactive AI Playground Showcase with shadcn Card & Button */}
        <section className="py-20 bg-slate-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="rounded-3xl border-slate-800/80 bg-slate-900/60 backdrop-blur-2xl shadow-2xl p-6 sm:p-10">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Left Selector Column */}
                <div className="w-full lg:w-1/3 space-y-3">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">
                    Select a Prompt Scenario:
                  </div>
                  {demoScenarios.map((scen, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPromptIndex(idx)}
                      className={`w-full p-4 rounded-2xl text-left transition-all border cursor-pointer ${
                        selectedPromptIndex === idx
                          ? "bg-indigo-500/15 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant={scen.badgeVariant} className="text-[10px] px-2 py-0">
                          {scen.category}
                        </Badge>
                      </div>
                      <div className="text-sm font-bold leading-snug text-white mt-1">
                        {scen.title}
                      </div>
                    </button>
                  ))}

                  <div className="pt-4 mt-6 border-t border-slate-800 text-xs text-slate-400 font-mono flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span>Workspace-isolated LLM queries</span>
                  </div>
                </div>

                {/* Right Interactive Output Window */}
                <div className="w-full lg:w-2/3 flex flex-col justify-between rounded-2xl bg-slate-950 border border-slate-800 p-6">
                  <div>
                    {/* User Prompt Box */}
                    <div className="mb-6 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-2">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Freelancer Input:</span>
                      </div>
                      <p className="text-sm text-slate-200 font-normal leading-relaxed">
                        &ldquo;{demoScenarios[selectedPromptIndex].prompt}&rdquo;
                      </p>
                    </div>

                    {/* AI Output Stream */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                        <span>Book AI Generated Output:</span>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 text-xs sm:text-sm text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                        {demoScenarios[selectedPromptIndex].response}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Gemini 2.5 Flash / OpenAI 4o Multi-Model</span>
                    <Link href="/sign-up">
                      <Button variant="indigo" size="sm" className="rounded-xl font-bold">
                        <span>Try with Your Projects</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
