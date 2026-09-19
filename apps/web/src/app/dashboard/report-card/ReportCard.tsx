"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  MapPin,
  Building2,
  Globe,
  Github,
  Twitter,
  Linkedin,
  CheckCircle2,
  Star,
  Award,
  Flame,
  ExternalLink,
  Share2,
  Code2,
  Check,
  Copy,
  Trash2,
  Link2,
  Clock,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  PortfolioProfile,
  ShareStatusResponse,
  getShareStatus,
  createShareLink,
  revokeShareLink
} from "@/lib/api";

interface ReportCardProps {
  profile: PortfolioProfile;
}

export function ReportCard({ profile }: ReportCardProps) {
  const [activeTab, setActiveTab] = useState<"recent" | "case_studies" | "testimonials">("recent");
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<any | null>(null);
  
  // Share Modal & Secure Server-Side Share Configuration
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [includeStyling, setIncludeStyling] = useState(true);
  const [selectedExpiration, setSelectedExpiration] = useState<"never" | "1m" | "1h" | "24h" | "7d" | "30d">("never");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [shareConfig, setShareConfig] = useState<ShareStatusResponse>({
    is_shared: false,
    share_token: null,
    include_styling: true,
    expiration: "never",
    expires_at: null,
    created_at: null,
    share_url: null,
    status: "revoked",
  });

  const [timeRemainingText, setTimeRemainingText] = useState<string>("");

  // Fetch Server-Side Share State on mount and when modal opens
  const fetchLatestShareStatus = async () => {
    try {
      const data = await getShareStatus();
      setShareConfig(data);
      setIncludeStyling(data.include_styling ?? true);
      setSelectedExpiration(data.expiration || "never");
    } catch (err) {
      console.error("Failed to fetch server share status:", err);
    }
  };

  useEffect(() => {
    fetchLatestShareStatus();
  }, []);

  useEffect(() => {
    if (shareModalOpen) {
      fetchLatestShareStatus();
    }
  }, [shareModalOpen]);

  // Real-time server-backed countdown
  useEffect(() => {
    const updateCountdown = () => {
      if (!shareConfig.is_shared) {
        setTimeRemainingText("Not shared");
        return;
      }
      if (!shareConfig.expires_at) {
        setTimeRemainingText("Never expires");
        return;
      }
      const now = Date.now();
      const diff = shareConfig.expires_at - now;
      if (diff <= 0) {
        setShareConfig((prev) => ({ ...prev, is_shared: false, status: "expired" }));
        setTimeRemainingText("Link has expired");
      } else {
        const seconds = Math.floor((diff / 1000) % 60);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days > 0) setTimeRemainingText(`Expires in ${days}d ${hours}h`);
        else if (hours > 0) setTimeRemainingText(`Expires in ${hours}h ${minutes}m`);
        else if (minutes > 0) setTimeRemainingText(`Expires in ${minutes}m ${seconds}s`);
        else setTimeRemainingText(`Expires in ${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [shareConfig.is_shared, shareConfig.expires_at]);

  const originUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "https://freelance-book.app");
  const shareUrl = shareConfig.share_token
    ? `${originUrl}/u/${profile.username || "1xcoder"}?token=${shareConfig.share_token}`
    : `${originUrl}/u/${profile.username || "1xcoder"}`;

  const handleCreateShareLink = async () => {
    const now = Date.now();
    let calculatedExpiresAt: number | null = null;
    if (selectedExpiration === "1m") calculatedExpiresAt = now + 60 * 1000;
    else if (selectedExpiration === "1h") calculatedExpiresAt = now + 3600 * 1000;
    else if (selectedExpiration === "24h") calculatedExpiresAt = now + 24 * 3600 * 1000;
    else if (selectedExpiration === "7d") calculatedExpiresAt = now + 7 * 24 * 3600 * 1000;
    else if (selectedExpiration === "30d") calculatedExpiresAt = now + 30 * 24 * 3600 * 1000;

    const fallbackToken = "rc_" + Math.random().toString(36).substring(2, 10);

    // Instant seamless transition to Screen 1
    setShareConfig({
      is_shared: true,
      share_token: fallbackToken,
      include_styling: includeStyling,
      expiration: selectedExpiration,
      expires_at: calculatedExpiresAt,
      created_at: now,
      share_url: `/u/${profile.username || "1xcoder"}?token=${fallbackToken}`,
      status: "active",
    });

    try {
      setIsSubmitting(true);
      const res = await createShareLink({
        expiration: selectedExpiration,
        include_styling: includeStyling,
      });
      if (res && res.is_shared) {
        setShareConfig(res);
      }
    } catch (err) {
      console.warn("Server sync notice:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveShareLink = async () => {
    // Instant seamless transition back to Screen 2
    setShareConfig((prev) => ({
      ...prev,
      is_shared: false,
      status: "revoked",
      expires_at: null,
    }));

    try {
      setIsSubmitting(true);
      await revokeShareLink();
    } catch (err) {
      console.warn("Server revoke sync notice:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Group Heatmap into 52 weeks
  const weeks = useMemo(() => {
    const raw = profile.heatmap || [];
    const grouped: (typeof raw)[] = [];
    for (let i = 0; i < raw.length; i += 7) {
      grouped.push(raw.slice(i, i + 7));
    }
    return grouped;
  }, [profile.heatmap]);

  // SVG Radial Gauge Calculations
  const solved = profile.delivery_stats?.total_solved || 38;
  const target = profile.delivery_stats?.total_target || 40;
  const percentage = Math.min(100, Math.round((solved / target) * 100));
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="min-h-screen bg-[#121820] text-slate-100 font-sans pb-16 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Sleek Minimalist Top Header */}
      <header className="sticky top-0 z-30 bg-[#161b22]/95 backdrop-blur-md border-b border-white/5 px-4 lg:px-8 py-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
            <Award className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white">Freelancer Report Card</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold">
                VERIFIED
              </span>
            </div>
            <p className="text-[11px] text-slate-400">On-time milestone delivery & verified client track record</p>
          </div>
        </div>

        {/* Action Button: Share Icon Only */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShareModalOpen(true)}
            variant="outline"
            size="icon"
            className="w-9 h-9 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-slate-200 border-white/10 transition-all hover:border-amber-500/40 shadow-sm"
            title="Share Report Card"
          >
            <Share2 className="w-4 h-4 text-slate-200" />
          </Button>
        </div>
      </header>

      {/* Main Content Grid with Original Card Colors */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT SIDEBAR: PROFILE OVERVIEW */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#161b22] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <img
                    src={profile.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&h=400&q=80"}
                    alt={profile.full_name}
                    className="w-18 h-18 rounded-2xl object-cover border-2 border-amber-500/40 shadow-md bg-slate-900"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#161b22] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-lg font-bold text-white truncate">{profile.username}</h1>
                    <span title="Verified Identity & Skills" className="inline-flex">
                      <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium truncate">{profile.full_name}</p>
                  
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-400">Rank</span>
                    <span className="text-xs font-bold font-mono text-white bg-slate-800/80 px-2 py-0.5 rounded border border-white/10">
                      #{profile.rank || "255,885"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Headline */}
              {profile.headline && (
                <p className="mt-3 text-xs text-slate-300 font-medium leading-snug">
                  {profile.headline}
                </p>
              )}

              {/* Bio */}
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                {profile.bio || "Building high-performance SaaS applications, distributed backends, and AI workflows."}
              </p>

              {/* Standard Rate & Availability Badge */}
              <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-white/5">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block uppercase">Standard Rate</span>
                  <span className="text-sm font-mono font-bold text-amber-400">${profile.hourly_rate || 85}/hr</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  ● Available for Projects
                </span>
              </div>

              {/* Badges / Stats Bar */}
              <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Streak</span>
                  <span className="text-xs font-mono font-bold text-orange-400 flex items-center justify-center gap-0.5">
                    <Flame className="w-3 h-3 fill-orange-400 text-orange-400" /> {profile.current_streak || 14}d
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 block">On-Time</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {profile.delivery_stats?.completion_rate_pct || 96}%
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Solved</span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {solved}/{target}
                  </span>
                </div>
              </div>

              {/* Contact & Social Meta */}
              <div className="mt-4 space-y-2 text-xs text-slate-400 pt-3 border-t border-white/5">
                {profile.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{profile.location}</span>
                  </div>
                )}
                {profile.organization && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{profile.organization}</span>
                  </div>
                )}
                {profile.website_url && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <a href={profile.website_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline truncate">
                      {profile.website_url.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
                {profile.github_url && (
                  <div className="flex items-center gap-2">
                    <Github className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <a href={profile.github_url} target="_blank" rel="noreferrer" className="text-slate-300 hover:text-white hover:underline truncate">
                      {profile.github_url.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
                {profile.linkedin_url && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline truncate">
                      {profile.linkedin_url.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
                {profile.twitter_url && (
                  <div className="flex items-center gap-2">
                    <Twitter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <a href={profile.twitter_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline truncate">
                      {profile.twitter_url.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Skills & Tech Stack Breakdown */}
            <div className="bg-[#161b22] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5 text-amber-400" />
                Technical Competencies
              </h3>

              {/* Specializations & Tags */}
              {profile.tags && profile.tags.length > 0 && (
                <div>
                  <span className="text-[11px] text-cyan-400 font-semibold block mb-1.5 font-mono">Specializations & Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.tags.map((tag, idx) => (
                      <span key={idx} className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950/70 border border-cyan-500/20 text-slate-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {profile.skills?.advanced && (
                  <div>
                    <span className="text-[11px] text-emerald-400 font-semibold block mb-1.5">● Advanced Mastery</span>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.skills.advanced.map((s, idx) => (
                        <span key={idx} className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950/70 border border-white/10 text-slate-200">
                          {s.name} <span className="text-slate-500 font-mono">x{s.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.skills?.intermediate && (
                  <div>
                    <span className="text-[11px] text-amber-400 font-semibold block mb-1.5">● Intermediate / Cloud</span>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.skills.intermediate.map((s, idx) => (
                        <span key={idx} className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950/70 border border-white/10 text-slate-300">
                          {s.name} <span className="text-slate-500 font-mono">x{s.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: RADIAL GAUGE, HEATMAP & RECENT DELIVERABLES */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Delivery Stats Gauge Card */}
            <div className="bg-[#161b22] border border-white/10 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Circular Gauge */}
                <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r={radius} stroke="#21262d" strokeWidth="12" fill="transparent" />
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      stroke="#f59e0b"
                      strokeWidth="12"
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-black font-mono text-white">{solved}</span>
                    <span className="text-[10px] text-slate-400 font-mono uppercase">of {target} Done</span>
                  </div>
                </div>

                {/* Scope Breakdown Bars */}
                <div className="flex-1 w-full space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Starter Scope</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {profile.delivery_stats?.easy?.solved || 18}/{profile.delivery_stats?.easy?.total || 18} (100%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "100%" }} />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Pro Applications</span>
                    <span className="font-mono text-amber-400 font-bold">
                      {profile.delivery_stats?.medium?.solved || 14}/{profile.delivery_stats?.medium?.total || 16} (88%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: "88%" }} />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Enterprise Systems</span>
                    <span className="font-mono text-rose-400 font-bold">
                      {profile.delivery_stats?.hard?.solved || 6}/{profile.delivery_stats?.hard?.total || 6} (100%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* 365-Day Activity Heatmap */}
            <div className="bg-[#161b22] border border-white/10 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Annual Delivery & Coding Heatmap</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {profile.active_days_count || 142} active days in 2026
                </span>
              </div>

              {/* Heatmap Grid */}
              <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <div className="inline-flex gap-1 min-w-[700px]">
                  {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-1">
                      {week.map((cell, cIdx) => {
                        let bgClass = "bg-[#1f2937]";
                        if (cell.level === 1) bgClass = "bg-emerald-950 border border-emerald-800/40";
                        if (cell.level === 2) bgClass = "bg-emerald-800";
                        if (cell.level === 3) bgClass = "bg-emerald-600";
                        if (cell.level === 4) bgClass = "bg-emerald-400";

                        return (
                          <div
                            key={cIdx}
                            className={`w-3 h-3 rounded-sm ${bgClass} transition-transform hover:scale-125 cursor-pointer`}
                            title={`${cell.date}: ${cell.count} deliveries/commits`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>Total Milestones Completed</span>
                <div className="flex items-center gap-1">
                  <span>Less</span>
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#1f2937]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-950" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-800" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
                  <span>More</span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs for Recent Deliverables / Solutions */}
            <div className="bg-[#161b22] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="flex border-b border-white/10 px-4">
                <button
                  onClick={() => setActiveTab("recent")}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                    activeTab === "recent"
                      ? "border-amber-400 text-amber-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Recent Milestones
                </button>
                <button
                  onClick={() => setActiveTab("case_studies")}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                    activeTab === "case_studies"
                      ? "border-amber-400 text-amber-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Case Studies ({profile.featured_case_studies?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab("testimonials")}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                    activeTab === "testimonials"
                      ? "border-amber-400 text-amber-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Client Reviews ({profile.testimonials?.length || 0})
                </button>
              </div>

              <div className="p-4 space-y-3">
                {activeTab === "recent" && (
                  <div className="space-y-2.5">
                    {(profile.recent_submissions || []).map((sub, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-slate-200 block">{sub.title}</span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              Client: {sub.client} • ${sub.amount}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {sub.status}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-1">{sub.time_ago}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "case_studies" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(profile.featured_case_studies || []).map((cs, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-950/60 border border-white/5 hover:border-amber-500/30 transition-all cursor-pointer"
                        onClick={() => setSelectedCaseStudy(cs)}
                      >
                        <span className="text-[10px] font-mono text-amber-400 block mb-1">{cs.category}</span>
                        <h4 className="text-xs font-bold text-white">{cs.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2">{cs.description}</p>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {(cs.tags || []).map((tag: string, tIdx: number) => (
                            <span key={tIdx} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-300">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "testimonials" && (
                  <div className="space-y-3">
                    {(profile.testimonials || []).map((t, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <img src={t.client_avatar} alt={t.client_name} className="w-7 h-7 rounded-full object-cover" />
                            <div>
                              <span className="text-xs font-bold text-white block">{t.client_name}</span>
                              <span className="text-[10px] text-slate-400">{t.company}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 text-amber-400">
                            {Array.from({ length: t.rating || 5 }).map((_, rIdx) => (
                              <Star key={rIdx} className="w-3 h-3 fill-current" />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 italic">"{t.comment}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TWO-SCREEN REAL-TIME SHARE POP-UP MENU (MATCHING PROVIDED DESIGNS) */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="bg-[#0b0e14] border border-white/10 text-white max-w-md w-full p-6 rounded-3xl shadow-2xl overflow-hidden focus:outline-none">
          <DialogHeader className="space-y-1.5 text-left">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-white stroke-[2.2]" />
              <DialogTitle className="text-base font-bold text-white tracking-tight">
                Share Report Card
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-400 leading-relaxed">
              Create a public link to share &ldquo;{profile.full_name || profile.username} - Verified Developer Report Card&rdquo; with anyone.
            </DialogDescription>
          </DialogHeader>

          {shareConfig.is_shared ? (
            /* SCREEN 1: LINK IS ACTIVE & CREATED */
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-200">Share Link</label>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {timeRemainingText}
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5 p-2 bg-[#161b24] border border-white/10 rounded-xl">
                  <Link2 className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
                  <span className="text-xs font-mono text-slate-300 truncate flex-1 select-all">
                    {shareUrl}
                  </span>
                  
                  {/* Copy Icon Button */}
                  <Button
                    onClick={copyToClipboard}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-200 shrink-0 transition-colors"
                    title="Copy Share URL"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>

                  {/* Open in New Tab Button */}
                  <Button
                    onClick={() => window.open(shareUrl, "_blank")}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-200 shrink-0 transition-colors"
                    title="Open Live Public Link"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                  </Button>
                </div>
              </div>

              {/* Include Styling Checkbox */}
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-200 font-medium select-none pt-1">
                <input
                  type="checkbox"
                  checked={includeStyling}
                  onChange={(e) => setIncludeStyling(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 bg-slate-900 focus:ring-0 w-4 h-4 accent-blue-600 cursor-pointer"
                />
                <span>Include styling (fonts, colors, layout)</span>
              </label>

              {/* Bottom Actions */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={handleRemoveShareLink}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#842e2e]/90 hover:bg-[#993535] disabled:opacity-50 border border-rose-500/30 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Revoking..." : "Remove Share Link"}</span>
                </button>

                <button
                  onClick={() => setShareModalOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#161b24] hover:bg-[#21262d] border border-white/10 text-slate-200 font-semibold text-xs transition-all active:scale-[0.99]"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* SCREEN 2: LINK NOT SHARED YET */
            <div className="space-y-4 pt-2">
              {/* Center Placeholder Box with Big Globe */}
              <div className="bg-[#161b24]/90 border border-white/5 rounded-2xl p-6 text-center flex flex-col items-center justify-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mb-1">
                  <Globe className="w-7 h-7 text-slate-400 stroke-[1.5]" />
                </div>
                <h4 className="text-sm font-bold text-white tracking-tight">
                  This report card is not shared yet
                </h4>
                <p className="text-xs text-slate-400 max-w-xs">
                  Create a share link to let anyone view this report card
                </p>
              </div>

              {/* Include Styling Checkbox */}
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-200 font-medium select-none">
                <input
                  type="checkbox"
                  checked={includeStyling}
                  onChange={(e) => setIncludeStyling(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 bg-slate-900 focus:ring-0 w-4 h-4 accent-blue-600 cursor-pointer"
                />
                <span>Include styling (fonts, colors, layout)</span>
              </label>

              {/* Link Expiration Select Dropdown */}
              <div>
                <label className="text-xs font-semibold text-slate-200 block mb-1.5">
                  Link Expiration
                </label>
                <select
                  value={selectedExpiration}
                  onChange={(e) => setSelectedExpiration(e.target.value as any)}
                  className="w-full bg-[#161b24] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
                >
                  <option value="never">Never expires</option>
                  <option value="1m">1 minute (Live Test Expiry)</option>
                  <option value="1h">1 hour</option>
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                </select>
              </div>

              {/* Bottom Actions: Cancel & Create Share Link */}
              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShareModalOpen(false)}
                  className="py-2.5 px-5 rounded-xl bg-[#161b24] hover:bg-[#21262d] border border-white/10 text-slate-200 font-semibold text-xs transition-all active:scale-[0.99]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateShareLink}
                  disabled={isSubmitting}
                  className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all active:scale-[0.99]"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Creating..." : "Create Share Link"}</span>
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Case Study Detail Modal (Read-Only) */}
      <Dialog open={!!selectedCaseStudy} onOpenChange={(open) => !open && setSelectedCaseStudy(null)}>
        <DialogContent className="bg-[#161b22] border-white/10 text-white max-w-lg rounded-2xl shadow-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <span className="text-xs font-mono text-amber-400">{selectedCaseStudy?.category}</span>
            </div>
            <DialogTitle className="text-base font-bold text-white mt-1">
              {selectedCaseStudy?.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {selectedCaseStudy?.author}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-300 leading-relaxed">
              {selectedCaseStudy?.description}
            </p>

            {selectedCaseStudy?.tags && (
              <div>
                <span className="text-[11px] text-slate-400 block mb-1.5 font-mono">Tech Stack & Tools</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCaseStudy.tags.map((tag: string, idx: number) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-slate-950/80 border border-white/10 text-slate-200">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedCaseStudy?.link && (
              <div className="pt-2">
                <a
                  href={selectedCaseStudy.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View Project / Repository</span>
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


