"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useUser, useAuth } from "@clerk/nextjs";
import {
  Clock,
  DollarSign,
  Receipt,
  Plus,
  Play,
  Pause,
  ArrowUpRight,
  TrendingUp,
  Users,
  CheckCircle2,
  FolderKanban,
  FileText,
  AlertCircle,
  RefreshCw,
  Wallet,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardStats, getDashboardOverview, type DashboardStats, type DashboardOverview } from "@/lib/api";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Live Timer Ticking
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = (await getToken()) || undefined;
      const [statsRes, overviewRes] = await Promise.all([
        getDashboardStats(token).catch(() => null),
        getDashboardOverview(token).catch(() => null),
      ]);
      setStats(statsRes);
      setOverview(overviewRes);
    } catch (err) {
      console.error("Failed to load live dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      loadData();
    }
  }, [isLoaded]);

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner & Quick Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Welcome back, {user?.firstName || user?.fullName || "Freelancer"}
            </h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-xs">
              🟢 Neon DB Connected
            </Badge>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Real-time operating command center for your clients, projects, and invoices.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-white/10 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Link href="/dashboard/invoices">
            <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold shadow-lg shadow-emerald-500/20">
              <DollarSign className="w-4 h-4 mr-1" />
              Get Paid / New Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Financial KPI Cards (With Skeleton State) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : (
          <>
            {/* Metric 1: Monthly Revenue */}
            <Card className="bg-slate-900/60 border-white/10 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-slate-400">Total Paid Revenue</CardTitle>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  ${stats ? stats.monthly_revenue.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
                </div>
                <p className="text-xs text-slate-500 mt-1 font-mono">Live from Neon PostgreSQL</p>
              </CardContent>
            </Card>

            {/* Metric 2: Pending Invoices */}
            <Card className="bg-slate-900/60 border-white/10 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-slate-400">Pending Invoices</CardTitle>
                <Receipt className="w-4 h-4 text-amber-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-400">
                  ${stats ? stats.pending_invoices_amount.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {stats?.pending_invoices_count || 0} unpaid invoices waiting
                </p>
              </CardContent>
            </Card>

            {/* Metric 3: Active Projects */}
            <Card className="bg-slate-900/60 border-white/10 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-slate-400">Active Projects</CardTitle>
                <FolderKanban className="w-4 h-4 text-cyan-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stats?.active_projects_count || 0}</div>
                <p className="text-xs text-slate-500 mt-1">
                  {stats?.active_clients_count || 0} active clients in CRM
                </p>
              </CardContent>
            </Card>

            {/* Metric 4: Billable Hours */}
            <Card className="bg-slate-900/60 border-white/10 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-slate-400">Tracked Hours</CardTitle>
                <Clock className="w-4 h-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stats?.billable_hours_this_month || 0} hrs</div>
                <p className="text-xs text-slate-500 mt-1">
                  Effective Rate: ${stats?.effective_hourly_rate || 0}/hr
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Focus Timer Strip */}
      <Card className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border-indigo-500/20 p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isTimerRunning ? "bg-emerald-500/20 text-emerald-400 animate-pulse" : "bg-white/5 text-slate-400"
              }`}
            >
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Live Focus Timer</h3>
              <p className="text-xs text-slate-400">
                {isTimerRunning ? "Recording billable time session..." : "Click start to begin tracking time"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-2xl font-bold text-cyan-400 tracking-wider">
              {formatTimer(timerSeconds)}
            </span>
            <Button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className={
                isTimerRunning
                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                  : "bg-cyan-600 hover:bg-cyan-500 text-white"
              }
              size="sm"
            >
              {isTimerRunning ? <Pause className="w-4 h-4 mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
              {isTimerRunning ? "Pause Timer" : "Start Focus"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Tabs (With Skeleton State) */}
      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList className="bg-slate-900/80 border border-white/10 p-1">
          <TabsTrigger value="projects" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            Active Projects ({overview?.recent_projects?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
            Recent Invoices ({overview?.recent_invoices?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="time" className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-400">
            Time Entries ({overview?.recent_time_entries?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Active Projects */}
        <TabsContent value="projects" className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-2 w-full rounded-full mt-2" />
              </div>
              <div className="p-5 rounded-2xl bg-slate-900/40 border border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-2 w-full rounded-full mt-2" />
              </div>
            </div>
          ) : overview?.recent_projects && overview.recent_projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overview.recent_projects.map((proj) => (
                <Card key={proj.id} className="bg-slate-900/40 border-white/10 hover:border-cyan-500/30 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-xs">
                        {proj.status}
                      </Badge>
                      <span className="text-xs text-slate-400 font-mono">${proj.budget}</span>
                    </div>
                    <CardTitle className="text-base text-white mt-2">{proj.title}</CardTitle>
                    <CardDescription className="text-xs text-slate-400">{proj.client_name}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${proj.progress_pct}%` }} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-slate-900/20 border-dashed border-white/10 p-8 text-center">
              <FolderKanban className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-300">No Projects Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Create your first client project to organize tasks, track billable hours, and send invoices.
              </p>
              <Link href="/dashboard/projects" className="inline-block mt-4">
                <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create First Project
                </Button>
              </Link>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Recent Invoices */}
        <TabsContent value="invoices" className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/40 border border-white/5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-lg" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="text-right space-y-1.5">
                    <Skeleton className="h-5 w-20 ml-auto" />
                    <Skeleton className="h-4 w-14 ml-auto rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : overview?.recent_invoices && overview.recent_invoices.length > 0 ? (
            <div className="space-y-2">
              {overview.recent_invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-900/40 border border-white/10 hover:border-emerald-500/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{inv.number}</h4>
                      <p className="text-xs text-slate-400">{inv.client} • {inv.issue_date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">${inv.amount.toFixed(2)}</div>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card className="bg-slate-900/20 border-dashed border-white/10 p-8 text-center">
              <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-300">No Invoices Created Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Generate professional itemized invoices and get paid via Stripe or local wallets in minutes.
              </p>
              <Link href="/dashboard/invoices" className="inline-block mt-4">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create First Invoice
                </Button>
              </Link>
            </Card>
          )}
        </TabsContent>

        {/* Tab 3: Time Entries */}
        <TabsContent value="time" className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/40 border border-white/5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : overview?.recent_time_entries && overview.recent_time_entries.length > 0 ? (
            <div className="space-y-2">
              {overview.recent_time_entries.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-900/40 border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <div>
                      <h4 className="text-sm font-semibold text-white">{t.task}</h4>
                      <p className="text-xs text-slate-400">{t.project} • {t.date}</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm text-cyan-400 font-semibold">{t.duration}</span>
                </div>
              ))}
            </div>
          ) : (
            <Card className="bg-slate-900/20 border-dashed border-white/10 p-8 text-center">
              <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-300">No Time Tracked Today</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Track billable hours with 1 click to automatically convert project time into paid invoices.
              </p>
              <Link href="/dashboard/time-tracker" className="inline-block mt-4">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  <Play className="w-4 h-4 mr-1.5" />
                  Go to Time Tracker
                </Button>
              </Link>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
