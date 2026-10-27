"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { PenLine, AlertCircle, Loader2, Eye } from "@/components/animated-icons";
import "@excalidraw/excalidraw/index.css";

import { getPublicPlannerBoard, type PublicPlannerBoard } from "@/lib/api";

const ExcalidrawRaw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  { ssr: false }
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Excalidraw = ExcalidrawRaw as React.ComponentType<any>;

// PL5 — anonymous, read-only view of a shared board: the sketch scene only.
// There is no edit affordance anywhere on this page, matching the server-side
// contract (the public route exposes no mutations).

export default function SharedPlannerPage() {
  const params = useParams();
  const token = params?.token as string;

  const [board, setBoard] = useState<PublicPlannerBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setError("This link is not valid.");
      setLoading(false);
      return;
    }
    try {
      setBoard(await getPublicPlannerBoard(token));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "This shared link is no longer available.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount; setState fires inside the async loader
    void load();
  }, [load]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-fg">
      {/* Top Bar — sleek dark aesthetic matching the planner editor */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 h-16 shrink-0 border-b border-line bg-card z-10">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
            <PenLine className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-sm text-fg tracking-tight truncate">
              Shared Board
            </h1>
          </div>
        </div>

        {/* Read-only status indicator badge */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/80 border border-line text-[11px] font-medium text-muted">
            <Eye className="w-3.5 h-3.5 text-accent" />
            <span>Read-only preview</span>
          </div>
        </div>
      </header>

      {/* Canvas Area */}
      <main className="flex-1 min-h-0 relative planner-canvas-wrapper w-full h-full">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-accent" /> Loading board…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full p-6">
            <div className="rounded-2xl border border-line bg-card p-10 text-center max-w-md shadow-2xl">
              <div className="mx-auto w-12 h-12 rounded-xl bg-danger/10 text-danger flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="font-display font-bold text-base text-fg">Link unavailable</h2>
              <p className="text-xs text-muted mt-1.5 leading-relaxed">{error}</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full">
            <Excalidraw
              initialData={{
                elements: board?.elements ?? [],
                appState: { viewModeEnabled: true, theme: "dark" },
              }}
              theme="dark"
              langCode="en"
              name="Sketch Board"
            />
          </div>
        )}
      </main>
    </div>
  );
}
