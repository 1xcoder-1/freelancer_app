"use client";

/* eslint-disable react-hooks/exhaustive-deps */

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  Plus,
  Trash2,
  PenLine,
  Loader2,
  Check,
  ArrowLeft,
  PencilLine,
} from "lucide-react";
import { toast } from "sonner";

import "@excalidraw/excalidraw/index.css";
import { useThemeMode } from "@/hooks/use-theme-mode";

const ExcalidrawRaw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  { ssr: false, loading: () => <CanvasSkeleton /> }
);
// next/dynamic erases the forwardRef signature; restore a permissive component
// type so the imperative-API `ref` callback below type-checks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Excalidraw = ExcalidrawRaw as React.ComponentType<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawAPI = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SceneElements = any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BinaryFiles = Record<string, any>;

import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import {
  getPlannerBoard,
  getPlannerBoardHead,
  savePlannerBoard,
  createPlannerTodo,
  updatePlannerTodo,
  deletePlannerTodo,
  renamePlannerBoard,
  type PlannerTodo,
  type ApiError,
} from "@/lib/api";

// Real-time cadence. The poll hits the cheap /head endpoint (revision + todos
// only), so it stays fast and never moves scene bytes unless the revision
// actually changed — this is what stops the old "timeout of 15000ms exceeded"
// that the whole-scene-every-4s poll triggered on a cold DB.
const POLL_MS = 3_500;
const SAVE_DEBOUNCE_MS = 900;

