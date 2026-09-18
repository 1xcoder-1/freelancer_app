"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  Check,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Clock,
  Layers,
  Users,
} from "lucide-react";
import { Spotlight } from "@/components/ui/aceternity/spotlight";
import { BackgroundGradient } from "@/components/ui/aceternity/background-gradient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function PricingPage() {
  const plans = [
    {
      name: "Freelance Book Core",
      badge: "100% Free Forever",
      badgeVariant: "emerald" as const,
      price: "$0",
      period: "forever",
      description: "Everything a solo freelancer, consultant, or independent creator needs to operate their full business.",
      cta: "Get Started Free",
      ctaLink: "/sign-up",
      buttonVariant: "default" as const,
      isPro: false,
      features: [
        "Unlimited Clients & Contact CRM",
        "Multi-View Project Boards (Kanban, List, Calendar)",
        "One-Click Time & Pomodoro Tracking",
        "PDF Invoice Generation & Expense Tracking",
        "Windows Desktop Quick Capture (Ctrl+Shift+F)",
        "Android Companion App Sync",
        "Cloudflare D1 Serverless Database Security",
        "Up to 50 Book AI Queries / Month",
      ],
    },
    {
      name: "Freelance Book Pro",
      badge: "Power Freelancers",
      badgeVariant: "indigo" as const,
      price: "$12",
      period: "per month",
      description: "Advanced AI insights, unlimited file deliverable storage, custom domain client portals, and priority support.",
      cta: "Start 14-Day Pro Trial",
      ctaLink: "/sign-up",
      buttonVariant: "indigo" as const,
      isPro: true,
      features: [
        "Everything in Free Core OS",
        "Unlimited Book AI Copilot Queries",
        "Custom Domain for Client Portals (portal.yourbrand.com)",
        "Automated Multi-Currency Invoicing & Tax Rules",
        "100 GB Cloudflare R2 Deliverable Edge Storage",
        "Automated Invoice Chasing via Brevo Integration",
        "Comprehensive P&L Profitability Analytics",
        "Direct 24/7 Priority Discord & Email Support",
      ],
    },
  ];

  const faqs = [
    {
      q: "Is the Free plan really free forever?",
      a: "Yes! Because Freelance Book is architected on Cloudflare D1 serverless SQL and lightweight edge infrastructure, our marginal database and compute costs are exceptionally low. We pass these savings directly to solo freelancers.",
    },
    {
      q: "Do I need a credit card to sign up?",
      a: "No credit card is required. You can sign up with your email or social account via Clerk and immediately start managing clients, tracking time, and generating invoices.",
    },
    {
      q: "How does the Windows Quick Capture work?",
      a: "Our Electron desktop application registers a global shortcut (Ctrl+Shift+F). When pressed from anywhere on your PC, a minimalist modal opens instantly to log a task, note, or timer without disturbing your current window.",
    },
    {
      q: "Can I export all my data if I ever leave?",
      a: "Absolutely. You own 100% of your data. You can export complete JSON or CSV dumps of all clients, projects, time entries, and financial records at any time.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section with Aceternity Spotlight */}
        <section className="relative pt-20 pb-16 overflow-hidden border-b border-slate-900 bg-gradient-to-b from-slate-950 via-slate-900/30 to-slate-950">
          <Spotlight className="-top-30 left-10 md:left-1/3" fill="rgba(16, 185, 129, 0.2)" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex mb-6"
            >
              <Badge variant="emerald" className="px-4 py-1.5 text-xs font-semibold gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Simple, Transparent Pricing
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto mb-6"
            >
              Start 100% Free.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">
                Upgrade only when you scale.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-normal"
            >
              No hidden fees, no credit cards required to start. Built on Cloudflare D1 serverless database technology.
            </motion.p>
          </div>
        </section>

        {/* Pricing Cards Grid with BackgroundGradient & shadcn Card */}
        <section className="py-20 bg-slate-950">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              {plans.map((plan, idx) => {
                if (plan.isPro) {
                  return (
                    <BackgroundGradient
                      key={idx}
                      className="rounded-3xl p-8 sm:p-10 bg-slate-950 h-full flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                          <Badge variant={plan.badgeVariant} className="text-xs font-semibold">
                            {plan.badge}
                          </Badge>
                        </div>

                        <div className="flex items-baseline gap-1 mb-4">
                          <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                            {plan.price}
                          </span>
                          <span className="text-sm text-slate-400 font-medium">/{plan.period}</span>
                        </div>

                        <p className="text-sm text-slate-400 mb-8 leading-relaxed font-normal">
                          {plan.description}
                        </p>

                        <div className="space-y-3 pt-6 border-t border-slate-800/80 mb-8">
                          {plan.features.map((feat, fIdx) => (
                            <div key={fIdx} className="flex items-center gap-3 text-xs text-slate-200">
                              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Link href={plan.ctaLink}>
                        <Button variant={plan.buttonVariant} size="lg" className="w-full rounded-2xl font-bold py-6">
                          <span>{plan.cta}</span>
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </BackgroundGradient>
                  );
                }

                return (
                  <Card
                    key={idx}
                    className="p-8 sm:p-10 bg-slate-900/60 border-slate-800/80 backdrop-blur-2xl flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                        <Badge variant={plan.badgeVariant} className="text-xs font-semibold">
                          {plan.badge}
                        </Badge>
                      </div>

                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                          {plan.price}
                        </span>
                        <span className="text-sm text-slate-400 font-medium">/{plan.period}</span>
                      </div>

                      <p className="text-sm text-slate-400 mb-8 leading-relaxed font-normal">
                        {plan.description}
                      </p>

                      <div className="space-y-3 pt-6 border-t border-slate-800/80 mb-8">
                        {plan.features.map((feat, fIdx) => (
                          <div key={fIdx} className="flex items-center gap-3 text-xs text-slate-200">
                            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Link href={plan.ctaLink}>
                      <Button variant={plan.buttonVariant} size="lg" className="w-full rounded-2xl font-bold py-6">
                        <span>{plan.cta}</span>
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </Card>
                );
              })}
            </div>

            {/* FAQ Section with shadcn Card */}
            <div className="mt-24 max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Frequently Asked Questions
                </h3>
                <p className="text-slate-400 text-sm mt-2">
                  Everything you need to know about Freelance Book OS.
                </p>
              </div>

              <div className="space-y-4">
                {faqs.map((faq, idx) => (
                  <Card
                    key={idx}
                    className="p-6 bg-slate-900/40 border-slate-800/80"
                  >
                    <h4 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>{faq.q}</span>
                    </h4>
                    <p className="text-sm text-slate-400 leading-relaxed font-normal pl-6">
                      {faq.a}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
