"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  PenLine,
  Loader2,
  ArrowLeft,
  PencilLine,
  Share2,
  History,
} from "@/components/animated-icons";
import { toast } from "sonner";

import "@excalidraw/excalidraw/index.css";

const ExcalidrawRaw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  { ssr: false, loading: () => <CanvasSkeleton /> }
);
// next/dynamic's wrapper drops component refs, so the imperative API comes
// through the excalidrawAPI callback prop instead (see the <Excalidraw> mount).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Excalidraw = ExcalidrawRaw as React.ComponentType<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawAPI = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SceneElements = any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BinaryFiles = Record<string, any>;

import { Button } from "@/components/ui/button";
import {
  getPlannerBoard,
  getPlannerBoardHead,
  savePlannerBoard,
  renamePlannerBoard,
  enablePlannerShare,
  rotatePlannerShareToken,
  disablePlannerShare,
  restorePlannerSnapshot,
  type PlannerShare,
  type ApiError,
} from "@/lib/api";
import { PlannerShareDialog } from "@/components/dashboard/PlannerShareDialog";
import { PlannerHistoryDialog } from "@/components/dashboard/PlannerHistoryDialog";

// Real-time cadence. The poll hits the cheap /head endpoint (revision only for
// the UI), so it stays fast and never moves scene bytes unless the revision
// actually changed — this is what stops the old "timeout of 15000ms exceeded"
// that the whole-scene-every-4s poll triggered on a cold DB.
const POLL_MS = 3_500;
const SAVE_DEBOUNCE_MS = 900;

// Fingerprint of the exact scene content. We filter out deleted elements and
// sort so that internal Excalidraw element re-ordering or transient deleted flags
// do not cause false-positive saves.
const sceneFingerprint = (elements: SceneElements, files: BinaryFiles) => {
  const nonDeleted = (elements ?? []).filter((el: any) => !el?.isDeleted);
  const elStr = nonDeleted
    .map((el: any) => `${el.id}:${el.version}`)
    .sort()
    .join(",");
  const fileStr = Object.keys(files ?? {}).sort().join(",");
  return `${elStr}|${fileStr}`;
};

// The fingerprint of the scene the server last confirmed (via a remote apply
// or a successful save). Module-level rather than a ref on purpose: dev Fast
// Refresh can leave a zombie closure attached to the still-mounted Excalidraw
// whose per-instance refs would bypass an instance-level guard. One board
// editor exists per page, so a single module slot is safe.
const reconciledFp: { current: string | null } = { current: null };

function CanvasSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-surface/40">
      <div className="flex items-center gap-2 text-muted text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading sketch board…
      </div>
    </div>
  );
}

