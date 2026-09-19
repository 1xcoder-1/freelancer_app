"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Clock,
  Play,
  Pause,
  Plus,
  Trash2,
  RefreshCw,
  FolderKanban,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTimeEntries, logTimeEntry, deleteTimeEntry, getProjects, type TimeEntry, type Project } from "@/lib/api";

export default function TimeTrackerPage() {
  const { getToken } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Timer
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = (await getToken()) || undefined;
      const [entriesRes, projRes] = await Promise.all([
        getTimeEntries(token).catch(() => []),
        getProjects(token).catch(() => [])
      ]);
      setEntries(entriesRes);
      setProjects(projRes);
      if (projRes.length > 0) {
        setSelectedProjectId(projRes[0].id);
      }
    } catch (err) {
      console.error("Error loading time entries:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-white">Time Tracking & Billing</h1>
            <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 font-mono text-xs">
              1-Click Timer
            </Badge>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Track billable client hours and automatically convert them into itemized invoices.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="border-white/10 text-slate-300">
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Interactive Timer Box */}
      <Card className="bg-slate-900 border-white/10 p-6 space-y-4 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-1">
            <label className="text-xs font-semibold text-slate-400">Select Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="text-xs font-semibold text-slate-400">Session Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you working on?"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-1 flex items-center justify-end gap-4">
            <span className="font-mono text-3xl font-bold text-cyan-400">{formatTimer(seconds)}</span>
            {isRunning ? (
              <Button onClick={handleStopAndSave} className="bg-amber-600 hover:bg-amber-500 text-white">
                <Pause className="w-4 h-4 mr-1.5" />
                Stop & Log
              </Button>
            ) : (
              <Button onClick={() => setIsRunning(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white">
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
            <Card key={i} className="bg-slate-900/40 border-white/5 p-4 flex items-center justify-between">
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
            <Card key={e.id} className="bg-slate-900/40 border-white/10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{e.description || "Focus Session"}</h4>
                  <p className="text-xs text-slate-400">{e.project_title} • {e.created_at?.slice(0, 10)}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-mono text-sm font-semibold text-cyan-400">
                  {formatTimer(e.duration_seconds)}
                </span>
                <button
                  onClick={() => handleDelete(e.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-slate-900/20 border-dashed border-white/10 p-12 text-center">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-200">No Time Logged Yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Click Start Timer above to record hours and save them directly to Neon PostgreSQL.
          </p>
        </Card>
      )}
    </div>
  );
}
