"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  Heart,
  Sparkles,
  ShieldCheck,
  Zap,
  Users,
  Compass,
  Code2,
  Lock,
  ArrowRight,
  Target,
  CheckCircle2,
  Globe,
  Award,
} from "lucide-react";
import { Spotlight } from "@/components/ui/aceternity/spotlight";
import { Meteors } from "@/components/ui/aceternity/meteors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function AboutPage() {
  const values = [
    {
      icon: Target,
      title: "Built Specifically for Solo Freelancers",
      desc: "Enterprise project management tools are cluttered with corporate bureaucracy. Freelance Book is streamlined strictly for individual contractors, consultants, and creators.",
      badge: "Targeted",
      badgeVariant: "emerald" as const,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      icon: Zap,
      title: "Free-First Serverless Economics",
      desc: "By engineering our platform on Cloudflare D1 serverless SQL and Python FastAPI, our marginal infrastructure costs are near zero. We pass these savings directly to you with a free core plan forever.",
      badge: "Free-First",
      badgeVariant: "indigo" as const,
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    },
    {
      icon: Lock,
      title: "Total Data Sovereignty & Privacy",
      desc: "You own 100% of your client relationships, invoices, and work history. No vendor lock-in. Full JSON/CSV export at any time with encrypted JWT security.",
      badge: "Private",
      badgeVariant: "cyan" as const,
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    },
    {
      icon: Globe,
      title: "Unified Cross-Platform Flow",
      desc: "Stay in your creative flow. Access your business via high-performance Next.js 16 Web, instant Windows Quick Capture (Ctrl+Shift+F), or Android mobile sync.",
      badge: "Multi-Platform",
      badgeVariant: "amber" as const,
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    },
  ];

  const milestones = [
    {
      year: "The Problem",
      title: "6 Disconnected SaaS Subscriptions",
      desc: "Freelancers were forced to juggle Trello for boards, Toggl for time tracking, FreshBooks for invoices, Notion for client notes, and ChatGPT in a separate tab—paying $150+/month.",
    },
    {
      year: "The Vision",
      title: "One Unified Operating System",
      desc: "We set out to engineer a single, cohesive operating system that unifies CRM, project views, Pomodoro focus, PDF billing, and AI reasoning in one blazing-fast interface.",
    },
    {
      year: "The Architecture",
      title: "Modern Edge & Python Stack",
      desc: "Leveraged Cloudflare D1 serverless database, Python 3.12+ FastAPI async backend, Clerk authentication, and React shared components for sub-millisecond responsiveness.",
    },
    {
      year: "Today",
      title: "Freelance Book 1.0 OS",
      desc: "A production-grade, community-driven platform empowering independent freelancers worldwide to run profitable, organized, and stress-free businesses.",
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
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" /> Our Mission & Story
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto mb-6"
            >
              Built by Freelancers,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">
                for Independent Creators.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-normal"
            >
              We believe independent work is the future of the global economy. Freelancers shouldn't need a bloated suite of expensive tools to run a world-class business.
            </motion.p>
          </div>
        </section>

        {/* Core Values Section with shadcn Card */}
        <section className="py-20 bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <div className="inline-flex mb-3">
                <Badge variant="emerald" className="px-3.5 py-1 text-xs uppercase tracking-wider font-bold">
                  Core Philosophy
                </Badge>
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                What drives every line of code we write
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {values.map((val, idx) => {
                const Icon = val.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                  >
                    <Card className="h-full p-8 bg-slate-900/40 border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between shadow-xl">
                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${val.color}`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <Badge variant={val.badgeVariant} className="text-xs">
                            {val.badge}
                          </Badge>
                        </div>
                        <h4 className="text-xl font-bold text-white mb-3">{val.title}</h4>
                        <p className="text-sm text-slate-400 leading-relaxed font-normal">
                          {val.desc}
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Story & Evolution Timeline with shadcn Card */}
        <section className="py-20 bg-slate-900/30 border-y border-slate-900">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <div className="inline-flex mb-3">
                <Badge variant="indigo" className="px-3.5 py-1 text-xs uppercase tracking-wider font-bold">
                  The Journey
                </Badge>
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Why Freelance Book OS exists
              </h3>
            </div>

            <div className="space-y-6">
              {milestones.map((m, idx) => (
                <Card
                  key={idx}
                  className="p-6 sm:p-8 bg-slate-900/70 border-slate-800 flex flex-col sm:flex-row gap-6 items-start"
                >
                  <Badge variant="emerald" className="px-4 py-2 rounded-xl text-xs font-mono font-bold flex-shrink-0">
                    {m.year}
                  </Badge>
                  <div>
                    <h4 className="text-lg font-bold text-white mb-2">{m.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed font-normal">
                      {m.desc}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Manifesto Banner with Aceternity Meteors */}
        <section className="py-24 bg-slate-950 relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="p-8 sm:p-12 rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950 shadow-2xl relative overflow-hidden">
              <Meteors number={15} />
              <div className="relative z-10">
                <Sparkles className="w-8 h-8 text-emerald-400 mx-auto mb-4" />
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
                  The Freelancer Manifesto
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto mb-8 font-normal">
                  &ldquo;You don't need a team of 50 to create massive value. You need clear priorities, automatic time capture, transparent client trust, and software that gets out of your way.&rdquo;
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link href="/sign-up">
                    <Button size="lg" className="px-8 py-6 font-bold text-sm rounded-xl shadow-xl shadow-emerald-500/25">
                      <span>Join Freelance Book OS Free</span>
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/features">
                    <Button variant="outline" size="lg" className="px-8 py-6 font-semibold text-sm rounded-xl">
                      Explore All Modules
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
