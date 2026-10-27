"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Kanban,
  Plus,
  Trash2,
  PencilLine,
  Loader2,
  RefreshCw,
  Layers,
  CheckCircle2,
  ListChecks,
} from "@/components/animated-icons";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/patterns";
import { CategoryVisualCard, ChaiCupIcon } from "@/components/dashboard/CategoryVisualCard";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { NewBoardDialog } from "@/components/dashboard/NewBoardDialog";
import {
  getTaskBoards,
  createTaskBoard,
  updateTaskBoard,
  deleteTaskBoard,
  type TaskBoardSummary,
} from "@/lib/api";
import { resolveBoardBackground, unsplashVariant } from "@/components/dashboard/tasks/task-ui";

// Task Management boards — the kanban counterpart of the sketch boards list.
// Creating a board seeds its three default lists ("Pending" / "In Progress" /
// "Done") server-side and drops straight into the full board view. Background
// thumbnails share the board view's encoding (task-ui.ts): gradients render as
// swatches, Unsplash URLs request a w=200 variant so the grid never downloads
// full-size images.

function relativeTime(iso: string): string {
  if (!iso) return "just now";
  const normalized = iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`;
  const then = new Date(normalized).getTime();
  if (Number.isNaN(then)) {
    const raw = new Date(iso).getTime();
    if (Number.isNaN(raw)) return "recently";
  }
  const timestamp = Number.isNaN(then) ? new Date(iso).getTime() : then;
  const diff = Math.max(0, Date.now() - timestamp);
  const secs = Math.round(diff / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const chip =
  "text-[11px] font-medium px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1";
const chipOrange =
  "text-orange-700 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/15 border-orange-500/20 dark:border-orange-500/25 font-mono";
const chipAmber =
  "bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25 font-semibold";
const chipNeutral =
  "bg-slate-500/10 dark:bg-white/5 border-slate-200/90 dark:border-white/10 text-slate-600 dark:text-slate-300";

export default function TaskManagementPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [boards, setBoards] = useState<TaskBoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = (await getToken()) || undefined;
      setBoards(await getTaskBoards(token));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load boards");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount; setState fires inside the async loader
    void load();
  }, [load]);

  // Create a named board (default lists are seeded server-side) and open it —
  // using the same popup dialog flow that the planner sketch boards use.
  const createBoard = async (name: string) => {
    if (creating) return;
    setCreating(true);
    try {
      const token = (await getToken()) || undefined;
      const board = await createTaskBoard(
        { name: name.trim() || "Untitled board" },
        token
      );
      router.push(`/dashboard/planner/tasks/${board.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create board");
      setCreating(false);
      setNewOpen(false);
    }
  };

  const commitRename = async (board: TaskBoardSummary, value: string) => {
    setEditingId(null);
    const trimmed = value.trim();
    if (!trimmed || trimmed === board.name) return;
    try {
      const token = (await getToken()) || undefined;
      const updated = await updateTaskBoard(board.id, { name: trimmed }, token);
      setBoards((prev) => prev.map((b) => (b.id === board.id ? { ...b, ...updated } : b)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename board");
    }
  };

  const remove = async (board: TaskBoardSummary) => {
    const ok = await confirmDialog({
      message: `Delete "${board.name}" and all its lists and cards? This cannot be undone.`,
      danger: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteTaskBoard(board.id, token);
      setBoards((prev) => prev.filter((b) => b.id !== board.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete board");
    }
  };

  const totalBoards = boards.length;
  const totalLists = boards.reduce((acc, b) => acc + b.list_count, 0);
  const totalCards = boards.reduce((acc, b) => acc + b.card_count, 0);
  const totalDone = boards.reduce((acc, b) => acc + b.done_count, 0);
  const openCards = Math.max(0, totalCards - totalDone);

  return (
    <div className="space-y-6">
      {/* Headline cards at the top — counts come straight from the API rollup */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 enter-stagger">
        {loading && boards.length === 0 ? (
          <>
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
          </>
        ) : (
          <>
            <StatCard
              label="Boards"
              value={totalBoards}
              icon={Kanban}
              rows={[
                {
                  text: `${totalLists} list${totalLists === 1 ? "" : "s"} across boards`,
                  dot: "info",
                },
              ]}
            />
            <StatCard
              label="Cards"
              value={totalCards}
              icon={Layers}
              rows={[
                {
                  text: openCards > 0 ? `${openCards} still open` : "Nothing open",
                  dot: openCards > 0 ? "warn" : "ok",
                },
              ]}
            />
            <StatCard
              label="Done"
              value={totalDone}
              icon={CheckCircle2}
              rows={[
                {
                  text: totalCards > 0 ? `${Math.round((totalDone / totalCards) * 100)}% of all cards` : "No cards yet",
                  dot: totalDone > 0 ? "ok" : "info",
                },
              ]}
            />
          </>
        )}
      </div>

      {/* Action controls row: counter, refresh and the named create flow */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-muted shrink-0" />
          <span className="text-xs font-mono text-muted">
            {totalBoards} Board{totalBoards === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="press inline-flex items-center justify-center w-9 h-9 rounded-xl border border-line text-fg bg-card hover:bg-surface transition-colors disabled:opacity-60 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setNewOpen(true)}
            className="press inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 h-9 rounded-xl bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Board</span>
          </button>
        </div>
      </div>

      {/* Board Cards */}
      {loading && boards.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <Card className="bg-card border-dashed border-line p-10 text-center rounded-2xl">
          <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center mx-auto mb-3.5">
            <ChaiCupIcon className="w-6 h-6" />
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">No boards yet</h3>
          <p className="text-xs sm:text-sm text-muted mt-1 max-w-sm mx-auto leading-relaxed">
            A board is a kanban for a project or stream of work — it starts with
            Pending, In Progress and Done lists, ready for cards.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 stagger-grid">
          {boards.map((board) => {
            const updated = relativeTime(board.updated_at);
            const allDone = board.card_count > 0 && board.done_count === board.card_count;

            const statusBadge =
              board.card_count === 0 ? null : allDone ? (
                <span className={`${chip} ${chipAmber}`}>All done</span>
              ) : (
                <span className={`${chip} ${chipOrange} font-mono`}>
                  {board.done_count}/{board.card_count} done
                </span>
              );

            return editingId === board.id ? (
              <div
                key={board.id}
                className="rounded-2xl border border-accent/50 bg-card p-5 sm:p-6 min-h-[175px] sm:min-h-[180px] flex flex-col justify-center"
              >
                <input
                  autoFocus
                  defaultValue={board.name}
                  onBlur={(e) => void commitRename(board, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void commitRename(board, (e.target as HTMLInputElement).value);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  maxLength={200}
                  className="input-line"
                />
                <p className="text-[11px] text-faint mt-2">Enter to save · Esc to cancel</p>
              </div>
            ) : (
              <CategoryVisualCard
                key={board.id}
                title={board.name}
                subtitle={updated ? `Updated ${updated}` : "Updated recently"}
                hidePrefix
                onClick={() => router.push(`/dashboard/planner/tasks/${board.id}`)}
                icon={
                  (() => {
                    const bg = resolveBoardBackground(board.background_kind, board.background_url);
                    if (bg.type === "image") {
                      return (
                        // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote board backgrounds (any CDN), next/image has no configured domains
                        <img
                          src={unsplashVariant(bg.url, 200)}
                          alt=""
                          className="w-7 h-7 rounded-md object-cover border border-line"
                        />
                      );
                    }
                    if (bg.type === "gradient") {
                      return (
                        <span
                          aria-hidden
                          className="w-7 h-7 rounded-md border border-line inline-block"
                          style={{ background: bg.css }}
                        />
                      );
                    }
                    return undefined;
                  })()
                }
                topRightContent={
                  <div className="flex items-center gap-1.5">
                    {statusBadge}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(board.id);
                        }}
                        title="Rename"
                        className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-surface cursor-pointer"
                      >
                        <PencilLine className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void remove(board);
                        }}
                        title="Delete"
                        className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-surface cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                }
                tags={
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`${chip} ${chipNeutral} font-mono`}>
                      {board.list_count} list{board.list_count === 1 ? "" : "s"}
                    </span>
                    <span className={`${chip} ${chipOrange}`}>
                      <Kanban className="w-3 h-3" />
                      {board.card_count} card{board.card_count === 1 ? "" : "s"}
                    </span>
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      <NewBoardDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        creating={creating}
        onCreate={(name) => void createBoard(name)}
        title="New Board"
        description="Create a kanban board to manage tasks and projects."
        icon={<Kanban className="w-5 h-5 text-accent" />}
        placeholder="e.g. Website Launch Tasks"
      />
    </div>
  );
}
