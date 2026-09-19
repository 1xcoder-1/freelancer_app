"use client";

import React, { useState, useEffect } from "react";
import { getMyPortfolio, PortfolioProfile } from "@/lib/api";
import { ReportCard } from "./ReportCard";

const DEFAULT_PROFILE: PortfolioProfile = {
  username: "1xcoder",
  full_name: "Abdullah Ramzan",
  avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&h=400&q=80",
  headline: "Full-Stack Software Engineer & AI Systems Architect",
  bio: "Building high-performance SaaS applications, distributed backends, and AI workflows. Specializing in Next.js, FastAPI, PostgreSQL, and scalable cloud architectures.",
  rank: "255,885",
  rank_percentile: "Top 1% React & FastAPI Engineer",
  following: 0,
  followers: 1420,
  location: "Islamabad, Pakistan (Remote Worldwide)",
  organization: "1xcoder Labs / FAST-NUCES",
  website_url: "https://1xcoder.vercel.app",
  github_url: "https://github.com/1xcoder-1",
  twitter_url: "https://twitter.com/11xcoder",
  linkedin_url: "https://linkedin.com/in/abdullah3333",
  discord_handle: "1xcoder#0001",
  tags: ["Full-Stack", "Next.js 16", "FastAPI", "Python", "TypeScript", "PostgreSQL"],
  hourly_rate: 85.0,
  views_count: 2420,
  solutions_count: 38,
  discuss_count: 14,
  reputation_score: 4980,
  active_days_count: 142,
  current_streak: 14,
  max_streak: 36,
  languages: [
    { language: "TypeScript", solved_count: 145, projects_count: 38 },
    { language: "Python", solved_count: 120, projects_count: 28 },
    { language: "JavaScript", solved_count: 199, projects_count: 42 },
    { language: "SQL & Rust", solved_count: 45, projects_count: 12 },
  ],
  skills: {
    advanced: [
      { name: "Full-Stack Web Architecture", count: 45 },
      { name: "FastAPI & AsyncIO Microservices", count: 36 },
      { name: "Next.js App Router & RSC", count: 42 },
      { name: "Database Design & Indexing", count: 28 },
    ],
    intermediate: [
      { name: "Tailwind CSS v4 & shadcn/ui", count: 40 },
      { name: "Stripe Escrow & Payment Gateways", count: 22 },
      { name: "Docker & Containerization", count: 19 },
      { name: "Redis Caching & WebSockets", count: 16 },
    ],
    fundamental: [
      { name: "REST & GraphQL APIs", count: 64 },
      { name: "Git, CI/CD & Cloudflare R2", count: 52 },
      { name: "Responsive Mobile-First UI", count: 48 },
      { name: "Automated Testing & E2E", count: 34 },
    ],
  },
  delivery_stats: {
    total_solved: 38,
    total_target: 40,
    completion_rate_pct: 95.0,
    easy: { solved: 18, total: 18 },
    medium: { solved: 14, total: 16 },
    hard: { solved: 6, total: 6 },
  },
  badges: [
    {
      id: "b1",
      name: "100 Days Delivery Badge 2026",
      icon_type: "badge_100",
      category: "Daily Streak",
      date: "2026-09-15",
      description: "Shipped active client code and verified milestones for 100 consecutive days in 2026.",
    },
    {
      id: "b2",
      name: "Verified Top-Rated Freelancer",
      icon_type: "badge_verified",
      category: "Platform Honor",
      date: "2026-08-01",
      description: "Maintained a 100% 5-star client satisfaction rating and on-time milestone delivery.",
    },
  ],
  heatmap: Array.from({ length: 365 }, (_, i) => ({
    date: new Date(Date.now() - (364 - i) * 86400000).toISOString().split("T")[0],
    count: i % 3 === 0 ? 3 : (i % 5 === 0 ? 5 : 1),
    level: (i % 4) as 0 | 1 | 2 | 3 | 4,
  })),
  featured_case_studies: [
    {
      id: "cs1",
      title: "High-Scale FinTech Escrow Platform",
      author: "By Abdullah Ramzan",
      category: "System Architecture",
      progress_solved: 11,
      progress_total: 11,
      tags: ["FastAPI", "PostgreSQL", "Stripe Connect"],
      link: "https://github.com/1xcoder-1",
      description: "End-to-end milestone escrow payment system with instant local payouts, currency conversions, and automated PDF invoicing.",
    },
    {
      id: "cs2",
      title: "AI-Powered Proposal & Scope Generator",
      author: "By Abdullah Ramzan",
      category: "Full-Stack SaaS",
      progress_solved: 18,
      progress_total: 18,
      tags: ["Next.js 16", "TypeScript", "Tailwind v4"],
      link: "https://1xcoder.vercel.app",
      description: "Autonomous client CRM with prompt-to-proposal generator, live read-receipt telemetry, and e-signature contracts.",
    },
  ],
  recent_submissions: [
    {
      id: "s1",
      title: "Full-Stack Escrow Payment & Multi-Currency Gateway",
      client: "Acme Financial Corp",
      status: "Accepted & Approved",
      time_ago: "2 days ago",
      tags: ["FastAPI", "Stripe", "PostgreSQL"],
      amount: 3200.0,
    },
    {
      id: "s2",
      title: "Automated Client Intake & Interactive Booking Engine",
      client: "Nexus Design Studio",
      status: "Accepted & Approved",
      time_ago: "5 days ago",
      tags: ["Next.js 16", "TypeScript", "Tailwind"],
      amount: 2400.0,
    },
  ],
  testimonials: [
    {
      id: "t1",
      client_name: "Sarah Jenkins",
      client_avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80",
      company: "Nexus AI Corp",
      rating: 5,
      comment: "Abdullah delivered our Next.js dashboard ahead of schedule with clean architecture, great UI polish, and zero regressions. Absolute 10/10 engineer!",
      project_title: "Full-Stack SaaS Platform Architecture",
    },
  ],
  discussions: [
    {
      id: "d1",
      title: "How we built an Escrow Payment System with Webhook Integrity in FastAPI",
      upvotes: 184,
      views: 4200,
      replies: 46,
      time_ago: "3 weeks ago",
    },
  ],
};

export default function DashboardReportCardPage() {
  const [profile, setProfile] = useState<PortfolioProfile>(DEFAULT_PROFILE);

  const loadData = async () => {
    try {
      const data = await getMyPortfolio();
      if (data && data.username) {
        setProfile(data);
      }
    } catch (err) {
      console.warn("Notice loading report card data from API, using default profile:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="w-full min-h-full bg-[#121820]">
      <ReportCard profile={profile} />
    </div>
  );
}

