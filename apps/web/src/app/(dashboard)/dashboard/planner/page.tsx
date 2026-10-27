"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  PenLine,
  Plus,
  Trash2,
  PencilLine,
  Loader2,
  Kanban,
  RefreshCw,
  Share2,
  Layers,
} from "@/components/animated-icons";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/patterns";
import { CategoryVisualCard, ChaiCupIcon } from "@/components/dashboard/CategoryVisualCard";
import { NewBoardDialog } from "@/components/dashboard/NewBoardDialog";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import {
  listPlannerBoards,
  createPlannerBoard,
  renamePlannerBoard,
  deletePlannerBoard,
  type PlannerBoardSummary,
} from "@/lib/api";

// Sketch boards are the Planner's "files": a freelancer keeps several (one per
// project / idea). This page lists them; creating one drops straight into the
// full-page editor instead of opening a popup, per the product direction.
// (Task Management kanban boards live under /dashboard/planner/tasks.)

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

export default function PlannerPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [boards, setBoards] = useState<PlannerBoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount; setState fires inside the async loader
    void load();
  }, [load]);

  // Create a board (from the NewBoardDialog) and immediately open it — the
  // requested "file → auto-open" flow. The editor has an inline rename in its
  // header, but naming at creation feels right for a popup-first flow.
  const createBoard = async (name: string) => {
    if (creating) return;
    setCreating(true);
    try {
      const token = (await getToken()) || undefined;
      const board = await createPlannerBoard(name, token);
      router.push(`/dashboard/planner/${board.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create board");
      setCreating(false);
      setNewOpen(false);
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
      message: `Delete "${board.name}"? This cannot be undone.`,
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
  const sharedBoards = boards.filter((b) => b.has_share).length;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const updatedToday = boards.filter((b) => {
    const iso = b.updated_at;
    const normalized = iso && !iso.endsWith("Z") && !iso.includes("+") ? `${iso}Z` : iso;
    return new Date(normalized).getTime() >= startOfToday.getTime();
  }).length;

  return (
    <div className="space-y-6">
      {/* 3 Headline Cards at the top — sketch-board stats, straight from the
          summaries already fetched (no todo math anywhere on this page). */}
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
              label="Total Boards"
              value={totalBoards}
              icon={Layers}
              rows={[
                {
                  text: `${sharedBoards} shared read-only`,
                  dot: "info",
                },
              ]}
            />
            <StatCard
              label="Shared Boards"
              value={sharedBoards}
              icon={Share2}
              rows={[
                {
                  text: sharedBoards > 0 ? "Live read-only links" : "Nothing shared yet",
                  dot: sharedBoards > 0 ? "ok" : "info",
                },
              ]}
            />
            <StatCard
              label="Updated Today"
              value={updatedToday}
              icon={PenLine}
              rows={[
                {
                  text: updatedToday > 0 ? "Sketched on today" : "No edits today",
                  dot: updatedToday > 0 ? "ok" : "info",
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
            A board is a blank canvas for a project or idea — sketch it out
            freely. Everything syncs live across your tabs.
          </p>
          <div className="mt-5 flex justify-center">
            <button
              onClick={() => setNewOpen(true)}
              className="press inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create your first board</span>
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 stagger-grid">
          {boards.map((board) => {
            const updated = relativeTime(board.updated_at);

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
                subtitle={updated ? `Updated ${updated}` : "Updated recently"}
                hidePrefix
                onClick={() => router.push(`/dashboard/planner/${board.id}`)}
                topRightContent={
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
      />
    </div>
  );
}
