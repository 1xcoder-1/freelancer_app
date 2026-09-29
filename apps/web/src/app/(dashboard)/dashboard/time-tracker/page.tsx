"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Clock,
  Play,
  Pause,
  Square,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function TimeTrackerPage() {
  const { getToken } = useAuth();

  // Server-authoritative timer: the run lives in the DB, so this component only
  // renders it. `drift` is the wall-clock seconds since the last server sync,
  // added purely for a smooth ticking display while running.
  const [session, setSession] = useState<TimerSession | null>(null);
  const [drift, setDrift] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const driftTimer = useRef<NodeJS.Timeout | null>(null);

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
        setDrift(0);
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

  // Tick the display clock while a run is active.
  useEffect(() => {
    if (driftTimer.current) clearInterval(driftTimer.current);
    if (session?.is_running) {
      driftTimer.current = setInterval(() => setDrift((d) => d + 1), 1000);
    }
    return () => {
      if (driftTimer.current) clearInterval(driftTimer.current);
    };
  }, [session?.is_running]);

  // Re-sync to server truth when the tab regains focus (long idle, phone swap).
  useEffect(() => {
    const onFocus = async () => {
      const token = (await getToken()) || undefined;
      await syncActive(token);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [getToken, syncActive]);

  const displayedSeconds = session
    ? session.elapsed_seconds + (session.is_running ? drift : 0)
    : 0;

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
      setDrift(0);
      toast.success("Timer started");
    } catch (err) {
      console.error("Error starting timer:", err);
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
      setDrift(0);
    } catch (err) {
      console.error("Error pausing timer:", err);
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
      setDrift(0);
    } catch (err) {
      console.error("Error resuming timer:", err);
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
      setDrift(0);
      setDescription("");
      invalidateCache("dashboard:data");
      loadData();
      toast.success("Time saved");
    } catch (err) {
      console.error("Error stopping timer:", err);
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
      console.error("Error deleting time entry:", err);
      toast.error("Could not delete time entry");
    }
  };

  const formatTimer = (total: number) => {
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const running = !!session?.is_running;
  const paused = !!session && !session.is_running;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">Time</h1>
          <p className="text-muted text-sm mt-1">
            Start the clock, stop it, and the hours are ready to bill. It keeps counting even if you
            close the tab or switch devices.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData(true)}
          disabled={loading}
          className="border-line text-fg w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
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
              <span className="font-mono text-3xl font-bold text-info">{formatTimer(displayedSeconds)}</span>
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

      {/* Time Log Table from Neon DB with Skeleton Loading */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card border-line p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            </Card>
          ))}
        </div>
      ) : entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map((e) => (
            <Card key={e.id} className="bg-card border-line p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-info/10 text-info dark:text-info">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-fg">{e.description || "Focus Session"}</h4>
                  <p className="text-xs text-muted">{e.project_title} • {e.created_at?.slice(0, 10)}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-mono text-sm font-semibold text-info">
                  {formatTimer(e.duration_seconds)}
                </span>
                <button
                  onClick={() => handleDelete(e.id)}
                  className="text-faint hover:text-danger transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-dashed border-line p-12 text-center">
          <Clock className="w-12 h-12 text-faint mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-fg">No time logged yet</h3>
          <p className="text-sm text-faint mt-1 max-w-md mx-auto">
            Press Start Timer above — your hours are saved safely in the cloud, ready to invoice.
          </p>
        </Card>
      )}
    </div>
  );
}
