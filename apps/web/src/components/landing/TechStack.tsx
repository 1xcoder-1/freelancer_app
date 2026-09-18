"use client";

import { motion } from "framer-motion";
import { Cpu, Database, Key, Server, Zap, Shield, ArrowUpRight } from "lucide-react";
import { BackgroundGradient } from "@/components/ui/aceternity/background-gradient";
import { Meteors } from "@/components/ui/aceternity/meteors";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import Link from "next/link";

export function TechStack() {
  const stack = [
    {
      name: "Clerk Auth",
      role: "Authentication & Identity",
      desc: "Handles user signup, login, session JWT tokens, password resets, and multi-tenant organization boundaries.",
      icon: Key,
      badge: "Auth as a Service",
      badgeVariant: "emerald" as const,
      featured: true,
    },
    {
      name: "Python FastAPI",
      role: "High-Performance Backend",
      desc: "Python 3.12+ async REST API handling business logic, Pydantic v2 data validation, AI orchestration, and WebSockets.",
      icon: Server,
      badge: "Python 3.12+",
      badgeVariant: "indigo" as const,
      featured: true,
    },
    {
      name: "Cloudflare D1",
      role: "Serverless SQL Database",
      desc: "Cloudflare D1 edge SQL database storing all users, workspace memberships, clients, projects, tasks, and financials.",
      icon: Database,
      badge: "Edge Serverless DB",
      badgeVariant: "cyan" as const,
      featured: true,
    },
    {
      name: "SQLAlchemy 2.0",
      role: "Async Python ORM",
      desc: "Executes inside FastAPI to manage database models, high-performance async queries, connections, and migrations.",
      icon: Cpu,
      badge: "Async ORM",
      badgeVariant: "amber" as const,
    },
    {
      name: "Cloudflare R2",
      role: "Edge File & Asset Storage",
      desc: "S3-compatible object storage with zero egress fees for client deliverables, invoice PDFs, and signed contracts.",
      icon: Shield,
      badge: "S3 Compatible",
      badgeVariant: "default" as const,
    },
    {
      name: "Upstash Redis",
      role: "Serverless Cache & Rate Limits",
      desc: "Ultra-fast Redis store for caching API queries, token bucket rate-limiting endpoints, and distributed state.",
      icon: Zap,
      badge: "Sub-ms Redis",
      badgeVariant: "indigo" as const,
    },
  ];

  return (
    <section id="architecture" className="py-24 border-t border-slate-900 bg-slate-950 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <div className="inline-flex mb-3">
            <Badge variant="indigo" className="px-3.5 py-1 text-xs uppercase tracking-wider font-bold">
              Production Blueprint
            </Badge>
          </div>
          <h3 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Free-First, High-Performance Tech Architecture
          </h3>
          <p className="text-slate-400 text-base sm:text-lg mt-4 font-normal">
            Engineered with Cloudflare D1 serverless SQL database, Clerk authentication, Python FastAPI async backend, and shared React UI design system.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stack.map((item, idx) => {
            const Icon = item.icon;
            if (item.featured) {
              return (
                <BackgroundGradient key={idx} className="rounded-3xl p-6 bg-slate-950 h-full relative overflow-hidden flex flex-col justify-between">
                  <Meteors number={12} />
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-inner">
                        <Icon className="w-5 h-5" />
                      </div>
                      <Badge variant={item.badgeVariant} className="text-[10px]">
                        {item.badge}
                      </Badge>
                    </div>

                    <h4 className="text-xl font-bold text-white mb-1 group-hover:text-indigo-300 transition-colors">
                      {item.name}
                    </h4>
                    <div className="text-xs font-semibold text-emerald-400 mb-3">{item.role}</div>
                    <p className="text-sm text-slate-400 leading-relaxed font-normal">{item.desc}</p>
                  </div>
                </BackgroundGradient>
              );
            }

            return (
              <Card key={idx} className="bg-slate-900/50 border-slate-800/80 hover:border-slate-700 transition-all p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <Badge variant={item.badgeVariant} className="text-[10px]">
                      {item.badge}
                    </Badge>
                  </div>

                  <h4 className="text-xl font-bold text-white mb-1">{item.name}</h4>
                  <div className="text-xs font-semibold text-emerald-400 mb-3">{item.role}</div>
                  <p className="text-sm text-slate-400 leading-relaxed font-normal">{item.desc}</p>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/architecture"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <span>Read full multi-tier architecture & database schema specification</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
