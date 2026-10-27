"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { CalendarDays, Clock, Loader2, RotateCcw, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { getPlannerSnapshot, listPlannerSnapshots, type PlannerSnapshotSummary } from "@/lib/api";

interface PlannerHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  /** Restores the day into the live board (API + canvas repaint + toast). */
  onRestore: (capturedOn: string) => Promise<void>;
}

function formatDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getRelativeDateLabel(isoDate: string): string {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (isoDate === today) return "Today";
  if (isoDate === yesterday) return "Yesterday";
  return formatDay(isoDate);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function PlannerHistoryDialog({ open, onOpenChange, boardId, onRestore }: PlannerHistoryDialogProps) {
  const { getToken } = useAuth();
  const [snapshots, setSnapshots] = useState<PlannerSnapshotSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewEmpty, setPreviewEmpty] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const previewTokenRef = useRef(0);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const token = (await getToken()) || undefined;
      const rows = await listPlannerSnapshots(boardId, token);
      setSnapshots(rows);
      setSelected(rows[0]?.captured_on ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [boardId, getToken]);

  // Load the day list each time the dialog opens (cheap; days are few).
  useEffect(() => {
    if (open) void fetchSnapshots();
  }, [open, fetchSnapshots]);

  // Render the selected day's scene into a preview image via Excalidraw's
  // exporter (lazily imported — same chunk as the editor canvas).
  useEffect(() => {
    if (!open || !selected) {
      setPreviewUrl(null);
      setPreviewEmpty(false);
      return;
    }
    const token = ++previewTokenRef.current;
    (async () => {
      setPreviewLoading(true);
      setPreviewUrl(null);
      setPreviewEmpty(false);
      try {
        const auth = (await getToken()) || undefined;
        const detail = await getPlannerSnapshot(boardId, selected, auth);
        const lib = await import("@excalidraw/excalidraw");
        // The API returns the stored scene as raw JSON; the editor saved it,
        // so trust its shape and let restore validate the details.
        const data = {
          elements: detail.elements ?? [],
          files: detail.files ?? {},
        } as unknown as Parameters<typeof lib.restore>[0];
        const restored = lib.restore(data, null, null);
        if (token !== previewTokenRef.current) return;
        if (!restored.elements.length) {
          setPreviewEmpty(true);
          return;
        }
        const canvas = await lib.exportToCanvas({
          elements: restored.elements,
          files: restored.files ?? {},
          appState: { exportBackground: true, viewBackgroundColor: "#141518" },
        });
        if (token !== previewTokenRef.current) return;
        setPreviewUrl(canvas.toDataURL("image/png"));
      } catch {
        if (token === previewTokenRef.current) setPreviewEmpty(true);
      } finally {
        if (token === previewTokenRef.current) setPreviewLoading(false);
      }
    })();
  }, [open, selected, boardId, getToken]);

  const restoreDay = async () => {
    if (!selected || restoring) return;
    const ok = await confirmDialog({
      title: `Restore ${formatDay(selected)}?`,
      message: "The current board will be replaced by this day's snapshot.",
      confirmLabel: "Restore Board",
    });
    if (!ok) return;
    setRestoring(true);
    try {
      await onRestore(selected);
      onOpenChange(false);
    } finally {
      setRestoring(false);
    }
  };

  const selectedSnapshot = snapshots.find((s) => s.captured_on === selected);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-w-3xl p-0 rounded-2xl border border-line bg-[#161617] shadow-2xl overflow-hidden scrollbar-none"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        {/* Clean Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-line bg-surface text-fg shadow-xs">
              <CalendarDays className="w-4 h-4 text-accent" />
            </div>
            <h2 className="font-display text-base font-bold text-fg tracking-tight">
              Day History
            </h2>
          </div>

          {/* Single, working Close Button */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-fg hover:bg-surface border border-line/60 transition-all cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two column layout: Timeline on left, Preview on right */}
        <div className="flex h-[430px] sm:h-[470px]">
          {/* Day list */}
          <div className="w-48 sm:w-60 shrink-0 border-r border-line bg-surface/20 overflow-y-auto scrollbar-none p-3 space-y-1.5">
            {loading ? (
              <div className="flex items-center justify-center h-full text-muted text-xs">
                <Loader2 className="w-4 h-4 animate-spin mr-2 text-accent" /> Loading…
              </div>
            ) : snapshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-4 text-center">
                <Clock className="w-6 h-6 text-faint mb-2" />
                <p className="text-xs font-semibold text-fg">No snapshots yet</p>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">
                  Snapshots are captured automatically once per day when you edit.
                </p>
              </div>
            ) : (
              snapshots.map((s) => {
                const active = s.captured_on === selected;
                return (
                  <button
                    key={s.captured_on}
                    type="button"
                    onClick={() => setSelected(s.captured_on)}
                    className={`w-full text-left rounded-xl px-3.5 py-2.5 transition-all cursor-pointer border ${
                      active
                        ? "bg-accent/15 border-accent/40 text-accent font-semibold shadow-xs"
                        : "border-transparent bg-surface/40 hover:bg-surface/80 hover:border-line text-fg/85"
                    }`}
                  >
                    <p className={`text-xs font-medium tracking-tight ${active ? "text-accent font-semibold" : "text-fg"}`}>
                      {getRelativeDateLabel(s.captured_on)}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {/* Preview Panel */}
          <div className="flex-1 min-w-0 flex flex-col bg-bg/40">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line bg-surface/30 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-fg truncate">
                  {selected ? formatDay(selected) : "No snapshot selected"}
                </span>
                {selectedSnapshot && (
                  <>
                    <span className="text-faint text-xs">·</span>
                    <span className="text-xs text-muted truncate">
                      {formatTime(selectedSnapshot.created_at)}
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => void restoreDay()}
                disabled={!selected || restoring || previewLoading}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg text-xs font-semibold shadow-xs transition-all active:scale-[0.97] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {restoring ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Restore
              </button>
            </div>

            <div className="flex-1 min-h-0 flex items-center justify-center p-5 overflow-hidden relative">
              {/* Subtle background drafting grid */}
              <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
                  backgroundSize: "16px 16px",
                }}
              />

              {previewLoading ? (
                <div className="flex items-center gap-2 text-muted text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  <span>Rendering snapshot…</span>
                </div>
              ) : previewUrl ? (
                <div className="w-full h-full flex items-center justify-center overflow-auto scrollbar-none p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- locally generated PNG data URL */}
                  <img
                    src={previewUrl}
                    alt={`Snapshot of ${selected}`}
                    className="max-w-full max-h-full rounded-xl border border-line shadow-2xl object-contain bg-[#141518]"
                  />
                </div>
              ) : previewEmpty ? (
                <p className="text-xs text-muted text-center max-w-[240px]">
                  This snapshot contains no board elements.
                </p>
              ) : (
                <p className="text-xs text-muted text-center">Select a day to preview</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
