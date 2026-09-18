"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser, UserButton } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  DollarSign,
  Kanban,
  FileText,
  Plus,
  Play,
  Pause,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Users,
  CheckCircle2,
  Calendar,
  Layers,
  Search,
  Bell,
  Activity,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Zap,
} from "lucide-react";

import { Spotlight } from "@/components/ui/aceternity/spotlight";
import { BackgroundGradient } from "@/components/ui/aceternity/background-gradient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CommandMenu } from "@/components/ui/CommandMenu";
import { getDashboardOverview, type DashboardOverview } from "@/lib/api";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [timerRunning, setTimerRunning] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(9912); // ~02:45:12
  const [activeTab, setActiveTab] = useState("projects");
  const [backendSyncStatus, setBackendSyncStatus] = useState<"connected" | "connecting" | "offline">("connecting");

  // Fetch live dashboard data from FastAPI
  useEffect(() => {
    async function loadData() {
      try {
        setBackendSyncStatus("connecting");
        const res = await getDashboardOverview();
        setData(res);
        setBackendSyncStatus("connected");
      } catch (err) {
        console.warn("Backend sync notice (using fallback cached data):", err);
        setBackendSyncStatus("offline");
        // Fallback demo state
        setData({
          summary: {
            monthly_revenue: 14850.00,
            active_projects: 6,
            billable_hours: 142.5,
            effective_rate: 104.20,
          },
          recent_projects: [
            {
              id: "proj-01",
              title: "Fintech Dashboard Redesign",
              client_name: "Acme Capital",
              status: "in_progress",
              progress_pct: 75,
              budget: 6500.00,
              tracked_hours: 38.5,
              due_date: "2026-09-25",
            },
            {
              id: "proj-02",
              title: "E-Commerce Stripe Integration",
              client_name: "Nordic Apparel",
              status: "in_progress",
              progress_pct: 45,
              budget: 4200.00,
              tracked_hours: 18.0,
              due_date: "2026-10-02",
            },
            {
              id: "proj-03",
              title: "Mobile Expo Companion App",
              client_name: "Venture Labs",
              status: "review",
              progress_pct: 95,
              budget: 8000.00,
              tracked_hours: 72.0,
              due_date: "2026-09-20",
            },
          ],
          recent_invoices: [
            {
              id: "inv-2026-091",
              number: "INV-2026-091",
              client: "Acme Capital",
              amount: 3250.00,
              status: "paid",
              issue_date: "2026-09-10",
            },
            {
              id: "inv-2026-092",
              number: "INV-2026-092",
              client: "Nordic Apparel",
              amount: 2100.00,
              status: "sent",
              issue_date: "2026-09-15",
            },
          ],
          recent_time_entries: [
            {
              id: "time-01",
              project: "Fintech Dashboard Redesign",
              task: "Framer Motion Chart Animations",
              duration: "02:45:10",
              billable: true,
              date: "Today",
            },
            {
              id: "time-02",
              project: "E-Commerce Stripe Integration",
              task: "FastAPI Webhook Security Signature",
              duration: "01:30:00",
              billable: true,
              date: "Today",
            },
          ],
          active_focus_timer: {
            is_running: true,
            project_name: "Fintech Dashboard Redesign",
            task_name: "Interactive Analytics Grid",
            elapsed_seconds: 9912,
            started_at: "2026-09-18T19:45:00Z",
          },
        });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Timer interval ticker
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* Dynamic Background Spotlight */}
      <Spotlight className="-top-40 left-0 md:left-60" fill="rgba(16, 185, 129, 0.15)" />
      <Spotlight className="top-20 right-0 md:right-40" fill="rgba(99, 102, 241, 0.15)" />

      {/* Dashboard Top Header Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Workspace Selector */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-500 flex items-center justify-center font-bold text-slate-950 text-xs shadow-md shadow-emerald-500/20">
                FB
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-sm text-white tracking-tight leading-none">
                  Freelance <span className="text-emerald-400">OS</span>
                </span>
              </div>
            </Link>

            <span className="text-slate-700 hidden sm:inline">•</span>

            {/* Backend Sync Live Pill */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  backendSyncStatus === "connected"
                    ? "bg-emerald-400 animate-pulse"
                    : backendSyncStatus === "connecting"
                    ? "bg-amber-400 animate-spin"
                    : "bg-slate-500"
                }`}
              />
              <span>FastAPI D1: {backendSyncStatus === "connected" ? "Live" : "Ready"}</span>
            </div>
          </div>

          {/* Quick Actions & User Profile */}
          <div className="flex items-center gap-3">
            <CommandMenu />

            <Link href="/ai">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex gap-1.5 text-xs text-indigo-400 hover:text-indigo-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Book AI</span>
              </Button>
            </Link>

            <Link href="/sign-in">
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8 sm:w-9 sm:h-9 border border-slate-700 hover:border-emerald-400 transition-all",
                  },
                }}
              />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Dashboard Workspace */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8 relative z-10">
        {/* Welcome Banner & Quick Action Buttons */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-900">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="emerald" className="text-[10px] px-2.5 py-0.5 font-mono font-bold">
                PRO WORKSPACE
              </Badge>
              <span className="text-xs text-slate-500 font-mono">Cloudflare D1 Edge Synced</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, {isLoaded && user?.firstName ? user.firstName : "Freelancer"} 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Here is what is happening across your projects, client CRM, time tracking, and invoices today.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button variant="default" size="sm" className="rounded-xl gap-1.5 font-bold shadow-md shadow-emerald-500/20">
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-slate-300">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Create Invoice</span>
            </Button>
          </div>
        </div>

        {/* 4 Core KPI Stat Cards with shadcn Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Card className="bg-slate-900/50 border-slate-800/80 p-6 flex flex-col justify-between hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Monthly Revenue</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-emerald-400">
              ${data?.summary.monthly_revenue.toLocaleString("en-US", { minimumFractionDigits: 2 }) || "14,850.00"}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium mt-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18.4% vs last month</span>
            </div>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800/80 p-6 flex flex-col justify-between hover:border-indigo-500/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Active Client Projects</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Kanban className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-white">
              {data?.summary.active_projects || 6} Projects
            </div>
            <div className="text-[11px] text-indigo-400 font-medium mt-2">
              2 Milestones due this week
            </div>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800/80 p-6 flex flex-col justify-between hover:border-cyan-500/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Billable Hours Logged</span>
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-cyan-400">
              {data?.summary.billable_hours || 142.5} hrs
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-2 font-mono">
              Effective Rate: ${data?.summary.effective_rate || 104.20}/hr
            </div>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800/80 p-6 flex flex-col justify-between hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Pending Invoices</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-amber-400">
              $4,200.00
            </div>
            <div className="text-[11px] text-amber-400 font-medium mt-2">
              2 invoices awaiting client payment
            </div>
          </Card>
        </div>

        {/* Live Running Focus Timer Banner */}
        <Card className="p-5 sm:p-6 bg-slate-900/80 border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">
                  Active Focus Session
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div className="text-base font-bold text-white mt-0.5">
                Fintech Dashboard Redesign • Framer Motion Charts
              </div>
              <div className="text-xs text-slate-400">
                Acme Capital Client • Billable Rate: $95.00/hr
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-emerald-400 tracking-wider">
              {formatTimer(elapsedSeconds)}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={timerRunning ? "outline" : "default"}
                size="sm"
                onClick={() => setTimerRunning(!timerRunning)}
                className="rounded-xl font-bold text-xs"
              >
                {timerRunning ? <Pause className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                {timerRunning ? "Pause" : "Resume"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setTimerRunning(false);
                  setElapsedSeconds(0);
                }}
                className="rounded-xl font-bold text-xs"
              >
                Stop & Log
              </Button>
            </div>
          </div>
        </Card>

        {/* Categorized Multi-View Workspace Tabs */}
        <Tabs defaultValue="projects" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-900 pb-4">
            <TabsList className="bg-slate-900 p-1 border border-slate-800 rounded-2xl">
              <TabsTrigger value="projects" className="gap-2 rounded-xl text-xs sm:text-sm font-semibold">
                <Kanban className="w-4 h-4 text-indigo-400" />
                <span>Active Projects ({data?.recent_projects.length || 3})</span>
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-2 rounded-xl text-xs sm:text-sm font-semibold">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Invoices & Billing ({data?.recent_invoices.length || 2})</span>
              </TabsTrigger>
              <TabsTrigger value="time" className="gap-2 rounded-xl text-xs sm:text-sm font-semibold">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Time Entries</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-2 rounded-xl text-xs sm:text-sm font-semibold">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Book AI Insights</span>
              </TabsTrigger>
            </TabsList>

            <div className="text-xs text-slate-500 font-mono hidden md:inline">
              Windows Quick Capture: <kbd className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-400">Ctrl+Shift+F</kbd>
            </div>
          </div>

          {/* TAB 1: Projects Overview */}
          <TabsContent value="projects" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data?.recent_projects.map((proj) => (
                <Card key={proj.id} className="p-6 bg-slate-900/50 border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="indigo" className="text-[10px] font-mono">
                        {proj.status === "in_progress" ? "In Progress" : proj.status === "review" ? "Client Review" : "Completed"}
                      </Badge>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        ${proj.budget.toLocaleString()}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1">{proj.title}</h3>
                    <div className="text-xs text-slate-400 mb-4">{proj.client_name}</div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Milestone Progress</span>
                        <span className="font-mono text-white font-bold">{proj.progress_pct}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                          style={{ width: `${proj.progress_pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span>Due: {proj.due_date}</span>
                    <span className="font-mono text-cyan-400">{proj.tracked_hours} hrs logged</span>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB 2: Invoices Overview */}
          <TabsContent value="invoices" className="space-y-4">
            <div className="space-y-3">
              {data?.recent_invoices.map((inv) => (
                <Card key={inv.id} className="p-5 bg-slate-900/50 border-slate-800/80 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-mono text-xs font-bold">
                      PDF
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{inv.number} • {inv.client}</div>
                      <div className="text-xs text-slate-400">Issued on {inv.issue_date} • Due in 14 days</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-base font-mono font-bold text-white">
                        ${inv.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                      <Badge variant={inv.status === "paid" ? "emerald" : "amber"} className="text-[10px] mt-0.5">
                        {inv.status.toUpperCase()}
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs rounded-xl">
                      View PDF
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB 3: Time Entries */}
          <TabsContent value="time" className="space-y-4">
            <div className="space-y-3">
              {data?.recent_time_entries.map((entry) => (
                <Card key={entry.id} className="p-4 bg-slate-900/50 border-slate-800/80 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-sm font-bold text-white">{entry.task}</div>
                    <div className="text-xs text-slate-400">{entry.project} • {entry.date}</div>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <Badge variant={entry.billable ? "emerald" : "outline"} className="text-[10px]">
                      {entry.billable ? "Billable" : "Internal"}
                    </Badge>
                    <span className="text-sm font-bold text-cyan-400">{entry.duration}</span>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB 4: Book AI Insights */}
          <TabsContent value="ai" className="space-y-4">
            <Card className="p-6 bg-slate-900/60 border-indigo-500/30 shadow-2xl">
              <div className="flex items-center gap-2 text-indigo-400 text-sm font-bold mb-3">
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span>Book AI Strategic Insights for this Workspace:</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed font-normal mb-4">
                &ldquo;You have logged 142.5 hours this month with an average effective rate of <strong>$104.20/hr</strong>. Fixed-price contracts (Acme Capital) outperformed hourly retainers by <strong>+22% margin</strong>. Consider locking in milestone 3 before taking new Q4 leads.&rdquo;
              </p>
              <Link href="/ai">
                <Button variant="indigo" size="sm" className="rounded-xl text-xs font-bold gap-1.5">
                  <span>Open Full AI Chat Sandbox</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
