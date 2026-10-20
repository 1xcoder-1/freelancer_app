"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Clock,
  Play,
  Pause,
  Square,
  Trash2,
  RefreshCw,
  DollarSign,
  Receipt,
  TrendingUp,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/patterns";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";
import {
  getTimeEntries,
  deleteTimeEntry,
  getProjects,
  getActiveTimer,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  type TimerSession,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { logHandledError } from "@/lib/log-error";

function formatTimer(total: number) {
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function fmtDur(total: number) {
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  if (hrs === 0 && mins === 0) return `${total}s`;
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

// Isolated leaf so the 1Hz tick re-renders only the clock text, not the
// whole page (entry list, form, and cards included). The parent keys this
// component on the session identity, so every server sync remounts it and
// drift restarts from exact server truth — no reset state needed here.
function LiveTimerDisplay({ session }: { session: TimerSession | null }) {
  const [drift, setDrift] = useState(0);
  const running = !!session?.is_running;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setDrift((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const displayedSeconds = session
    ? session.elapsed_seconds + (session.is_running ? drift : 0)
    : 0;

  return (
    <span className="font-mono text-3xl font-bold text-info">
      {formatTimer(displayedSeconds)}
    </span>
  );
}

export default function TimeTrackerPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  // Captured once on mount so the "This Week" math stays pure during render.
  const [mountedAt] = useState(() => Date.now());

  // Server-authoritative timer: the run lives in the DB, so this component only
  // renders it. Live tick smoothing is handled by the LiveTimerDisplay leaf.
  const [session, setSession] = useState<TimerSession | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: pageData, loading, refresh: loadData } = useApiData(
    "time-tracker:data",
    async (token) => {
      const [entriesRes, projRes] = await Promise.all([
        getTimeEntries(token).catch(() => []),
        getProjects(token).catch(() => []),
      ]);
      return { entries: entriesRes, projects: projRes };
    },
    {
      reportContext: "time-tracker",
      onSuccess: (data) => {
        if (data.projects.length > 0) {
          setSelectedProjectId((prev) => prev || data.projects[0].id);
        }
      },
    }
  );

  const entries = pageData?.entries ?? [];
  const projects = pageData?.projects ?? [];

  const syncActive = useCallback(
    async (token?: string) => {
      try {
        const active = await getActiveTimer(token);
        setSession(active);
      } catch {
        // keep whatever we were showing; a poll failure shouldn't blank the clock
      }
    },
    []
  );

  // Load the run on mount (restore after refresh / another device started it).
  useEffect(() => {
    let mounted = true;
    (async () => {
      const token = (await getToken()) || undefined;
      if (!mounted) return;
      await syncActive(token);
    })();
    return () => {
      mounted = false;
    };
  }, [getToken, syncActive]);

  // Re-sync to server truth when the tab regains focus (long idle, phone swap).
  useEffect(() => {
    const onFocus = async () => {
      const token = (await getToken()) || undefined;
      await syncActive(token);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [getToken, syncActive]);

  const resolveToken = async () => (await getToken()) || undefined;

  const handleStart = async () => {
    if (!selectedProjectId) {
      toast.error("Please select a project to track time for");
      return;
    }
    if (description.trim().length > 200) {
      toast.error("Keep the description under 200 characters");
      return;
    }
    setBusy(true);
    try {
      const token = await resolveToken();
      const s = await startTimer(
        { project_id: selectedProjectId, description: description || undefined, is_billable: true },
        token
      );
      setSession(s);
      toast.success("Timer started");
    } catch (err) {
      logHandledError("Error starting timer:", err);
      toast.error("Could not start the timer");
    } finally {
      setBusy(false);
    }
  };

  const handlePause = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const token = await resolveToken();
      const s = await pauseTimer(session.id, token);
      setSession(s);
    } catch (err) {
      logHandledError("Error pausing timer:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleResume = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const token = await resolveToken();
      const s = await resumeTimer(session.id, token);
      setSession(s);
    } catch (err) {
      logHandledError("Error resuming timer:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const token = await resolveToken();
      await stopTimer(session.id, token);
      setSession(null);
      setDescription("");
      invalidateCache("dashboard:data");
      loadData();
      toast.success("Time saved");
    } catch (err) {
      logHandledError("Error stopping timer:", err);
      toast.error("Could not stop the timer");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete time entry",
      message: "This tracked time entry will be removed permanently and won't be billable.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const token = await resolveToken();
      await deleteTimeEntry(id, token);
      invalidateCache("dashboard:data");
      loadData();
      toast.success("Time entry deleted");
    } catch (err) {
      logHandledError("Error deleting time entry:", err);
      toast.error("Could not delete time entry");
    }
  };

  const running = !!session?.is_running;
  const paused = !!session && !session.is_running;

  const totalSeconds = entries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
  const billableSeconds = entries
    .filter((e) => e.is_billable)
    .reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
  const uninvoicedCount = entries.filter((e) => e.is_billable && !e.is_invoiced).length;
  const weekAgo = mountedAt - 7 * 24 * 60 * 60 * 1000;
  const weekSeconds = entries
    .filter((e) => e.created_at && new Date(e.created_at).getTime() >= weekAgo)
    .reduce((sum, e) => sum + (e.duration_seconds || 0), 0);

  return (
    <div className="space-y-6">
      {/* 4 Headline Cards at the top (same as Clients) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 enter-stagger">
        {loading && entries.length === 0 ? (
          <>
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
          </>
        ) : (
          <>
            <StatCard
              label="Total Logged"
              value={fmtDur(totalSeconds)}
              icon={Clock}
              rows={[{ text: `${entries.length} session${entries.length === 1 ? "" : "s"}`, dot: "info" }]}
            />
            <StatCard
              label="Billable Hours"
              value={fmtDur(billableSeconds)}
              icon={DollarSign}
              rows={[{ text: billableSeconds > 0 ? "ready to invoice" : "nothing billable yet", dot: billableSeconds > 0 ? "ok" : "info" }]}
            />
            <StatCard
              label="Uninvoiced"
              value={uninvoicedCount}
              icon={Receipt}
              rows={[{ text: uninvoicedCount > 0 ? "entries waiting to bill" : "all billed up", dot: uninvoicedCount > 0 ? "warn" : "ok" }]}
            />
            <StatCard
              label="This Week"
              value={fmtDur(weekSeconds)}
              icon={TrendingUp}
              rows={[{ text: "last 7 days", dot: "info" }]}
            />
          </>
        )}
      </div>

      {/* Action Controls Row (same as Clients) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-2">
          <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
            {entries.length} Time Entry{entries.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading}
            className="border-line text-fg bg-card hover:bg-surface w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Interactive Timer Box (backed by a real-time DB session) */}
      <Card className="bg-card border-line p-6 space-y-4 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-1">
            <label className="text-xs font-semibold text-muted">Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={!!session}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent disabled:opacity-60"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="text-xs font-semibold text-muted">What are you doing?</label>
            <input
              type="text"
              value={session ? session.description ?? "" : description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!!session}
              placeholder="e.g. Building the homepage"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent disabled:opacity-60"
            />
          </div>

          <div className="md:col-span-1 flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <LiveTimerDisplay
                key={session ? `${session.id}:${session.elapsed_seconds}:${session.is_running}` : "idle"}
                session={session}
              />
            </div>

            {!session && (
              <Button onClick={handleStart} disabled={busy || projects.length === 0} className="bg-accent hover:bg-accent-hi text-accent-fg">
                <Play className="w-4 h-4 mr-1.5" />
                Start Timer
              </Button>
            )}
            {running && (
              <div className="flex items-center gap-2">
                <Button onClick={handlePause} disabled={busy} variant="outline" className="border-line text-fg">
                  <Pause className="w-4 h-4 mr-1.5" />
                  Pause
                </Button>
                <Button onClick={handleStop} disabled={busy} className="bg-accent hover:bg-accent-hi text-accent-fg">
                  <Square className="w-4 h-4 mr-1.5" />
                  Stop &amp; Save
                </Button>
              </div>
            )}
            {paused && (
              <div className="flex items-center gap-2">
                <Button onClick={handleResume} disabled={busy} className="bg-accent hover:bg-accent-hi text-accent-fg">
                  <Play className="w-4 h-4 mr-1.5" />
                  Resume
                </Button>
                <Button onClick={handleStop} disabled={busy} variant="outline" className="border-line text-fg">
                  <Square className="w-4 h-4 mr-1.5" />
                  Stop &amp; Save
                </Button>
              </div>
            )}
          </div>
        </div>

        {session && (
          <p className="text-xs text-faint pt-1 border-t border-line">
            Tracking <span className="text-fg font-medium">{session.project_title || "this project"}</span>
            {session.is_billable ? " • gets billed" : " • not billed"}
            {paused ? " • paused safely, close the tab if you want" : " • saving every second"}
          </p>
        )}
      </Card>

      {/* Time Log Cards (same visual language as Clients) */}
      {loading && entries.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[180px] w-full rounded-2xl" />
          ))}
        </div>
      ) : entries.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 stagger-grid">
          {entries.map((e) => (
            <CategoryVisualCard
              key={e.id}
              title={e.description || "Focus Session"}
              subtitle={e.project_title || "Unassigned"}
              onClick={() => e.project_id && router.push(`/dashboard/projects/${e.project_id}`)}
              topRightContent={
                <span className="font-mono text-sm font-bold text-info bg-info/10 border border-info/25 px-2.5 py-1 rounded-full">
                  {fmtDur(e.duration_seconds)}
                </span>
              }
              tags={
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-mono text-muted bg-surface px-2.5 py-0.5 rounded-full border border-line">
                    {e.created_at?.slice(0, 10)}
                  </span>
                  {!e.is_billable && (
                    <span className="text-[11px] font-medium text-muted bg-surface px-2.5 py-0.5 rounded-full border border-line">
                      not billed
                    </span>
                  )}
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleDelete(e.id);
                    }}
                    className="ml-auto text-faint hover:text-danger transition-colors cursor-pointer"
                    title="Delete time entry"
                    aria-label="Delete time entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              }
            />
          ))}
        </div>
      ) : (
        <Card className="bg-card border-dashed border-line p-12 text-center rounded-2xl">
          <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center mx-auto mb-3.5">
            <Clock className="w-6 h-6 text-accent" />
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">No time logged yet</h3>
          <p className="text-xs sm:text-sm text-muted mt-1 max-w-sm mx-auto leading-relaxed">
            Press Start Timer above — your hours are saved safely in the cloud, ready to invoice.
          </p>
        </Card>
      )}
    </div>
  );
}
