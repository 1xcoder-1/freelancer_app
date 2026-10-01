"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  PenLine,
  Plus,
  Trash2,
  PencilLine,
  Loader2,
  CheckSquare,
  RefreshCw,
  ArrowRight,
  Share2,
  AlertCircle,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import {
  listPlannerBoards,
  createPlannerBoard,
  renamePlannerBoard,
  deletePlannerBoard,
  type PlannerBoardSummary,
} from "@/lib/api";

// Boards are the Planner's "files": a freelancer keeps several (one per
// project / idea). This page lists them; creating one drops straight into the
// full-page editor instead of opening a popup, per the product direction.

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function PlannerPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [boards, setBoards] = useState<PlannerBoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = (await getToken()) || undefined;
      setBoards(await listPlannerBoards(token));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load boards");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Create a board and immediately open it — the requested "file → auto-open"
  // flow. No name prompt: the editor has an inline rename in its header.
  const createBoard = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const token = (await getToken()) || undefined;
      const board = await createPlannerBoard("Untitled board", token);
      router.push(`/dashboard/planner/${board.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create board");
      setCreating(false);
    }
  };

  const commitRename = async (board: PlannerBoardSummary, value: string) => {
    setEditingId(null);
    const trimmed = value.trim();
    if (!trimmed || trimmed === board.name) return;
    try {
      const token = (await getToken()) || undefined;
      const updated = await renamePlannerBoard(board.id, trimmed, token);
      setBoards((prev) => prev.map((b) => (b.id === board.id ? { ...b, ...updated } : b)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename board");
    }
  };

  const remove = async (board: PlannerBoardSummary) => {
    const ok = await confirmDialog({
      message: `Delete "${board.name}" and all its todos? This cannot be undone.`,
      danger: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      const token = (await getToken()) || undefined;
      await deletePlannerBoard(board.id, token);
      setBoards((prev) => prev.filter((b) => b.id !== board.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete board");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
            <PenLine className="w-5 h-5" />
          </span>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg leading-tight">Planner</h1>
            <p className="text-sm text-muted">
              Todo list + freeform sketch board, merged into one planning surface.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            className="rounded-lg border-line text-fg"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            onClick={() => void createBoard()}
            disabled={creating}
            className="rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-1" />
            )}
            New board
          </Button>
        </div>
      </div>

      {/* Boards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 rounded-2xl border border-line bg-card animate-pulse" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-card p-12 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-4">
            <PenLine className="w-7 h-7" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">No boards yet</h2>
          <p className="text-sm text-muted mt-1 mb-5 max-w-sm mx-auto">
            A board is a blank canvas for a project or idea. Sketch it out and tick
            off the todos as you go — everything syncs live across your tabs.
          </p>
          <Button
            onClick={() => void createBoard()}
            disabled={creating}
            className="rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-1" />
            )}
            Create your first board
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => {
            const open = () => router.push(`/dashboard/planner/${board.id}`);
            return (
              <div
                key={board.id}
                onClick={open}
                className="group relative flex flex-col rounded-2xl border border-line bg-card p-5 cursor-pointer transition-all hover:border-accent/50 hover:shadow-lg hover:shadow-black/5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
                    <PenLine className="w-4 h-4" />
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(board.id); }}
                      title="Rename"
                      className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-surface"
                    >
                      <PencilLine className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); void remove(board); }}
                      title="Delete"
                      className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-surface"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {editingId === board.id ? (
                  <input
                    autoFocus
                    defaultValue={board.name}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => void commitRename(board, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitRename(board, (e.target as HTMLInputElement).value);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    maxLength={255}
                    className="mt-3 input-line text-sm font-semibold"
                  />
                ) : (
                  <h3 className="mt-3 font-semibold text-fg truncate" title={board.name}>
                    {board.name}
                  </h3>
                )}

                <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <CheckSquare className="w-3.5 h-3.5" />
                    {board.done_count}/{board.todos_count} done
                  </span>
                  <span>·</span>
                  <span>{relativeTime(board.updated_at)}</span>
                </div>

                {/* PL6 live Today column — where today's work actually lives */}
                {(board.overdue_count > 0 || board.due_today_count > 0 || board.planned_today_count > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {board.overdue_count > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-danger/10 text-danger">
                        <AlertCircle className="w-3 h-3" />{board.overdue_count} overdue
                      </span>
                    )}
                    {board.due_today_count > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-warn/10 text-warn">
                        <CalendarClock className="w-3 h-3" />{board.due_today_count} due today
                      </span>
                    )}
                    {board.planned_today_count > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-info/10 text-info">
                        {board.planned_today_count} timeboxed
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                  <span className="font-mono text-[11px] text-faint">rev {board.revision}</span>
                  <div className="flex items-center gap-2">
                    {board.has_share && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent" title="Shared read-only">
                        <Share2 className="w-3.5 h-3.5" />Shared
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