export function PlannerBoardEditor({ boardId }: { boardId: string }) {
  const { getToken } = useAuth();

  const [api, setApi] = useState<ExcalidrawAPI | null>(null);
  const [name, setName] = useState("Board");
  const [syncing, setSyncing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  // Render mirror of revisionRef (refs must not be read during render).
  const [revision, setRevision] = useState(0);
  const [share, setShare] = useState<PlannerShare | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [snapOpen, setSnapOpen] = useState(false);
  const initialData = useMemo(() => ({ elements: [], files: {}, appState: { viewModeEnabled: false } }), []);

  const revisionRef = useRef(0);
  const dirtyRef = useRef(false); // unsaved local canvas edits pending
  const savingRef = useRef(false); // a whole-scene PUT is in flight
  const resaveRef = useRef(false); // an edit landed while the PUT was in flight
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const lastSavedFpRef = useRef<string | null>(null);
  const inFlightFpRef = useRef<string | null>(null);
  // Last scene pulled from the server, applied onto the canvas once Excalidraw
  // finishes its async mount (the first fetch can resolve before it exists).
  const headSceneRef = useRef<{ elements: SceneElements; files: BinaryFiles } | null>(null);
  const canvasReadyRef = useRef(false);

  // Apply a freshly fetched scene onto the canvas + revision.
  const applyRemoteScene = useCallback((elements: SceneElements, files: BinaryFiles, rev: number) => {
    headSceneRef.current = { elements, files };
    const fp = sceneFingerprint(elements, files);
    lastSavedFpRef.current = fp;
    reconciledFp.current = fp;
    if (!canvasReadyRef.current || !api) {
      // Canvas not mounted yet; the [api] effect paints it on ready.
      revisionRef.current = rev;
      setRevision(rev);
      return;
    }
    api.updateScene({ elements, files });
    revisionRef.current = rev;
    setRevision(rev);
  }, [api]);

  // Full scene load — only called on open and when another session advanced
  // the revision. Uses the longer-timeout helper internally.
  const pullScene = useCallback(async () => {
    try {
      const token = (await getToken()) || undefined;
      const board = await getPlannerBoard(boardId, token);
      if (!mountedRef.current) return;
      setName(board.name);
      setShare({
        is_public: board.is_public,
        share_token: board.share_token ?? null,
        expires_at: board.expires_at ?? null,
      });
      if (!dirtyRef.current) {
        applyRemoteScene(board.elements, board.files, board.revision);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load board");
    }
  }, [boardId, getToken, applyRemoteScene]);

  // Cheap real-time poll: the revision is all this UI needs. The scene is only
  // re-downloaded when the revision has genuinely moved ahead of ours.
  const pollHead = useCallback(async () => {
    try {
      const token = (await getToken()) || undefined;
      const head = await getPlannerBoardHead(boardId, token);
      if (!mountedRef.current) return;
      if (!dirtyRef.current && head.revision > revisionRef.current) {
        await pullScene();
      }
    } catch {
      // Transient poll failures are swallowed; the next tick retries. Loud
      // toasts here would spam on a brief network blip.
    }
  }, [boardId, getToken, pullScene]);

  // Debounced save of the whole scene, guarded by revision for safe merges.
  // scheduleSave reaches doSave through doSaveRef so doSave can queue a
  // follow-up save without a dependency cycle.
  const doSaveRef = useRef<() => Promise<void>>(async () => {});
  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void doSaveRef.current();
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const doSave = useCallback(async () => {
    if (!api) return;
    if (savingRef.current) {
      // An existing save is in flight. Flag resave so that changes that happened
      // during the in-flight save are written after it completes.
      resaveRef.current = true;
      return;
    }
    const scene = { elements: api.getSceneElements() as SceneElements, files: api.getFiles() as BinaryFiles };
    const fp = sceneFingerprint(scene.elements, scene.files);

    // If canvas content matches what was already saved, no PUT is necessary.
    if (fp === lastSavedFpRef.current) {
      dirtyRef.current = false;
      return;
    }

    inFlightFpRef.current = fp;
    savingRef.current = true;
    setSyncing(true);
    try {
      const token = (await getToken()) || undefined;
      const res = await savePlannerBoard(boardId, scene, revisionRef.current, token);
      revisionRef.current = res.revision;
      setRevision(res.revision);
      dirtyRef.current = false;
      lastSavedFpRef.current = fp;
      reconciledFp.current = fp;
    } catch (err) {
      const status = (err as ApiError)?.status;
      if (status === 409) {
        dirtyRef.current = false;
        await pullScene();
        toast.info("Board updated elsewhere — synced to latest version.");
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to save the board");
      }
    } finally {
      savingRef.current = false;
      inFlightFpRef.current = null;
      setSyncing(false);
      if (resaveRef.current && mountedRef.current) {
        resaveRef.current = false;
        scheduleSave();
      }
    }
  }, [api, boardId, getToken, pullScene, scheduleSave]);
  useEffect(() => {
    doSaveRef.current = doSave;
  });

  // Excalidraw fires onChange for local edits AND on re-renders/mounts.
  // We compare fingerprints to guarantee that identical states, remote-applied scenes,
  // in-flight saves, or empty starter canvases never trigger a save cycle.
  const handleChange = useCallback((elements: SceneElements, _appState: unknown, files: BinaryFiles) => {
    const fp = sceneFingerprint(elements, files);
    if (
      fp === lastSavedFpRef.current ||
      fp === inFlightFpRef.current ||
      (reconciledFp.current !== null && fp === reconciledFp.current)
    ) {
      return;
    }
    const nonDeleted = (elements ?? []).filter((el: any) => !el?.isDeleted);
    if (revisionRef.current === 0 && nonDeleted.length === 0) return;
    scheduleSave();
  }, [scheduleSave]);

  // Paint the head scene the moment the canvas becomes available.
  useEffect(() => {
    if (!api) return;
    canvasReadyRef.current = true;
    const head = headSceneRef.current;
    if (head) {
      const fp = sceneFingerprint(head.elements, head.files);
      lastSavedFpRef.current = fp;
      reconciledFp.current = fp;
      api.updateScene({ elements: head.elements, files: head.files });
    }
  }, [api]);

  // Initial load + real-time poll.
  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount; setState fires inside the async loader
    void pullScene();
    const poll = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!dirtyRef.current) void pollHead();
    }, POLL_MS);
    return () => {
      mountedRef.current = false;
      canvasReadyRef.current = false;
      headSceneRef.current = null;
      clearInterval(poll);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [pullScene, pollHead]);

  const commitRename = async (value: string) => {
    setRenaming(false);
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) return;
    try {
      const token = (await getToken()) || undefined;
      await renamePlannerBoard(boardId, trimmed, token);
      setName(trimmed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename board");
    }
  };

  // PL5 — read-only share link lifecycle (enable / copy / rotate / disable).
  // The dialogs own their busy states and confirmations; these handlers only
  // talk to the API and keep the editor's share mirror up to date.
  const openShare = () => setShareOpen(true);

  const enableShare = async (expiresIso: string | null) => {
    try {
      const token = (await getToken()) || undefined;
      setShare(await enablePlannerShare(boardId, expiresIso, token));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enable sharing");
    }
  };

  const rotateShare = async () => {
    try {
      const token = (await getToken()) || undefined;
      setShare(await rotatePlannerShareToken(boardId, token));
      toast.success("New link issued — the old one no longer works");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rotate link");
    }
  };

  const turnOffShare = async () => {
    try {
      const token = (await getToken()) || undefined;
      setShare(await disablePlannerShare(boardId, token));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disable sharing");
    }
  };

  // PL4 — time travel. The history dialog lists + previews the captured days;
  // a restore lands here, repaints the canvas immediately and other tabs pick
  // it up through the revision poll.
  const openHistory = () => setSnapOpen(true);

  const restoreDay = async (capturedOn: string) => {
    try {
      const token = (await getToken()) || undefined;
      const res = await restorePlannerSnapshot(boardId, capturedOn, token);
      revisionRef.current = res.revision;
      setRevision(res.revision);
      dirtyRef.current = false;
      await pullScene();
      toast.success(`Restored ${capturedOn}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-16 shrink-0 border-b border-line bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard/planner"
            className="p-2 rounded-lg text-muted hover:text-fg hover:bg-surface shrink-0"
            title="Back to boards"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
            <PenLine className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            {renaming ? (
              <input
                autoFocus
                defaultValue={name}
                onBlur={(e) => void commitRename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitRename((e.target as HTMLInputElement).value);
                  if (e.key === "Escape") setRenaming(false);
                }}
                maxLength={255}
                className="input-line max-w-[280px]"
              />
            ) : (
              <button
                onClick={() => setRenaming(true)}
                className="group flex items-center gap-1.5 min-w-0 cursor-pointer"
                title="Rename board"
              >
                <h2 className="font-display font-bold text-[15px] text-fg leading-tight truncate">{name}</h2>
                <PencilLine className="w-3.5 h-3.5 text-faint opacity-0 group-hover:opacity-100 shrink-0" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-surface/60 border border-line/70 text-[11px] font-medium text-muted/90 shadow-2xs select-none"
            title={`Revision ${revision} · All changes synced`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                syncing
                  ? "bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                  : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
              }`}
            />
            <span>{syncing ? "Saving…" : `Saved · v${revision}`}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={openHistory}
            className="w-9 h-9 rounded-lg border-line text-fg hover:bg-surface cursor-pointer"
            title="Day history"
            aria-label="Day history"
          >
            <History className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={openShare}
            className="w-9 h-9 rounded-lg border-line text-fg hover:bg-surface cursor-pointer"
            title="Share board"
            aria-label="Share board"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* PL5 share modal + PL4 history modal */}
      <PlannerShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        share={share}
        onEnable={enableShare}
        onRotate={rotateShare}
        onDisable={turnOffShare}
      />
      <PlannerHistoryDialog
        open={snapOpen}
        onOpenChange={setSnapOpen}
        boardId={boardId}
        onRestore={restoreDay}
      />

      {/* Canvas — owns the full remaining height */}
      <div className="flex-1 min-h-0 relative planner-canvas-wrapper">
        <Excalidraw
          excalidrawAPI={(api: ExcalidrawAPI) => setApi(api)}
          onChange={handleChange}
          initialData={initialData}
          langCode="en"
          theme="dark"
          name={name}
        />
      </div>
    </div>
  );
}
