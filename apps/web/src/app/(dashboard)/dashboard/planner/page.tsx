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
  AlertCircle,
  CalendarClock,
  Layers,
} from "@/components/animated-icons";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/patterns";
import { CategoryVisualCard, ChaiCupIcon } from "@/components/dashboard/CategoryVisualCard";
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

const chip =
  "text-[11px] font-medium px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1";
const chipOrange =
  "text-orange-700 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/15 border-orange-500/20 dark:border-orange-500/25 font-mono";
const chipRed =
  "bg-red-500/10 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20 dark:border-red-500/25 font-semibold";
const chipAmber =
  "bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25 font-semibold";
const chipAccent =
  "bg-accent/10 text-accent border-accent/20 font-semibold";
const chipNeutral =
  "bg-slate-500/10 dark:bg-white/5 border-slate-200/90 dark:border-white/10 text-slate-600 dark:text-slate-300";

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

  const totalBoards = boards.length;
  const openTodos = boards.reduce((acc, b) => acc + Math.max(0, b.todos_count - b.done_count), 0);
  const dueToday = boards.reduce((acc, b) => acc + b.due_today_count, 0);
  const overdue = boards.reduce((acc, b) => acc + b.overdue_count, 0);
  const timeboxedToday = boards.reduce((acc, b) => acc + b.planned_today_count, 0);

  return (
    <div className="space-y-6">
      {/* 4 Headline Cards at the top */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 enter-stagger">
        {loading && boards.length === 0 ? (
          <>
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
          </>
        ) : (
          <>
            <StatCard
              label="Total Boards"
              value={totalBoards}
              icon={Layers}
              rows={[
                {
                  text: `${openTodos} todo${openTodos === 1 ? "" : "s"} tracked`,
                  dot: "info",
                },
              ]}
            />
            <StatCard
              label="Open Todos"
              value={openTodos}
              icon={CheckSquare}
              rows={[
                {
                  text: openTodos > 0 ? "Still on the list" : "All clear",
                  dot: openTodos > 0 ? "warn" : "ok",
                },
              ]}
            />
            <StatCard
              label="Due Today"
              value={dueToday}
              icon={CalendarClock}
              rows={[
                {
                  text: dueToday > 0 ? "Scheduled for today" : "Nothing due today",
                  dot: dueToday > 0 ? "amber" : "ok",
                },
              ]}
            />
            <StatCard
              label="Overdue"
              value={overdue}
              icon={AlertCircle}
              rows={[
                {
                  text: overdue > 0 ? "Needs attention" : "All caught up",
                  dot: overdue > 0 ? "danger" : "ok",
                },
              ]}
            />
          </>
        )}
      </div>

      {/* Action Controls Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-2">
          <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
            {totalBoards} Board{totalBoards === 1 ? "" : "s"}
          </Badge>
          {timeboxedToday > 0 && (
            <span className="text-xs font-mono text-muted hidden sm:inline">
              {timeboxedToday} timeboxed today
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="border-line text-fg bg-card hover:bg-surface w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <button
            onClick={() => void createBoard()}
            disabled={creating}
            className="press inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 h-9 rounded-xl bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm cursor-pointer disabled:opacity-60"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
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
            A board is a blank canvas for a project or idea — sketch it out and tick
            off the todos as you go. Everything syncs live across your tabs.
          </p>
          <div className="mt-5 flex justify-center">
            <button
              onClick={() => void createBoard()}
              disabled={creating}
              className="press inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm cursor-pointer disabled:opacity-60"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Create your first board</span>
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 stagger-grid">
          {boards.map((board) => {
            const updated = relativeTime(board.updated_at);

            const statusBadge =
              board.overdue_count > 0 ? (
                <span className={`${chip} ${chipRed}`}>
                  <AlertCircle className="w-3 h-3" />
                  {board.overdue_count} overdue
                </span>
              ) : board.due_today_count > 0 ? (
                <span className={`${chip} ${chipAmber}`}>
                  <CalendarClock className="w-3 h-3" />
                  {board.due_today_count} due today
                </span>
              ) : board.has_share ? (
                <span className={`${chip} ${chipAccent}`}>Shared</span>
              ) : (
                <span className={`${chip} ${chipNeutral}`}>On track</span>
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
                  maxLength={255}
                  className="input-line"
                />
                <p className="text-[11px] text-faint mt-2">Enter to save · Esc to cancel</p>
              </div>
            ) : (
              <CategoryVisualCard
                key={board.id}
                title={board.name}
                subtitle={updated ? `Updated ${updated}` : "Recently updated"}
                hidePrefix
                onClick={() => router.push(`/dashboard/planner/${board.id}`)}
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
                    <span className={`${chip} ${chipOrange}`}>
                      <CheckSquare className="w-3 h-3" />
                      {board.done_count}/{board.todos_count} done
                    </span>
                    {board.planned_today_count > 0 && (
                      <span className={`${chip} ${chipAccent} font-mono`}>
                        {board.planned_today_count} timeboxed
                      </span>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
