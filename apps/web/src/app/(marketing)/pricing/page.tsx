"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  Check,
  Sparkles,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { BackgroundGradient } from "@/components/ui/aceternity/background-gradient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
        "Neon PostgreSQL Serverless Database Security",
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
        "100 GB Cloudinary Deliverable Storage",
        "Automated Invoice Chasing via Brevo Integration",
        "Comprehensive P&L Profitability Analytics",
        "Direct 24/7 Priority Discord & Email Support",
      ],
    },
  ];

  const faqs = [
    {
      q: "Is the Free plan really free forever?",
      a: "Yes! Because Freelance Book is architected on Neon PostgreSQL serverless SQL and lightweight cloud infrastructure, our marginal database and compute costs are exceptionally low. We pass these savings directly to solo freelancers.",
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
    <div className="min-h-screen bg-bg text-fg flex flex-col selection:bg-accent selection:text-accent-fg">
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
              <Badge variant="emerald" className="px-4 py-1.5 text-xs font-semibold gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Simple, Transparent Pricing
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-3xl sm:text-5xl font-bold text-fg tracking-tight leading-tight max-w-4xl mx-auto mb-6"
            >
              Start 100% Free.{" "}
              <span className="italic font-medium text-accent">
                Upgrade only when you scale.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-[15px] text-muted max-w-3xl mx-auto mb-10 leading-relaxed font-normal"
            >
              No hidden fees, no credit cards required to start. Built on Neon PostgreSQL serverless database technology.
            </motion.p>
          </div>
        </section>

        {/* Pricing Cards Grid with BackgroundGradient & shadcn Card */}
        <section className="py-20 bg-bg">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              {plans.map((plan, idx) => {
                if (plan.isPro) {
                  return (
                    <BackgroundGradient
                      key={idx}
                      className="rounded-xl p-8 sm:p-10 bg-bg h-full flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-2xl font-bold text-fg">{plan.name}</h3>
                          <Badge variant={plan.badgeVariant} className="text-xs font-semibold">
                            {plan.badge}
                          </Badge>
                        </div>

                        <div className="flex items-baseline gap-1 mb-4">
                          <span className="font-display text-3xl sm:text-5xl font-bold text-fg tracking-tight">
                            {plan.price}
                          </span>
                          <span className="text-sm text-muted font-medium">/{plan.period}</span>
                        </div>

                        <p className="text-sm text-muted mb-8 leading-relaxed font-normal">
                          {plan.description}
                        </p>

                        <div className="space-y-3 pt-6 border-t border-line mb-8">
                          {plan.features.map((feat, fIdx) => (
                            <div key={fIdx} className="flex items-center gap-3 text-xs text-fg">
                              <Check className="w-4 h-4 text-accent flex-shrink-0" />
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Link href={plan.ctaLink}>
                        <Button variant={plan.buttonVariant} size="lg" className="w-full rounded-xl font-bold py-6">
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
                    className="p-8 sm:p-10 bg-card border-line backdrop-blur-2xl flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-bold text-fg">{plan.name}</h3>
                        <Badge variant={plan.badgeVariant} className="text-xs font-semibold">
                          {plan.badge}
                        </Badge>
                      </div>

                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="font-display text-3xl sm:text-5xl font-bold text-fg tracking-tight">
                          {plan.price}
                        </span>
                        <span className="text-sm text-muted font-medium">/{plan.period}</span>
                      </div>

                      <p className="text-sm text-muted mb-8 leading-relaxed font-normal">
                        {plan.description}
                      </p>

                      <div className="space-y-3 pt-6 border-t border-line mb-8">
                        {plan.features.map((feat, fIdx) => (
                          <div key={fIdx} className="flex items-center gap-3 text-xs text-fg">
                            <Check className="w-4 h-4 text-accent flex-shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Link href={plan.ctaLink}>
                      <Button variant={plan.buttonVariant} size="lg" className="w-full rounded-xl font-bold py-6">
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
                <h3 className="text-2xl sm:text-3xl font-extrabold text-fg">
                  Frequently Asked Questions
                </h3>
                <p className="text-muted text-sm mt-2">
                  Everything you need to know about Freelance Book OS.
                </p>
              </div>

              <div className="space-y-4">
                {faqs.map((faq, idx) => (
                  <Card
                    key={idx}
                    className="p-6 bg-card border-line"
                  >
                    <h4 className="text-base font-bold text-fg mb-2 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>{faq.q}</span>
                    </h4>
                    <p className="text-sm text-muted leading-relaxed font-normal pl-6">
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
