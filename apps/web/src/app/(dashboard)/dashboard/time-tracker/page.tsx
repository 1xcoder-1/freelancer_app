"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Clock,
  Play,
  Pause,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTimeEntries, logTimeEntry, deleteTimeEntry, getProjects } from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";

export default function TimeTrackerPage() {
  const { getToken } = useAuth();

  // Timer
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [description, setDescription] = useState("");

  const { data: pageData, loading, refresh: loadData } = useApiData(
    "time-tracker:data",
    async (token) => {
      const [entriesRes, projRes] = await Promise.all([
        getTimeEntries(token).catch(() => []),
        getProjects(token).catch(() => [])
      ]);
      return { entries: entriesRes, projects: projRes };
    },
    {
      reportContext: "time-tracker",
      onSuccess: (data) => {
        if (data.projects.length > 0) {
          setSelectedProjectId((prev) => prev || data.projects[0].id);
        }
      }
    }
  );

  const entries = pageData?.entries ?? [];
  const projects = pageData?.projects ?? [];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleStopAndSave = async () => {
    if (!selectedProjectId) {
      alert("Please select a project to log time for!");
      return;
    }
    setIsRunning(false);
    try {
      const token = (await getToken()) || undefined;
      await logTimeEntry({
        project_id: selectedProjectId,
        description: description || "Focus Session",
        duration_seconds: seconds,
        is_billable: true
      }, token);
      setSeconds(0);
      setDescription("");
      invalidateCache("dashboard:data");
      loadData();
    } catch (err) {
      console.error("Error saving time entry:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this time entry?")) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteTimeEntry(id, token);
      invalidateCache("dashboard:data");
      loadData();
    } catch (err) {
      console.error("Error deleting time entry:", err);
    }
  };

  const formatTimer = (total: number) => {
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">Time Tracking & Billing</h1>
            <Badge className="bg-info/10 text-info dark:text-info border-info/20 font-mono text-xs">
              1-Click Timer
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Track billable client hours and automatically convert them into itemized invoices.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={loading} className="border-line text-fg">
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Interactive Timer Box */}
      <Card className="bg-card border-line p-6 space-y-4 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-1">
            <label className="text-xs font-semibold text-muted">Select Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="text-xs font-semibold text-muted">Session Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you working on?"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div className="md:col-span-1 flex items-center justify-end gap-4">
            <span className="font-mono text-3xl font-bold text-info">{formatTimer(seconds)}</span>
            {isRunning ? (
              <Button onClick={handleStopAndSave} className="bg-accent hover:bg-accent-hi text-accent-fg">
                <Pause className="w-4 h-4 mr-1.5" />
                Stop & Log
              </Button>
            ) : (
              <Button onClick={() => setIsRunning(true)} className="bg-accent hover:bg-accent-hi text-accent-fg">
                <Play className="w-4 h-4 mr-1.5" />
                Start Timer
              </Button>
            )}
          </div>
        </div>
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
          <h3 className="text-lg font-semibold text-fg">No Time Logged Yet</h3>
          <p className="text-sm text-faint mt-1 max-w-md mx-auto">
            Click Start Timer above to record hours and save them directly to Neon PostgreSQL.
          </p>
        </Card>
      )}
    </div>
  );
}