function todoBoxPosition(index: number) {
  return { x: 120 + (index % 4) * 260, y: 120 + Math.floor(index / 4) * 150 };
}

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
  const theme = useThemeMode();

  const [api, setApi] = useState<ExcalidrawAPI | null>(null);
  const [name, setName] = useState("Board");
  const [todos, setTodos] = useState<PlannerTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState(false);

  const revisionRef = useRef(0);
  const dirtyRef = useRef(false); // unsaved local canvas edits pending
  const applyingRemoteRef = useRef(false); // guard so remote-apply doesn't re-save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  // Last scene pulled from the server, applied onto the canvas once Excalidraw
  // finishes its async mount (the first fetch can resolve before it exists).
  const headSceneRef = useRef<{ elements: SceneElements; files: BinaryFiles } | null>(null);
  const canvasReadyRef = useRef(false);

  // Apply a freshly fetched scene onto the canvas + revision.
  const applyRemoteScene = useCallback((elements: SceneElements, files: BinaryFiles, rev: number) => {
    headSceneRef.current = { elements, files };
    if (!canvasReadyRef.current || !api) {
      // Canvas not mounted yet; the [api] effect paints it on ready.
      revisionRef.current = rev;
      return;
    }
    applyingRemoteRef.current = true;
    api.updateScene({ elements, files });
    applyingRemoteRef.current = false;
    revisionRef.current = rev;
  }, [api]);

  // Full scene load — only called on open and when another session advanced
  // the revision. Uses the longer-timeout helper internally.
  const pullScene = useCallback(async () => {
    try {
      const token = (await getToken()) || undefined;
      const board = await getPlannerBoard(boardId, token);
      if (!mountedRef.current) return;
      setName(board.name);
      setTodos(board.todos);
      if (!dirtyRef.current) {
        applyRemoteScene(board.elements, board.files, board.revision);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load board");
    }
  }, [boardId, getToken, applyRemoteScene]);

  // Cheap real-time poll: revision + todos. Todos land live; the scene is only
  // re-downloaded when the revision has genuinely moved ahead of ours.
  const pollHead = useCallback(async () => {
    try {
      const token = (await getToken()) || undefined;
      const head = await getPlannerBoardHead(boardId, token);
      if (!mountedRef.current) return;
      setTodos(head.todos);
      if (!dirtyRef.current && head.revision > revisionRef.current) {
        await pullScene();
      }
    } catch {
      // Transient poll failures are swallowed; the next tick retries. Loud
      // toasts here would spam on a brief network blip.
    }
  }, [boardId, getToken, pullScene]);

  // Debounced save of the whole scene, guarded by revision for safe merges.
  const doSave = useCallback(async () => {
    if (!api) return;
    const scene = { elements: api.getSceneElements() as SceneElements, files: api.getFiles() as BinaryFiles };
    setSyncing(true);
    try {
      const token = (await getToken()) || undefined;
      const res = await savePlannerBoard(boardId, scene, revisionRef.current, token);
      revisionRef.current = res.revision;
      dirtyRef.current = false;
    } catch (err) {
      const status = (err as ApiError)?.status;
      if (status === 409) {
        // Another session wrote first: pull their head scene, our next stroke
        // saves on top of it. Never force-overwrite a teammate's drawing.
        dirtyRef.current = false;
        await pullScene();
        toast.info("Board updated elsewhere — synced to the latest version.");
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to save the board");
      }
    } finally {
      setSyncing(false);
    }
  }, [api, boardId, getToken, pullScene]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void doSave();
    }, SAVE_DEBOUNCE_MS);
  }, [doSave]);

  // Excalidraw fires onChange for local edits AND our remote-apply; ignore the
  // latter so applying someone else's scene doesn't echo a save back.
  const handleChange = useCallback(() => {
    if (applyingRemoteRef.current) return;
    scheduleSave();
  }, [scheduleSave]);

  // Paint the head scene the moment the canvas becomes available.
  useEffect(() => {
    if (!api) return;
    canvasReadyRef.current = true;
    const head = headSceneRef.current;
    if (head) {
      applyingRemoteRef.current = true;
      api.updateScene({ elements: head.elements, files: head.files });
      applyingRemoteRef.current = false;
    }
  }, [api]);

  // Initial load + real-time poll.
  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    void pullScene().finally(() => mountedRef.current && setLoading(false));
    const poll = setInterval(() => {
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

  // ---- todo actions ----
  const addTodo = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      const token = (await getToken()) || undefined;
      const todo = await createPlannerTodo(boardId, text, token);
      setTodos((prev) => [...prev, todo]);
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add todo");
    }
  };

  const toggleTodo = async (todo: PlannerTodo) => {
    const next = !todo.is_done;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: next } : t)));
    try {
      const token = (await getToken()) || undefined;
      await updatePlannerTodo(todo.id, { is_done: next }, token);
    } catch (err) {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: todo.is_done } : t)));
      toast.error(err instanceof Error ? err.message : "Failed to update todo");
    }
  };

  const removeTodo = async (todo: PlannerTodo) => {
    if (!(await confirmDialog({ message: `Delete "${todo.text}"?`, danger: true, confirmLabel: "Delete" }))) return;
    const before = todos;
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    try {
      const token = (await getToken()) || undefined;
      await deletePlannerTodo(todo.id, token);
    } catch (err) {
      setTodos(before);
      toast.error(err instanceof Error ? err.message : "Failed to delete todo");
    }
  };

  // The merged action: drop a todo onto the sketch board as a labelled card.
  const sketchTodo = async (todo: PlannerTodo, index: number) => {
    if (!api) {
      toast.error("Board is still loading");
      return;
    }
    const mod = await import("@excalidraw/excalidraw");
    const { x, y } = todoBoxPosition(index);
    const created = mod.convertToExcalidrawElements([
      {
        type: "rectangle",
        x,
        y,
        width: 220,
        height: 70,
        label: { text: `${todo.is_done ? "✓ " : ""}${todo.text}` },
      },
    ]);
    api.updateScene({ elements: [...(api.getSceneElements() as SceneElements), ...created] });
    scheduleSave();
    toast.success("Added to the board");
  };

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

  const pendingCount = todos.filter((t) => !t.is_done).length;

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
                className="group flex items-center gap-1.5 min-w-0"
                title="Rename board"
              >
                <h2 className="font-display font-bold text-[15px] text-fg leading-tight truncate">{name}</h2>
                <PencilLine className="w-3.5 h-3.5 text-faint opacity-0 group-hover:opacity-100 shrink-0" />
              </button>
            )}
            <p className="text-[11px] text-muted">Todo list + sketch board · synced live</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-muted">
            <span className={`w-2 h-2 rounded-full ${syncing ? "bg-warn animate-pulse" : "bg-ok"}`} />
            {syncing ? "Saving…" : `Rev ${revisionRef.current}`}
          </span>
          <ThemeToggle />
        </div>
      </div>

      {/* Body: two panes */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Todos */}
        <div className="lg:w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-line flex flex-col min-h-0 bg-card">
          <div className="p-4 border-b border-line">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">Todos</span>
              <span className="text-[11px] font-mono text-faint">{pendingCount} open</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void addTodo(); }}
                placeholder="What needs doing?"
                maxLength={500}
                className="flex-1 px-3 py-2 rounded-lg bg-surface border border-line text-sm text-fg placeholder:text-faint focus:outline-none focus:border-accent"
              />
              <Button
                size="sm"
                onClick={() => void addTodo()}
                disabled={!draft.trim()}
                className="rounded-lg bg-accent hover:bg-accent-hi text-accent-fg px-2.5"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center h-24 text-muted text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
              </div>
            ) : todos.length === 0 ? (
              <p className="text-center text-xs text-faint py-10 px-4">
                No todos yet. Add one above, then sketch it on the board.
              </p>
            ) : (
              todos.map((todo, i) => (
                <div key={todo.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface">
                  <button
                    onClick={() => toggleTodo(todo)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      todo.is_done ? "bg-accent border-accent text-accent-fg" : "border-line-strong text-transparent hover:border-accent"
                    }`}
                    aria-label={todo.is_done ? "Mark not done" : "Mark done"}
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <span className={`flex-1 text-sm truncate ${todo.is_done ? "line-through text-faint" : "text-fg"}`}>
                    {todo.text}
                  </span>
                  <button
                    onClick={() => sketchTodo(todo, i)}
                    title="Add to board"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted hover:text-accent shrink-0"
                  >
                    <PenLine className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeTodo(todo)}
                    title="Delete"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted hover:text-danger shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 min-h-0 relative">
          <Excalidraw
            ref={setApi}
            onChange={handleChange}
            initialData={{ elements: [], files: {}, appState: { viewModeEnabled: false } }}
            langCode="en"
            theme={theme}
            name={name}
          />
        </div>
      </div>
    </div>
  );
}
