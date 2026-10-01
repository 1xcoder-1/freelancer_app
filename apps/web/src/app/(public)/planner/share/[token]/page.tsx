"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { PenLine, Calendar, Clock, AlertCircle, Loader2, Eye } from "lucide-react";
import "@excalidraw/excalidraw/index.css";

import { getPublicPlannerBoard, type PublicPlannerBoard, type PlannerTodo } from "@/lib/api";

const ExcalidrawRaw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  { ssr: false }
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Excalidraw = ExcalidrawRaw as React.ComponentType<any>;

// PL5 — anonymous, read-only view of a shared board: the scene + OPEN todos
// only. There is no edit affordance anywhere on this page, matching the
// server-side contract (the public route exposes no mutations).

function fmtMinute(min: number | null | undefined): string {
  if (min == null) return "";
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function TodoLine({ todo }: { todo: PlannerTodo }) {
  return (
    <li className="flex items-start gap-2 px-3 py-2 rounded-lg bg-card border border-line">
      <span className="mt-0.5 w-4 h-4 rounded border border-line-strong shrink-0" />
      <div className="min-w-0">
        <span className="block text-sm text-fg">{todo.text}</span>
        {(todo.due_date || todo.start_minute != null || (todo.priority && todo.priority !== "medium")) && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] mt-1">
            {todo.priority && todo.priority !== "medium" && (
              <span className="px-1.5 py-0.5 rounded bg-surface text-muted capitalize">{todo.priority}</span>
            )}
            {todo.due_date && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface text-muted">
                <Calendar className="w-3 h-3" />{todo.due_date}
              </span>
            )}
            {todo.start_minute != null && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-info/10 text-info">
                <Clock className="w-3 h-3" />{fmtMinute(todo.start_minute)}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

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
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-surface text-fg">
      <header className="sticky top-0 z-10 border-b border-line bg-card/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <PenLine className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-[15px] truncate">{board?.name ?? "Shared board"}</h1>
              <p className="text-[11px] text-muted flex items-center gap-1">
                <Eye className="w-3 h-3" /> Read-only preview
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted text-sm">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading shared plan…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-card p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="font-display font-bold text-lg text-fg">Link unavailable</h2>
            <p className="text-sm text-muted mt-1 max-w-sm mx-auto">{error}</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <aside>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                Open items ({board?.todos.length ?? 0})
              </h2>
              {board && board.todos.length > 0 ? (
                <ul className="space-y-2">
                  {board.todos.map((t) => (
                    <TodoLine key={t.id} todo={t} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-faint">Nothing open right now.</p>
              )}
            </aside>

            <section className="h-[70vh] min-h-[420px] rounded-2xl border border-line overflow-hidden bg-card">
              <Excalidraw
                initialData={{
                  elements: board?.elements ?? [],
                  appState: { viewModeEnabled: true },
                }}
                langCode="en"
                name={board?.name}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
