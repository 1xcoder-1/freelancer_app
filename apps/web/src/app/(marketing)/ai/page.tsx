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
      prompt: "I have a new client who wants a Next.js 16 e-commerce store with Stripe Checkout and Cloudinary image uploads. Draft a 3-milestone project plan with estimated hours and pricing at $95/hr.",
      response: `### 🎯 Project Proposal & Milestone Plan: Next.js 16 E-Commerce Store

**Total Estimated Hours:** 45 Hours  
**Target Rate:** $95.00 / Hour  
**Total Proposed Budget:** $4,275.00  

---

#### 📌 Milestone 1: Architecture & UI Scaffolding ($1,425.00)
- Next.js 16 App Router setup with Tailwind CSS v4 design system
- Product catalog grid, filter drawer, and dynamic responsive layouts
- **Estimated Effort:** 15 Hours

#### 📌 Milestone 2: Cloudinary Asset Pipeline & Cart ($1,425.00)
- Cloudinary bucket integration for fast product image uploads
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
    <div className="min-h-screen bg-bg text-fg flex flex-col selection:bg-accent selection:text-fg">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-20 pb-16 overflow-hidden border-b border-line bg-bg">
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
              className="font-display text-3xl sm:text-5xl font-bold text-fg tracking-tight leading-tight max-w-4xl mx-auto mb-6"
            >
              Meet <span className="italic font-medium text-accent">Book AI</span>.{" "}
              Your 24/7 Strategic Freelance Partner.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-[15px] text-muted max-w-3xl mx-auto mb-10 leading-relaxed font-normal"
            >
              Eliminate administrative fatigue. Book AI understands your active clients, tracked time, milestones, and invoice history to draft proposals and analyze profitability.
            </motion.p>
          </div>
        </section>

        {/* Live Interactive AI Playground Showcase with shadcn Card & Button */}
        <section className="py-20 bg-bg">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="rounded-xl border-line bg-card backdrop-blur-2xl shadow-2xl p-6 sm:p-10">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Left Selector Column */}
                <div className="w-full lg:w-1/3 space-y-3">
                  <div className="text-xs font-bold text-muted uppercase tracking-wider font-mono mb-2">
                    Select a Prompt Scenario:
                  </div>
                  {demoScenarios.map((scen, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPromptIndex(idx)}
                      className={`w-full p-4 rounded-xl text-left transition-all border cursor-pointer ${
                        selectedPromptIndex === idx
                          ? "bg-info/15 border-info/50 text-fg shadow-sm"
                          : "bg-bg border-line text-muted hover:border-line-strong hover:text-fg"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant={scen.badgeVariant} className="text-[10px] px-2 py-0">
                          {scen.category}
                        </Badge>
                      </div>
                      <div className="text-sm font-bold leading-snug text-fg mt-1">
                        {scen.title}
                      </div>
                    </button>
                  ))}

                  <div className="pt-4 mt-6 border-t border-line text-xs text-muted font-mono flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-info dark:text-info" />
                    <span>Workspace-isolated LLM queries</span>
                  </div>
                </div>

                {/* Right Interactive Output Window */}
                <div className="w-full lg:w-2/3 flex flex-col justify-between rounded-xl bg-bg border border-line p-6">
                  <div>
                    {/* User Prompt Box */}
                    <div className="mb-6 p-4 rounded-xl bg-card border border-line">
                      <div className="flex items-center gap-2 text-xs font-mono text-muted mb-2">
                        <MessageSquare className="w-3.5 h-3.5 text-info dark:text-info" />
                        <span>Freelancer Input:</span>
                      </div>
                      <p className="text-sm text-fg font-normal leading-relaxed">
                        &ldquo;{demoScenarios[selectedPromptIndex].prompt}&rdquo;
                      </p>
                    </div>

                    {/* AI Output Stream */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-mono text-accent">
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                        <span>Book AI Generated Output:</span>
                      </div>

                      <div className="p-4 rounded-xl bg-card border border-line text-xs sm:text-sm text-fg font-mono whitespace-pre-wrap leading-relaxed">
                        {demoScenarios[selectedPromptIndex].response}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-line flex items-center justify-between">
                    <span className="text-xs text-muted">Gemini 2.5 Flash / OpenAI 4o Multi-Model</span>
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
