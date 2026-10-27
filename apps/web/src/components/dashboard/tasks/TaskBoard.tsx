"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Clock,
  FileText,
  Folder,
  GripVertical,
  Kanban,
  Loader2,
  Menu,
  Palette,
  Paperclip,
  PencilLine,
  Plus,
  Trash2,
  X,
} from "@/components/animated-icons";
import { toast } from "sonner";

import "./board.css";

import { confirmDialog } from "@/components/common/ConfirmDialog";
import {
  createTaskSubtask,
  deleteTaskAttachment,
  deleteTaskSubtask,
  getTaskBoardFull,
  getTaskBoardHead,
  updateTaskBoard,
  updateTaskCard,
  updateTaskList,
  createTaskList,
  createTaskCard,
  deleteTaskCard,
  deleteTaskList,
  updateTaskSubtask,
  type TaskAttachment,
  type TaskBoardFull,
  type TaskCard,
  type TaskCardPatchPayload,
  type TaskList,
  type TaskPriority,
  type TaskSubtask,
} from "@/lib/api";
import { getCachedData, setCachedData } from "@/lib/cache";
import { logHandledError } from "@/lib/log-error";
import { cn } from "@/lib/utils";

import { useBoardDndEngine, useBoardDndState } from "./use-board-dnd";
import { useDismissable } from "./use-dismissable";
import { TaskBackgroundPicker, type BackgroundSelection } from "./TaskBackgroundPicker";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { useProjectsNameMap } from "./use-projects-cache";
import {
  PRIORITY_META,
  dueStatus,
  formatDueDate,
  priorityDotClass,
  resolveBoardBackground,
  unsplashVariant,
  type BoardBackground,
} from "./task-ui";

// Task Management kanban — full Trello-style board. The data layer keeps the
// original slice's shape; the presentation is the complete build:
//
//   1. STATE MODEL   — one `board` object mirrored in boardRef (so chained
//                      optimistic ops see fresh state) + revisionRef; every
//                      mutation flows through `mutateBoard` (optimistic) then
//                      `refresh` (server truth). The ~2s head poll never fires
//                      while a mutation is in flight.
//   2. DATA ACTIONS  — named async helpers per mutation; failures revert via
//                      refresh() + sonner toast + logHandledError.
//   3. DRAG & DROP   — custom pointer-event engine (use-board-dnd): cards
//                      reorder within/across lists, columns reorder; drop
//                      targets become the backend's before/after midpoint
//                      contract. "Done" list semantics ride the same PATCH.
//   4. PRESENTATION  — translucent dark columns over the board background,
//                      slim custom scrollbars (board.css), framer-motion for
//                      column/card transitions and the drag ghost.

const POLL_MS = 2_000;
const CACHE_TTL_MS = 30_000; // fresh window; stale entries still render instantly
const DONE_LIST_NAME = "done";

// Prefix for client-generated placeholder ids (lists/cards staged optimistically
// before the server responds). Ids with this prefix must NEVER reach the
// network — every op below guards on isOptimisticId() so a temp id can't 404
// (the root cause of the "Not found" toast when adding a card).
const OPTIMISTIC_PREFIX = "optimistic-";
const isOptimisticId = (id: string) => id.startsWith(OPTIMISTIC_PREFIX);

// Composer quick-pick chips: per-priority selected treatment (token colors).
const PRIORITY_CHIP_ACTIVE: Record<TaskPriority, string> = {
  urgent: "bg-danger/15 border-danger/50 text-danger",
  high: "bg-warn/15 border-warn/50 text-warn",
  medium: "bg-info/15 border-info/50 text-info",
  low: "bg-violet/15 border-violet/50 text-violet",
};

const cacheKeyFor = (boardId: string) => `task-board-full:${boardId}`;

const isDoneList = (name: string) => name.trim().toLowerCase() === DONE_LIST_NAME;

// Pure board transform: applies `fn` to one card wherever it sits. All nested
// card mutations (patch/move/subtasks/attachments) funnel through this so the
// optimistic mirror stays consistent.
function mapCardsInBoard(
  board: TaskBoardFull,
  cardId: string,
  fn: (card: TaskCard) => TaskCard
): TaskBoardFull {
  return {
    ...board,
    lists: board.lists.map((l) => ({
      ...l,
      cards: l.cards.map((c) => (c.id === cardId ? fn(c) : c)),
    })),
  };
}

export function TaskBoard({ boardId }: { boardId: string }) {
  const { getToken } = useAuth();

  // ---- 1. STATE MODEL -------------------------------------------------------
  const [board, setBoard] = useState<TaskBoardFull | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingOps, setPendingOps] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // One clock snapshot per mount — date chips would otherwise hydrate wrong.
  const [today, setToday] = useState<string | null>(null);
  // <body> portal host for the drag ghost (fixed positioning must escape the
  // page transition wrapper, which keeps a filter() that hijacks containing
  // blocks for fixed descendants).
  const [portalReady, setPortalReady] = useState(false);
  // One-shot entrance stagger: only the first board paint staggers columns in;
  // afterwards every newly mounted element enters without delay so drag-drop
  // re-mounts never feel laggy.
  const [enterStagger, setEnterStagger] = useState(true);

  const revisionRef = useRef(0);
  const boardRef = useRef<TaskBoardFull | null>(null);
  const mountedRef = useRef(true);
  // Anchor element for the background picker popover (callback-ref state —
  // the picker needs the element during render, a plain ref can't provide it).
  const [pickerAnchor, setPickerAnchor] = useState<HTMLButtonElement | null>(null);
  // A full re-pull is in flight; the poll skips ticks so a fresh response can
  // never clobber an optimistic update made after it started.
  const refreshingRef = useRef(false);
  // Mutations in flight — poll ticks skip entirely while > 0 so an optimistic
  // board is never overwritten by a pre-mutation snapshot.
  const pendingOpsRef = useRef(0);

  const authToken = useCallback(async () => (await getToken()) || undefined, [getToken]);

  const applyBoard = useCallback(
    (next: TaskBoardFull) => {
      revisionRef.current = next.revision;
      boardRef.current = next;
      setBoard(next);
      setCachedData(cacheKeyFor(boardId), next, CACHE_TTL_MS);
    },
    [boardId]
  );

  const pullBoard = useCallback(async () => {
    const token = await authToken();
    const next = await getTaskBoardFull(boardId, token);
    if (mountedRef.current) applyBoard(next);
  }, [boardId, authToken, applyBoard]);

  // Server-truth refresh after a mutation (mutations bump the revision, this
  // re-pull also moves revisionRef so the poll won't refire for our own change).
  const refresh = useCallback(async () => {
    refreshingRef.current = true;
    setSyncing(true);
    try {
      await pullBoard();
    } finally {
      refreshingRef.current = false;
      if (mountedRef.current) setSyncing(false);
    }
  }, [pullBoard]);

  // Optimistic mutation helper: patches boardRef + state synchronously so
  // back-to-back ops always see the latest local board.
  const mutateBoard = useCallback((fn: (prev: TaskBoardFull) => TaskBoardFull) => {
    const prev = boardRef.current;
    if (!prev) return;
    const next = fn(prev);
    boardRef.current = next;
    setBoard(next);
  }, []);

  // Wraps every mutation: saving status, poll protection, refresh on success
  // AND on failure (the revert path), toast + handled logging on failure.
  // `friendlyError` replaces the raw server/axios message in the toast for
  // user-initiated creates — "Not found" from a 404 is never shown verbatim.
  const runOp = useCallback(
    async (fn: () => Promise<unknown>, friendlyError?: string): Promise<boolean> => {
      pendingOpsRef.current += 1;
      setPendingOps((n) => n + 1);
      try {
        await fn();
        if (mountedRef.current) await refresh();
        return true;
      } catch (err) {
        logHandledError("Task board mutation failed:", err);
        toast.error(friendlyError ?? (err instanceof Error ? err.message : "Something went wrong"));
        // Revert via server truth. A failing revert must never escape runOp —
        // it would surface as an unhandled rejection on top of the failure
        // toast; the next poll tick re-pulls and repairs the board instead.
        if (mountedRef.current) {
          try {
            await refresh();
          } catch (revertErr) {
            logHandledError("Task board revert refresh failed:", revertErr);
          }
        }
        return false;
      } finally {
        pendingOpsRef.current -= 1;
        setPendingOps((n) => Math.max(0, n - 1));
      }
    },
    [refresh]
  );

  // ---- Pending list-ready queue ---------------------------------------------
  // Waiting room for ops that target a list whose optimistic create is still
  // in flight. A temp list id must NEVER reach the API — POSTing a card to
  // /tasks/lists/optimistic-…/cards 404s and fires the "Not found" toast (the
  // reported add-card bug). addList replays these callbacks with the server
  // row right after its temp→real swap, or releases them with null when the
  // create failed and the column is dropped.
  const pendingListReadyRef = useRef(
    new Map<string, Array<(realListId: string | null) => void>>()
  );

  const registerPendingListReady = useCallback(
    (tempListId: string, cb: (realListId: string | null) => void) => {
      const queue = pendingListReadyRef.current.get(tempListId) ?? [];
      queue.push(cb);
      pendingListReadyRef.current.set(tempListId, queue);
    },
    []
  );

  const flushPendingListReady = useCallback(
    (tempListId: string, realListId: string | null) => {
      const queue = pendingListReadyRef.current.get(tempListId);
      if (!queue) return;
      pendingListReadyRef.current.delete(tempListId);
      queue.forEach((cb) => cb(realListId));
    },
    []
  );

  // ---- 2. DATA ACTIONS ------------------------------------------------------

  const commitRename = async (value: string) => {
    setRenaming(false);
    const trimmed = value.trim();
    if (!trimmed || trimmed === boardRef.current?.name) return;
    const before = boardRef.current?.name ?? "";
    mutateBoard((prev) => ({ ...prev, name: trimmed }));
    await runOp(async () => {
      const token = await authToken();
      await updateTaskBoard(boardId, { name: trimmed }, token);
    }, "Couldn't rename the board.").then((ok) => {
      if (!ok && mountedRef.current) mutateBoard((prev) => ({ ...prev, name: before }));
    });
  };

  // Optimistic list creation: the column appears instantly under a temp id
  // and is swapped for the server row when createTaskList resolves. List ops
  // guard on isOptimisticId (local-only) while the temp id is live, so the
  // temp id can never reach the API and 404. Card adds staged against the
  // temp column while the create is in flight are parked in the
  // pendingListReady queue and replayed onto the real id below (they must
  // never POST the temp list id — that 404s with a "Not found" toast).
  const addList = async (listName: string): Promise<boolean> => {
    const token = await authToken();
    const tempId = `${OPTIMISTIC_PREFIX}list-${Date.now()}`;
    let createdListId: string | null = null;
    mutateBoard((prev) => ({
      ...prev,
      lists: [
        ...prev.lists,
        {
          id: tempId,
          board_id: prev.id,
          name: listName,
          position: (prev.lists.at(-1)?.position ?? 0) + 1000,
          created_at: new Date().toISOString(),
          cards: [],
        } satisfies TaskList,
      ],
    }));
    const ok = await runOp(
      async () => {
        const created = await createTaskList(boardId, listName, token);
        createdListId = created.id;
        // Temp→real swap, in place; preserve any local edits (rename/cards)
        // made while the create was in flight.
        const local = boardRef.current?.lists.find((l) => l.id === tempId);
        mutateBoard((prev) => ({
          ...prev,
          lists: prev.lists.map((l) =>
            l.id === tempId
              ? { ...created, name: local?.name ?? created.name, cards: local?.cards ?? [] }
              : l
          ),
        }));
      },
      "Couldn't create the list. The name is kept — try again."
    );
    if (!ok) {
      // The column is dropped, so nothing queued against it can run —
      // release the waiters (their composers stop spinning, resolves false).
      flushPendingListReady(tempId, null);
      // Server truth was re-pulled by runOp; drop the optimistic column too
      // in case the refresh raced ahead of its removal.
      mutateBoard((prev) => ({ ...prev, lists: prev.lists.filter((l) => l.id !== tempId) }));
      return false;
    }
    // The list has its real id: replay card adds / moves staged against the
    // temp id while the create was in flight.
    flushPendingListReady(tempId, createdListId);
    toast.success(`Column "${listName}" added`);
    return true;
  };

  const renameList = async (list: TaskList, value: string) => {
    setEditingListId(null);
    const trimmed = value.trim();
    if (!trimmed || trimmed === list.name) return;
    mutateBoard((prev) => ({
      ...prev,
      lists: prev.lists.map((l) => (l.id === list.id ? { ...l, name: trimmed } : l)),
    }));
    // Optimistic (not-yet-created) list: the rename lives locally only; the
    // create's temp→real swap preserves it.
    if (isOptimisticId(list.id)) return;
    await runOp(async () => {
      const token = await authToken();
      await updateTaskList(list.id, { name: trimmed }, token);
    }, "Couldn't rename the list.").then((ok) => {
      if (!ok && mountedRef.current)
        mutateBoard((prev) => ({
          ...prev,
          lists: prev.lists.map((l) => (l.id === list.id ? { ...l, name: list.name } : l)),
        }));
    });
  };

  const removeList = async (list: TaskList) => {
    const ok = await confirmDialog({
      message: `Delete "${list.name}" and its ${list.cards.length} card${list.cards.length === 1 ? "" : "s"}? Deleting a list deletes its cards. This cannot be undone.`,
      danger: true,
      confirmLabel: "Delete list",
    });
    if (!ok) return;
    mutateBoard((prev) => ({
      ...prev,
      lists: prev.lists.filter((l) => l.id !== list.id),
    }));
    // Optimistic (not-yet-created) list: nothing exists server-side to delete.
    if (isOptimisticId(list.id)) return;
    await runOp(async () => {
      const token = await authToken();
      await deleteTaskList(list.id, token);
    }, "Couldn't delete the list.");
  };

  // ROOT CAUSE of the "Not found" toast when adding a card, fixed in two
  // places: (1) ops on the just-added card used to PATCH/DELETE /tasks/cards/
  // optimistic-… while createTaskCard was still in flight → server 404 → the
  // interceptor wrapped it as Error("Not found") → toast.error. Those ops are
  // local-only and the swap re-attaches the state onto the real id. (2) Adding
  // a card to a list that was itself just created optimistically POSTed the
  // temp LIST id → 404. Such adds are parked in the pendingListReady queue
  // below and replayed through this same optimistic flow the moment the list's
  // real id arrives; the composer keeps its busy spinner until then.
  const createCardFlow = useCallback(
    async (
      listId: string,
      title: string,
      priority?: TaskPriority | null
    ): Promise<boolean> => {
      // listId is guaranteed real here — the temp-id branch lives in addCard.
      const token = await authToken();
      const b = boardRef.current;
      const list = b?.lists.find((l) => l.id === listId);
      if (!b || !list) return false;
      const tempId = `${OPTIMISTIC_PREFIX}card-${Date.now()}`;
      const completedNow = isDoneList(list.name);
      // Optimistic append at the end of the list (backend assigns position).
      mutateBoard((prev) => ({
        ...prev,
        lists: prev.lists.map((l) =>
          l.id === listId
            ? {
                ...l,
                cards: [
                  ...l.cards,
                  {
                    id: tempId,
                    list_id: listId,
                    board_id: prev.id,
                    workspace_id: prev.workspace_id,
                    title,
                    description: "",
                    completed: completedNow,
                    priority: priority ?? null,
                    due_date: null,
                    position: (l.cards.at(-1)?.position ?? 0) + 1,
                    project_id: null,
                    tags: [],
                    subtasks: [],
                    attachments: [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  } satisfies TaskCard,
                ],
              }
            : l
        ),
      }));
      const ok = await runOp(
        async () => {
          const created = await createTaskCard(
            listId,
            priority ? { title, priority } : { title },
            token
          );
          // Temp→real swap, in place. Single-card responses carry empty
          // subtasks/attachments, so preserve whatever was staged locally;
          // title/description/completed/priority can change during the flight
          // (drawer edits, quick toggles) and win over the server defaults.
          const local = boardRef.current?.lists
            .flatMap((l) => l.cards)
            .find((c) => c.id === tempId);
          mutateBoard((prev) =>
            mapCardsInBoard(prev, tempId, () => ({
              ...created,
              subtasks: local?.subtasks ?? [],
              attachments: local?.attachments ?? [],
              ...(local
                ? {
                    title: local.title,
                    description: local.description,
                    completed: local.completed,
                    priority: local.priority,
                    due_date: local.due_date,
                  }
                : {}),
            }))
          );
          // "Done"-list semantics + toggles made during the flight are folded
          // into one follow-up PATCH on the REAL id.
          const effectiveCompleted = local?.completed ?? completedNow;
          if (effectiveCompleted !== created.completed) {
            await updateTaskCard(created.id, { completed: effectiveCompleted }, token);
          }
        },
        "Couldn't add the card. Your text is kept in the composer — try again."
      );
      if (!ok) {
        // runOp already refreshed (server truth); drop the optimistic row too
        // in case the refresh raced ahead of the temp card's removal. The
        // composer stays open with the text so Enter retries without retyping.
        mutateBoard((prev) => ({
          ...prev,
          lists: prev.lists.map((l) =>
            l.id === listId ? { ...l, cards: l.cards.filter((c) => c.id !== tempId) } : l
          ),
        }));
        return false;
      }
      toast.success(`Card "${title}" added`);
      return true;
    },
    [authToken, mutateBoard, runOp]
  );

  // Public add-card entry point: a card can never be created against a temp
  // list id. Park the add until addList flushes the queue with the real id
  // (or releases it with null when the list create failed — the composer
  // resolves false and keeps its text for a retry).
  const addCard = async (
    listId: string,
    title: string,
    priority?: TaskPriority | null
  ): Promise<boolean> => {
    if (isOptimisticId(listId)) {
      return new Promise<boolean>((resolve) => {
        registerPendingListReady(listId, (realListId) => {
          if (!realListId) {
            resolve(false);
            return;
          }
          void createCardFlow(realListId, title, priority).then(resolve);
        });
      });
    }
    return createCardFlow(listId, title, priority);
  };

  // Checkbox toggle — updates completed only, NEVER moves the card.
  const toggleCard = async (card: TaskCard) => {
    const next = !card.completed;
    mutateBoard((prev) => ({
      ...prev,
      lists: prev.lists.map((l) => ({
        ...l,
        cards: l.cards.map((c) => (c.id === card.id ? { ...c, completed: next } : c)),
      })),
    }));
    // Optimistic (not-yet-created) card: local only — the create's temp→real
    // swap re-attaches the flag and PATCHes the real id (see addCard).
    if (isOptimisticId(card.id)) return;
    await runOp(async () => {
      const token = await authToken();
      await updateTaskCard(card.id, { completed: next }, token);
    }, "Couldn't update the card.");
  };

  const removeCard = async (card: TaskCard) => {
    mutateBoard((prev) => ({
      ...prev,
      lists: prev.lists.map((l) => ({
        ...l,
        cards: l.cards.filter((c) => c.id !== card.id),
      })),
    }));
    // Optimistic (not-yet-created) card: nothing exists server-side to delete.
    if (isOptimisticId(card.id)) return;
    await runOp(async () => {
      const token = await authToken();
      await deleteTaskCard(card.id, token);
    }, "Couldn't delete the card.");
  };

  // Persist drawer edits (title/description/priority/due/completed/tags…).
  // A `list_id` that differs from the card's current list is a Status-select
  // move: the card relocates (append at the end of the destination list,
  // anchors omitted) with the SAME "Done" completed semantics as drag & drop
  // (into "done" → completed:true, out of "done" → completed:false).
  const patchCard = useCallback(
    async (cardId: string, patch: TaskCardPatchPayload) => {
      const b = boardRef.current;
      const current = b ? b.lists.flatMap((l) => l.cards).find((c) => c.id === cardId) : undefined;

      // Optimistic (not-yet-created) card: stage the edit locally only — the
      // create's temp→real swap preserves it and the drawer re-syncs. A PATCH
      // with the temp id would 404 (the "Not found" toast bug).
      if (current && isOptimisticId(cardId)) {
        mutateBoard((prev) => mapCardsInBoard(prev, cardId, (c) => ({ ...c, ...patch }) as TaskCard));
        return;
      }

      if (b && current && patch.list_id && patch.list_id !== current.list_id) {
        const fromList = b.lists.find((l) => l.id === current.list_id);
        const toList = b.lists.find((l) => l.id === patch.list_id);
        if (fromList && toList) {
          toast.success(`Moved "${current.title}" to ${toList.name}`);
          const sourceIsDone = isDoneList(fromList.name);
          const targetIsDone = isDoneList(toList.name);
          const completed = targetIsDone ? true : sourceIsDone ? false : undefined;
          const moved: TaskCard = {
            ...current,
            ...patch,
            list_id: toList.id,
            completed: completed ?? current.completed,
            // Optimistic position: append at the end of the destination list
            // (server assigns the real position; anchors are omitted).
            position: (toList.cards.at(-1)?.position ?? 0) + 1,
          };
          mutateBoard((prev) => ({
            ...prev,
            lists: prev.lists.map((l) => {
              if (l.id === fromList.id) return { ...l, cards: l.cards.filter((c) => c.id !== cardId) };
              if (l.id === toList.id) return { ...l, cards: [...l.cards, moved] };
              return l;
            }),
          }));
          const wirePatch: TaskCardPatchPayload = { list_id: toList.id };
          if (completed !== undefined) wirePatch.completed = completed;
          if (isOptimisticId(toList.id)) {
            // Destination list is still being created: the local move is
            // applied and the create's temp→real swap keeps the column's
            // local cards. Replay the move against the real id once the
            // create lands — sending the temp id would 404, and skipping the
            // API call entirely would let the next refresh drag the card
            // silently back to its old list.
            registerPendingListReady(toList.id, (realListId) => {
              if (!realListId) return;
              void runOp(async () => {
                const token = await authToken();
                await updateTaskCard(cardId, { ...wirePatch, list_id: realListId }, token);
              }, "Couldn't move the card.");
            });
            return;
          }
          await runOp(async () => {
            const token = await authToken();
            await updateTaskCard(cardId, wirePatch, token);
          }, "Couldn't move the card.");
          return;
        }
      }

      // Regular in-place field patch.
      mutateBoard((prev) => mapCardsInBoard(prev, cardId, (c) => ({ ...c, ...patch }) as TaskCard));
      await runOp(async () => {
        const token = await authToken();
        await updateTaskCard(cardId, patch, token);
      }, "Couldn't save your changes to the card.");
    },
    [mutateBoard, runOp, authToken, registerPendingListReady]
  );

  // ---- Drawer subtask ops (TaskBoard owns the optimistic board state) -------
  // Same philosophy as patchCard: stage optimistically in boardRef + state,
  // run the API inside runOp (refresh on success AND revert on failure, toast
  // + handled logging included), so board card badges update instantly.

  const addSubtaskToCard = useCallback(
    async (cardId: string, text: string) => {
      const b = boardRef.current;
      const card = b ? b.lists.flatMap((l) => l.cards).find((c) => c.id === cardId) : undefined;
      if (!b || !card) return;
      const tempId = `optimistic-sub-${Date.now()}`;
      const optimistic: TaskSubtask = {
        id: tempId,
        card_id: cardId,
        text,
        is_done: false,
        position: (card.subtasks.at(-1)?.position ?? 0) + 1,
        created_at: new Date().toISOString(),
      };
      mutateBoard((prev) =>
        mapCardsInBoard(prev, cardId, (c) => ({ ...c, subtasks: [...c.subtasks, optimistic] }))
      );
      // Optimistic (not-yet-created) card: stage locally only — the create's
      // temp→real swap preserves the staged rows. A POST with the temp card id
      // would 404.
      if (isOptimisticId(cardId)) return;
      // Swap the optimistic row for server truth (same slot) so the reconciling
      // refresh can never duplicate it.
      const createdRef: { value: TaskSubtask | null } = { value: null };
      await runOp(async () => {
        const token = await authToken();
        const created = await createTaskSubtask(cardId, text, token);
        createdRef.value = created;
        mutateBoard((prev) =>
          mapCardsInBoard(prev, cardId, (c) => ({
            ...c,
            subtasks: c.subtasks.map((s) => (s.id === tempId ? created : s)),
          }))
        );
      }, "Couldn't add the subtask.");
    },
    [mutateBoard, runOp, authToken]
  );

  const toggleSubtaskOnCard = useCallback(
    async (cardId: string, subtaskId: string, isDone: boolean) => {
      mutateBoard((prev) =>
        mapCardsInBoard(prev, cardId, (c) => ({
          ...c,
          subtasks: c.subtasks.map((s) => (s.id === subtaskId ? { ...s, is_done: isDone } : s)),
        }))
      );
      // Optimistic rows (not-yet-created card or subtask) stay local-only —
      // the reconciling refresh carries server truth.
      if (isOptimisticId(subtaskId) || isOptimisticId(cardId)) return;
      await runOp(async () => {
        const token = await authToken();
        await updateTaskSubtask(subtaskId, { is_done: isDone }, token);
      }, "Couldn't update the subtask.");
    },
    [mutateBoard, runOp, authToken]
  );

  const deleteSubtaskFromCard = useCallback(
    async (cardId: string, subtaskId: string) => {
      mutateBoard((prev) =>
        mapCardsInBoard(prev, cardId, (c) => ({
          ...c,
          subtasks: c.subtasks.filter((s) => s.id !== subtaskId),
        }))
      );
      if (isOptimisticId(subtaskId) || isOptimisticId(cardId)) return;
      await runOp(async () => {
        const token = await authToken();
        await deleteTaskSubtask(subtaskId, token);
      }, "Couldn't delete the subtask.");
    },
    [mutateBoard, runOp, authToken]
  );

  // ---- Drawer attachment ops -------------------------------------------------
  // `staged` carries a client-generated optimistic id; `upload` is the drawer's
  // pipeline (compress → CDN upload → attachment metadata) resolving to the
  // server row. The placeholder is swapped in place on success; runOp's
  // refresh reverts everything on failure (plus a defensive local drop).

  const uploadCardAttachment = useCallback(
    async (
      cardId: string,
      staged: TaskAttachment,
      upload: () => Promise<TaskAttachment>
    ): Promise<TaskAttachment | null> => {
      // Optimistic (not-yet-created) card: the attachment API needs the real
      // card id — never upload against a temp id (it would 404 + toast).
      if (isOptimisticId(cardId)) return null;
      mutateBoard((prev) =>
        mapCardsInBoard(prev, cardId, (c) => ({ ...c, attachments: [...c.attachments, staged] }))
      );
      const createdRef: { value: TaskAttachment | null } = { value: null };
      const ok = await runOp(async () => {
        const created = await upload();
        createdRef.value = created;
        mutateBoard((prev) =>
          mapCardsInBoard(prev, cardId, (c) => ({
            ...c,
            attachments: c.attachments.map((a) => (a.id === staged.id ? created : a)),
          }))
        );
      }, "Couldn't upload the attachment.");
      if (!ok) {
        // Server truth was re-pulled by runOp; drop the placeholder locally too
        // in case the refresh raced ahead of the staged row's removal.
        mutateBoard((prev) =>
          mapCardsInBoard(prev, cardId, (c) => ({
            ...c,
            attachments: c.attachments.filter((a) => a.id !== staged.id),
          }))
        );
        return null;
      }
      return createdRef.value;
    },
    [mutateBoard, runOp]
  );

  const deleteCardAttachment = useCallback(
    async (cardId: string, attachmentId: string) => {
      mutateBoard((prev) =>
        mapCardsInBoard(prev, cardId, (c) => ({
          ...c,
          attachments: c.attachments.filter((a) => a.id !== attachmentId),
        }))
      );
      // An optimistic placeholder (in-flight upload) or optimistic card only
      // exists locally — there is nothing to delete server-side; the
      // post-upload swap matches nothing and the next refresh shows truth.
      if (isOptimisticId(attachmentId) || isOptimisticId(cardId)) return;
      await runOp(async () => {
        const token = await authToken();
        await deleteTaskAttachment(attachmentId, token);
      }, "Couldn't remove the attachment.");
    },
    [mutateBoard, runOp, authToken]
  );

  // Kanban move: translate the drop target into the backend's midpoint
  // contract ({list_id, before_card_id, after_card_id} — nulls omitted) and
  // fold the "Done" list semantics into the SAME updateTaskCard call.
  const moveCard = useCallback(
    async (cardId: string, fromListId: string, toListId: string, toIndex: number) => {
      const b = boardRef.current;
      if (!b) return;
      const fromList = b.lists.find((l) => l.id === fromListId);
      const toList = b.lists.find((l) => l.id === toListId);
      if (!fromList || !toList) return;
      const card =
        fromList.cards.find((c) => c.id === cardId) ??
        toList.cards.find((c) => c.id === cardId);
      if (!card) return;

      const targetCards = toList.cards.filter((c) => c.id !== cardId);
      const before = toIndex > 0 ? targetCards[toIndex - 1]?.id : undefined;
      const after = toIndex < targetCards.length ? targetCards[toIndex]?.id : undefined;

      const sourceIsDone = isDoneList(fromList.name);
      const targetIsDone = isDoneList(toList.name);
      const completed = targetIsDone ? true : sourceIsDone ? false : undefined;

      // No-op guard: same slot, no completed change → skip the round trip.
      if (fromListId === toListId && completed === undefined) {
        const idx = fromList.cards.findIndex((c) => c.id === cardId);
        const prevId = idx > 0 ? fromList.cards[idx - 1].id : undefined;
        const nextId = idx < fromList.cards.length - 1 ? fromList.cards[idx + 1].id : undefined;
        if (prevId === before && nextId === after) return;
      }

      // Optimistic: apply the move locally instantly.
      mutateBoard((prev) => {
        const moved = { ...card, completed: completed ?? card.completed, list_id: toListId };
        return {
          ...prev,
          lists: prev.lists.map((l) => {
            if (l.id === fromListId && l.id === toListId) {
              const rest = l.cards.filter((c) => c.id !== cardId);
              const cards = [...rest];
              cards.splice(Math.min(toIndex, cards.length), 0, moved);
              return { ...l, cards };
            }
            if (l.id === fromListId) return { ...l, cards: l.cards.filter((c) => c.id !== cardId) };
            if (l.id === toListId) {
              const cards = [...l.cards];
              cards.splice(Math.min(toIndex, cards.length), 0, moved);
              return { ...l, cards };
            }
            return l;
          }),
        };
      });

      if (fromListId !== toListId) {
        toast.success(`Moved "${card.title}" to ${toList.name}`);
      }

      const patch: TaskCardPatchPayload = { list_id: toListId };
      if (before) patch.before_card_id = before;
      if (after) patch.after_card_id = after;
      if (completed !== undefined) patch.completed = completed;

      // Optimistic (not-yet-created) card: the local move already applied;
      // never send a temp card id to the API (404 → "Not found"). The create's
      // temp→real swap re-attaches the card's state onto the real id.
      if (isOptimisticId(cardId)) return;

      if (isOptimisticId(toListId)) {
        // Destination list is still being created: the local move is applied
        // and the create's temp→real swap keeps the column's local cards.
        // Replay the move against the real list id once the create lands —
        // the reconciling refresh would otherwise silently drag the card
        // back to its old list.
        registerPendingListReady(toListId, (realListId) => {
          if (!realListId) return;
          const target = boardRef.current?.lists
            .flatMap((l) => l.cards)
            .find((c) => c.id === cardId);
          // The card itself may still be waiting on its own create; the
          // refresh after that create settles its position instead.
          if (!target || isOptimisticId(target.id)) return;
          // Anchors may reference optimistic cards staged in the new list —
          // never send those (omitted anchors mean "append at the end").
          const replay: TaskCardPatchPayload = { list_id: realListId };
          if (before && !isOptimisticId(before)) replay.before_card_id = before;
          if (after && !isOptimisticId(after)) replay.after_card_id = after;
          if (completed !== undefined) replay.completed = completed;
          void runOp(async () => {
            const token = await authToken();
            await updateTaskCard(cardId, replay, token);
          }, "Couldn't move the card.");
        });
        return;
      }

      // A just-created SOURCE list is fine: only the (real) destination id is
      // sent, so the move PATCHes through normally.
      await runOp(async () => {
        const token = await authToken();
        await updateTaskCard(cardId, patch, token);
      }, "Couldn't move the card.");
    },
    [mutateBoard, runOp, authToken, registerPendingListReady]
  );

  // Column reorder: position = float midpoint between the new neighbours.
  const moveList = useCallback(
    async (listId: string, toIndex: number) => {
      const b = boardRef.current;
      if (!b) return;
      const currentIndex = b.lists.findIndex((l) => l.id === listId);
      if (currentIndex === -1 || toIndex === currentIndex) return;
      const dragged = b.lists[currentIndex];
      const ordered = b.lists.filter((l) => l.id !== listId);
      const i = Math.min(Math.max(toIndex, 0), ordered.length);

      let position: number;
      if (ordered.length === 0) position = dragged.position;
      else if (i === 0) position = ordered[0].position - 1;
      else if (i >= ordered.length) position = ordered[ordered.length - 1].position + 1;
      else position = (ordered[i - 1].position + ordered[i].position) / 2;

      const updatedDragged = { ...dragged, position };
      mutateBoard((prev) => ({
        ...prev,
        lists: [...ordered.slice(0, i), updatedDragged, ...ordered.slice(i)],
      }));

      // Optimistic (just-created) list: local reorder only until the real id
      // arrives via the create's temp→real swap.
      if (isOptimisticId(listId)) return;

      await runOp(async () => {
        const token = await authToken();
        await updateTaskList(listId, { position }, token);
      }, "Couldn't reorder the lists.");
    },
    [mutateBoard, runOp, authToken]
  );

  const applyBackground = useCallback(
    async (selection: BackgroundSelection) => {
      mutateBoard((prev) => ({
        ...prev,
        background_url: selection.background_url,
        background_kind: selection.background_kind,
      }));
      setPickerOpen(false);
      await runOp(async () => {
        const token = await authToken();
        await updateTaskBoard(boardId, selection, token);
      }, "Couldn't save the board background.");
    },
    [mutateBoard, runOp, authToken, boardId]
  );

  // ---- 3. LOAD + REAL-TIME POLL --------------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    // Stable for the component's lifetime (useRef initializer); captured so
    // the cleanup below doesn't dereference the ref.
    const pendingListReady = pendingListReadyRef.current;
    // Stale-while-revalidate: a board visited earlier in this SPA session
    // renders instantly from the lib/cache store, then revalidates.
    const cached = getCachedData<TaskBoardFull>(cacheKeyFor(boardId));
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SWR: hydrate instantly from the session cache before the network revalidation
      applyBoard(cached.data);
      setInitialLoading(false);
    }
    pullBoard()
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load board");
      })
      .finally(() => {
        if (mountedRef.current) setInitialLoading(false);
      });

    // ~2s revision poll: only re-downloads the full board when the revision
    // actually moved, and never while a mutation or re-pull is in flight.
    const poll = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (refreshingRef.current || pendingOpsRef.current > 0) return;
      void (async () => {
        try {
          const token = await authToken();
          const head = await getTaskBoardHead(boardId, token);
          if (!mountedRef.current || refreshingRef.current || pendingOpsRef.current > 0) return;
          if (head.revision !== revisionRef.current) await refresh();
        } catch {
          // Transient poll failure — retried on the next tick.
        }
      })();
    }, POLL_MS);

    // Clock snapshot (client-only so SSR markup matches).
    setToday(new Date().toISOString().slice(0, 10));

    return () => {
      mountedRef.current = false;
      clearInterval(poll);
      // Release any list-create waiters (queued card adds / moves) so no
      // composer await hangs after the board unmounts.
      for (const queue of pendingListReady.values()) {
        queue.forEach((cb) => cb(null));
      }
      pendingListReady.clear();
    };
  }, [boardId, authToken, pullBoard, refresh, applyBoard]);

  // <body> becomes available for portals after mount (SSR-safe).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot SSR gate: portals need document.body, which only exists client-side
    setPortalReady(true);
    return () => setPortalReady(false);
  }, []);

  // One-shot stagger window: the first board paint staggers columns/cards in;
  // 900ms later every newly mounted element enters without delay (drag-drop
  // re-mounts and quick adds must never feel laggy).
  useEffect(() => {
    if (!board || !enterStagger) return;
    const t = setTimeout(() => setEnterStagger(false), 900);
    return () => clearTimeout(t);
  }, [board, enterStagger]);

  // ---- 4. DRAG & DROP -------------------------------------------------------
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dndState = useBoardDndState();
  const { drag, cardPreview, listPreviewIndex } = dndState;
  const dnd = useBoardDndEngine({
    scrollRef,
    ...dndState,
    onCardDrop: ({ cardId, fromListId, toListId, toIndex }) => {
      void moveCard(cardId, fromListId, toListId, toIndex);
    },
    onListDrop: ({ listId, toIndex }) => {
      void moveList(listId, toIndex);
    },
  });

  // ---- 5. PRESENTATION ------------------------------------------------------

  if (initialLoading && !board) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-bg">
        <div className="flex items-center gap-2 text-muted text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading board…
        </div>
      </div>
    );
  }

  const lists = board?.lists ?? [];
  const cardDrag = drag?.kind === "card" ? drag : null;

  // Display order during drags:
  //   card drag → dragged card removed everywhere, placeholder drawn at target
  //   list drag → columns live-reorder (Trello style)
  let displayLists: TaskList[] = lists;
  if (cardDrag) {
    displayLists = lists.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== cardDrag.cardId) }));
  } else if (drag?.kind === "list" && listPreviewIndex !== null) {
    const dragged = lists.find((l) => l.id === drag.listId);
    if (dragged) {
      const ordered = lists.filter((l) => l.id !== drag.listId);
      const i = Math.min(Math.max(listPreviewIndex, 0), ordered.length);
      displayLists = [...ordered.slice(0, i), dragged, ...ordered.slice(i)];
    }
  }

  const draggedCard =
    cardDrag && board
      ? lists.flatMap((l) => l.cards).find((c) => c.id === cardDrag.cardId) ?? null
      : null;

  const listDrag = drag?.kind === "list" ? drag : null;
  const draggedList = listDrag && board ? lists.find((l) => l.id === listDrag.listId) ?? null : null;

  const openCard =
    openCardId && board ? lists.flatMap((l) => l.cards).find((c) => c.id === openCardId) ?? null : null;

  const background = resolveBoardBackground(board?.background_kind, board?.background_url);
  const statusLabel = pendingOps > 0 ? "Saving…" : syncing ? "Syncing…" : "Saved";

  return (
    // h-[100dvh] (not h-full): the dashboard's page-transition wrapper is
    // auto-height, so percentage heights silently collapse on this route —
    // the board owns the full viewport explicitly.
    <div className="taskboard-root relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-bg">
      <BoardBackgroundLayer key={background.type === "image" ? background.url : background.type === "gradient" ? background.key : "none"} background={background} />

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        {/* Top board bar — same anatomy as the sketch board editor */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-14 shrink-0 border-b border-line bg-card/85 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard/planner/tasks"
              className="press p-2 rounded-lg text-muted hover:text-fg hover:bg-surface/80 shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              title="Back to boards"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <Kanban className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              {renaming ? (
                <input
                  autoFocus
                  defaultValue={board?.name ?? ""}
                  onBlur={(e) => void commitRename(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void commitRename((e.target as HTMLInputElement).value);
                    if (e.key === "Escape") setRenaming(false);
                  }}
                  maxLength={200}
                  className="input-line max-w-[280px]"
                />
              ) : (
                <button
                  onClick={() => setRenaming(true)}
                  className="group flex items-center gap-1.5 min-w-0 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                  title="Rename board"
                >
                  <h2 className="font-display font-bold text-[15px] text-fg leading-tight truncate drop-shadow-sm">
                    {board?.name ?? "Board"}
                  </h2>
                  <PencilLine className="w-3.5 h-3.5 text-faint opacity-0 group-hover:opacity-100 shrink-0" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div
              className="hidden md:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-surface/60 border border-line/70 text-[11px] font-medium text-muted/90 shadow-2xs select-none"
              title="Sync status"
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  pendingOps > 0
                    ? "bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                    : syncing
                    ? "bg-blue-400 animate-pulse shadow-[0_0_6px_rgba(96,165,250,0.5)]"
                    : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                )}
              />
              <span>{statusLabel}</span>
            </div>

            {/* Background picker */}
            <div className="relative">
              <button
                ref={setPickerAnchor}
                onClick={() => setPickerOpen((o) => !o)}
                aria-expanded={pickerOpen}
                className={cn(
                  "press inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer",
                  pickerOpen
                    ? "border-accent/60 text-fg bg-surface"
                    : "border-line text-muted hover:text-fg hover:bg-surface/80"
                )}
                title="Change board background"
              >
                <Palette className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Background</span>
              </button>
              {pickerOpen && (
                <TaskBackgroundPicker
                  anchorEl={pickerAnchor}
                  current={{ kind: board?.background_kind ?? null, url: board?.background_url ?? null }}
                  onSelect={(sel) => void applyBackground(sel)}
                  onClose={() => setPickerOpen(false)}
                  busy={pendingOps > 0}
                />
              )}
            </div>
          </div>
        </div>

        {/* Board canvas — horizontal scroller of translucent columns */}
        <div
          ref={scrollRef}
          className={cn(
            "taskboard-scroll-x flex-1 min-h-0 overflow-x-auto overflow-y-hidden pb-1.5",
            openCard && "taskboard-drawer-open"
          )}
        >
          <div className="flex h-full min-h-0 items-start gap-4 pl-4 sm:pl-6 py-4 sm:py-6 pr-0 min-w-max">
            <AnimatePresence initial={false}>
              {displayLists.map((list, index) => (
                <ListColumn
                  key={list.id}
                  list={list}
                  index={index}
                  enterStagger={enterStagger}
                  today={today}
                  isListDragging={drag?.kind === "list" && drag.listId === list.id}
                  placeholder={
                    cardDrag && cardPreview?.listId === list.id
                      ? { index: cardPreview.index, height: cardDrag.height }
                      : null
                  }
                  registerColumn={(el) => dnd.registerColumn(list.id, el)}
                  registerCardArea={(el) => dnd.registerCardArea(list.id, el)}
                  onHeaderPointerDown={(e) => dnd.startListDrag(e, list.id)}
                  editing={editingListId === list.id}
                  onStartEdit={() => setEditingListId(list.id)}
                  onCommitEdit={(value) => void renameList(list, value)}
                  onCancelEdit={() => setEditingListId(null)}
                  onDelete={() => void removeList(list)}
                  onAddCard={(title, priority) => addCard(list.id, title, priority)}
                  onCardPointerDown={(e, card) => dnd.startCardDrag(e, { id: card.id, list_id: card.list_id })}
                  onCardOpen={(card) => setOpenCardId(card.id)}
                  onCardToggle={(card) => void toggleCard(card)}
                  onCardRemove={(card) => void removeCard(card)}
                />
              ))}
            </AnimatePresence>

            <AddListComposer onAdd={(listName) => addList(listName)} />

            {/* Trailing spacer: guarantees the exact same gap after Add list as the gap on the right of the lists (gap-4) */}
            <div
              className="shrink-0 w-px h-1 pointer-events-none -ml-px"
              aria-hidden
            />
          </div>
        </div>
      </div>

      {/* Drag ghost — transform-driven by the dnd engine, never re-renders on
          move. Portalled to <body>: the page-transition wrapper keeps a
          filter() that would hijack the ghost's fixed positioning and offset
          it by the sidebar width. */}
      {portalReady && cardDrag && draggedCard && (
        createPortal(
          <div
            ref={(el) => dnd.setGhostEl(el)}
            className="fixed left-0 top-0 z-[95] pointer-events-none will-change-transform"
            style={{ width: cardDrag.width }}
          >
            <div className="rotate-2 scale-[1.03]">
              <div className="rounded-xl border border-line-strong bg-surface shadow-2xl shadow-black/60">
                <CardFace card={draggedCard} today={today} static />
              </div>
            </div>
          </div>,
          document.body
        )
      )}

      {portalReady && listDrag && draggedList && (
        createPortal(
          <div
            ref={(el) => dnd.setGhostEl(el)}
            className="fixed left-0 top-0 z-[95] pointer-events-none will-change-transform"
            style={{ width: listDrag.width || 300 }}
          >
            <div className="rotate-1 scale-[1.02]">
              <div className="rounded-2xl border-2 border-accent/70 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/80 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3.5 py-3 border-b border-line/70 bg-surface/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-sm font-semibold text-fg tracking-wide truncate">
                      {draggedList.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-accent-soft text-accent font-semibold">
                    {draggedList.cards.length}
                  </span>
                </div>
                <div className="p-2 space-y-1.5 max-h-[220px] overflow-hidden opacity-75">
                  {draggedList.cards.slice(0, 3).map((c) => (
                    <div
                      key={c.id}
                      className="px-2.5 py-2 rounded-xl bg-surface/80 border border-line/70 text-xs text-fg/90 truncate shadow-xs font-medium"
                    >
                      {c.title}
                    </div>
                  ))}
                  {draggedList.cards.length === 0 && (
                    <div className="px-3 py-3 text-center text-xs text-faint italic font-medium">
                      No cards in this list
                    </div>
                  )}
                  {draggedList.cards.length > 3 && (
                    <div className="text-[10px] text-faint text-center pt-1 font-mono">
                      +{draggedList.cards.length - 3} more cards
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      )}

      {/* Detail drawer — TaskBoard stays the single owner of board state:
          the drawer edits through onPatch and the optimistic subtask /
          attachment handlers below, so card badges update instantly. */}
      <TaskDetailDrawer
        card={openCard}
        lists={lists}
        onClose={() => setOpenCardId(null)}
        onPatch={(cardId, patch) => patchCard(cardId, patch)}
        onDelete={(card) => removeCard(card)}
        onAddSubtask={addSubtaskToCard}
        onToggleSubtask={toggleSubtaskOnCard}
        onDeleteSubtask={deleteSubtaskFromCard}
        onUploadAttachment={uploadCardAttachment}
        onDeleteAttachment={deleteCardAttachment}
      />
    </div>
  );
}

// ------------------------------------------------------------------------------
// Board background: gradient or Unsplash image rendered progressively — a
// tiny blurred variant (w=32) paints immediately, the full-size variant
// (w=1600, q=70) fades in over it once loaded. A dark overlay keeps columns
// readable on any photo. With NO background set this layer renders nothing —
// the canvas is the plain bg-bg surface. All layers are static backgrounds
// — prefers-reduced-motion is respected by construction.
// ------------------------------------------------------------------------------

function BoardBackgroundLayer({ background }: { background: BoardBackground }) {
  if (background.type === "none") {
    // Clean default: no decorative layers — the root board div already
    // carries the bg-bg token surface.
    return null;
  }

  if (background.type === "gradient") {
    return (
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-0" style={{ background: background.css }} />
        <div className="absolute inset-0 taskboard-default-noise opacity-60" />
      </div>
    );
  }

  return (
    <BoardImageBackground url={background.url} />
  );
}

function BoardImageBackground({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  const tiny = unsplashVariant(url, 32, 30);
  const full = unsplashVariant(url, 1600, 70);

  return (
    <div className="absolute inset-0 overflow-hidden bg-bg" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote board backgrounds (any CDN), next/image has no configured domains */}
      <img
        src={tiny}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: "blur(20px)", transform: "scale(1.15)" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote board backgrounds (any CDN), next/image has no configured domains */}
      <img
        src={full}
        alt=""
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
      {/* Strong scrim: photos must never compete with card text. Gradient
          wash + vignette keep the columns' glass readable on any image. */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/85 via-bg/55 to-bg/75" />
      <div className="absolute inset-0 taskboard-default-vignette" />
    </div>
  );
}

// ------------------------------------------------------------------------------
// List column
// ------------------------------------------------------------------------------

interface ListColumnProps {
  list: TaskList;
  /** Column position — drives the one-shot entrance stagger. */
  index: number;
  /** True only during the first board paint (see enterStagger state). */
  enterStagger: boolean;
  today: string | null;
  isListDragging: boolean;
  placeholder: { index: number; height: number } | null;
  registerColumn: (el: HTMLElement | null) => void;
  registerCardArea: (el: HTMLElement | null) => void;
  onHeaderPointerDown: (e: React.PointerEvent) => void;
  editing: boolean;
  onStartEdit: () => void;
  onCommitEdit: (value: string) => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  /** Resolves false when the create failed — the composer keeps the text. */
  onAddCard: (title: string, priority?: TaskPriority | null) => Promise<boolean>;
  onCardPointerDown: (e: React.PointerEvent, card: TaskCard) => void;
  onCardOpen: (card: TaskCard) => void;
  onCardToggle: (card: TaskCard) => void;
  onCardRemove: (card: TaskCard) => void;
}

const PRIORITY_OPTIONS: TaskPriority[] = ["urgent", "high", "medium", "low"];

function ListColumn({
  list,
  index,
  enterStagger,
  today,
  isListDragging,
  placeholder,
  registerColumn,
  registerCardArea,
  onHeaderPointerDown,
  editing,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onDelete,
  onAddCard,
  onCardPointerDown,
  onCardOpen,
  onCardToggle,
  onCardRemove,
}: ListColumnProps) {
  const [draft, setDraft] = useState("");
  const [draftPriority, setDraftPriority] = useState<TaskPriority | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  // True while the card POST is in flight — the Add button spins and is
  // disabled, Enter is ignored, so rapid Enters can't double-add.
  const [adding, setAdding] = useState(false);

  // Click-away / Esc dismissal (see use-dismissable — the column's
  // backdrop-blur makes fixed shields resolve against the column box).
  const composerRef = useRef<HTMLDivElement | null>(null);
  useDismissable(composerOpen, composerRef, () => setComposerOpen(false));

  const submit = async () => {
    const title = draft.trim();
    if (!title || adding) return;
    setAdding(true);
    const ok = await onAddCard(title, draftPriority);
    setAdding(false);
    if (ok) {
      // Success: clear draft and auto-hide composer menu
      setDraft("");
      setDraftPriority(null);
      setComposerOpen(false);
    }
    // Failure: keep the text so Enter retries without retyping.
  };

  // Cards + optional drop placeholder interleaved at the target index.
  const nodes: React.ReactNode[] = [];
  list.cards.forEach((card, i) => {
    if (placeholder && placeholder.index === i) {
      nodes.push(<DropPlaceholder key="drop-placeholder" height={placeholder.height} />);
    }
    nodes.push(
      <motion.div
        key={card.id}
        layout="position"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{
          duration: 0.18,
          ease: [0.16, 1, 0.3, 1],
          delay: enterStagger ? Math.min(i, 10) * 0.03 : 0,
        }}
        data-card-id={card.id}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={`Open card: ${card.title}`}
          onPointerDown={(e) => onCardPointerDown(e, card)}
          onClick={() => onCardOpen(card)}
          onKeyDown={(e) => {
            // Inner controls (checkbox, delete) own their own key handling.
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onCardOpen(card);
            }
          }}
          className="cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          <CardFace
            card={card}
            today={today}
            onToggle={() => onCardToggle(card)}
            onRemove={() => onCardRemove(card)}
          />
        </div>
      </motion.div>
    );
  });
  if (placeholder && placeholder.index >= list.cards.length) {
    nodes.push(<DropPlaceholder key="drop-placeholder" height={placeholder.height} />);
  }

  return (
    <motion.div
      ref={registerColumn}
      layout="position"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{
        duration: 0.26,
        ease: [0.16, 1, 0.3, 1],
        delay: enterStagger ? Math.min(index, 8) * 0.055 : 0,
      }}
      className={cn(
        "group/column relative w-[300px] shrink-0 h-auto max-h-full flex flex-col rounded-2xl border bg-[#121214]/90 backdrop-blur-md",
        "shadow-xl transition-[border-color,box-shadow,opacity] duration-200",
        isListDragging
          ? "opacity-35 border-dashed border-accent/80 ring-2 ring-accent/30 bg-accent/5 scale-[0.99] pointer-events-none select-none"
          : "border-neutral-800/90 hover:border-neutral-700/80"
      )}
    >
      {/* Hairline sheen along the column's top edge (app panel idiom) */}
      <div
        className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-t-2xl"
        aria-hidden
      />

      {/* Header — drag handle for column reordering */}
      <div
        onPointerDown={onHeaderPointerDown}
        className="taskboard-drag-handle flex items-center justify-between gap-2 px-3.5 py-3 border-b border-neutral-800/80 shrink-0 cursor-grab active:cursor-grabbing rounded-t-2xl hover:bg-neutral-800/30 transition-colors select-none"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <GripVertical className="w-3.5 h-3.5 text-neutral-500 shrink-0 opacity-50 group-hover/column:opacity-90 transition-opacity" />
          {editing ? (
            <input
              autoFocus
              defaultValue={list.name}
              onPointerDown={(e) => e.stopPropagation()}
              onBlur={(e) => onCommitEdit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCommitEdit((e.target as HTMLInputElement).value);
                if (e.key === "Escape") onCancelEdit();
              }}
              maxLength={200}
              className="w-full min-w-0 px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-sm font-semibold text-neutral-100 focus:outline-none focus:border-amber-500"
            />
          ) : (
            <span
              onDoubleClick={onStartEdit}
              title="Double-click to rename · drag header to reorder"
              className="text-sm font-semibold text-neutral-100 tracking-tight truncate cursor-grab active:cursor-grabbing hover:text-white transition-colors select-none"
            >
              {list.name}
            </span>
          )}
        </div>
        <div
          className="flex items-center gap-1.5 shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="text-[11px] font-mono text-neutral-300 px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 min-w-6 text-center font-medium">
            {list.cards.length}
          </span>
          <ListMenu
            onRename={onStartEdit}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* Cards — the area keeps a small floor when the list is empty so a
          compact (content-height) list still offers a decent drop target. */}
      <div
        ref={registerCardArea}
        className={cn(
          "taskboard-scroll-y flex-1 overflow-y-auto px-2 py-2",
          list.cards.length === 0 ? "min-h-[64px]" : "min-h-0"
        )}
      >
        {list.cards.length === 0 && !placeholder ? (
          <p className="text-center text-[11px] text-muted/80 py-8 px-3">No cards yet.</p>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false} mode="popLayout">
              {nodes}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add-card composer — inline in the column footer, replacing the Add button without jumping or overlapping */}
      <div className="p-2 border-t border-line/70 shrink-0">
        {composerOpen ? (
          <div ref={composerRef} className="w-full">
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              role="form"
              aria-label="Add card"
              className="rounded-xl border border-line bg-card/95 shadow-lg p-2.5 space-y-2"
            >
              <textarea
                autoFocus
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                  if (e.key === "Escape") setComposerOpen(false);
                }}
                placeholder="Card title…"
                maxLength={300}
                className="w-full resize-none px-2.5 py-1.5 rounded-lg bg-surface border border-line text-xs text-fg placeholder:text-faint focus:outline-none focus:border-accent"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="press p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface cursor-pointer"
                  title="Cancel"
                  aria-label="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!draft.trim() || adding}
                  title="Add card"
                  className="press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg text-[11px] font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-default"
                >
                  {adding ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Add card
                </button>
              </div>
            </motion.div>
          </div>
        ) : (
          <button
            onClick={() => setComposerOpen(true)}
            className="press w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted hover:text-fg hover:bg-surface/80 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add a card
          </button>
        )}
      </div>
    </motion.div>
  );
}

function DropPlaceholder({ height }: { height: number }) {
  return (
    <div
      className="rounded-xl border-2 border-dashed border-accent/50 bg-accent/10"
      style={{ height }}
      aria-hidden
    />
  );
}

function ListMenu({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  // Click-away / Esc dismissal (the column's backdrop-blur makes fixed
  // shields resolve against the column box — see use-dismissable).
  const menuRef = useRef<HTMLDivElement | null>(null);
  useDismissable(open, menuRef, () => setOpen(false));
  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="List options"
        aria-label="List options"
        aria-expanded={open}
        className="press p-1 rounded-md text-faint hover:text-fg hover:bg-surface/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
      >
        <Menu className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-xl border border-line bg-card shadow-xl shadow-black/50 p-1 enter">
          <button
            onClick={() => {
              setOpen(false);
              onRename();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-fg hover:bg-surface transition-colors cursor-pointer"
          >
            <PencilLine className="w-3.5 h-3.5 text-muted" /> Rename
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-danger hover:bg-danger/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete list
          </button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------
// Card face — shared by board rows and the drag ghost
// ------------------------------------------------------------------------------

function CardFace({
  card,
  today,
  onToggle,
  onRemove,
  static: isStatic,
}: {
  card: TaskCard;
  today: string | null;
  onToggle?: () => void;
  onRemove?: () => void;
  static?: boolean;
}) {
  const due = card.due_date ?? null;
  const status = dueStatus(due, today, card.completed);

  // Session-cached project labels (one fetch per SPA session, shared with the
  // drawer's Project select — never a per-card fetch).
  const projectNameMap = useProjectsNameMap();
  const projectName = card.project_id ? projectNameMap.get(card.project_id) ?? null : null;

  const doneSubtasks = card.subtasks.filter((s) => s.is_done).length;
  const totalSubtasks = card.subtasks.length;

  const visibleTags = card.tags.slice(0, 3);
  const extraTags = card.tags.length - visibleTags.length;

  return (
    <div
      className={cn(
        "group rounded-xl border p-3 transition-[border-color,box-shadow,transform] duration-150",
        "bg-[#18181b]/95 border-neutral-800 shadow-sm",
        !isStatic &&
          "hover:border-neutral-700 hover:-translate-y-0.5 hover:shadow-md hover:bg-[#1f1f23] active:translate-y-0 active:scale-[0.995]",
        card.completed && "opacity-70"
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Completed checkbox — animated check; toggling never moves the card */}
        {onToggle && !isStatic ? (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={cn(
              "mt-0.5 w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer",
              card.completed
                ? "bg-accent border-accent text-accent-fg"
                : "bg-neutral-900/60 border-neutral-700 text-transparent hover:border-accent"
            )}
            aria-label={card.completed ? "Mark not done" : "Mark done"}
          >
            <motion.span
              initial={false}
              animate={{ scale: card.completed ? 1 : 0.4, opacity: card.completed ? 1 : 0 }}
              transition={{ duration: 0.14 }}
              className="flex"
            >
              <Check className="w-3 h-3" strokeWidth={3} />
            </motion.span>
          </button>
        ) : (
          <span
            className={cn(
              "mt-0.5 w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0",
              card.completed ? "bg-accent border-accent text-accent-fg" : "border-neutral-700 text-transparent"
            )}
            aria-hidden
          >
            <Check className="w-3 h-3" strokeWidth={3} />
          </span>
        )}

        <div className="flex-1 min-w-0">
          <span
            className={cn(
              "block text-sm font-medium leading-snug break-words tracking-tight",
              card.completed ? "line-through text-neutral-500" : "text-neutral-100"
            )}
          >
            {card.title}
          </span>

          {(card.tags.length > 0 || due || totalSubtasks > 0 || card.attachments.length > 0 || card.project_id || card.priority || card.description) && (
            <div className="mt-2.5 flex items-center justify-between gap-2">
              {/* Left — tags only: muted neutral chips matching Experience tab badges */}
              {visibleTags.length > 0 && (
                <div className="flex items-center gap-1 min-w-0">
                  {visibleTags.map((tag) => (
                    <span
                      key={tag}
                      title={tag}
                      className="inline-flex px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 text-[10px] font-medium max-w-[110px] shrink-0"
                    >
                      <span className="truncate">{tag}</span>
                    </span>
                  ))}
                  {extraTags > 0 && (
                    <span className="text-[10px] text-neutral-400 shrink-0 font-mono">+{extraTags}</span>
                  )}
                </div>
              )}

              {/* Right — data badges only (due, subtasks, attachments, project,
                  priority dot, description marker). Every badge conveys state;
                  nothing decorative. */}
              <div className="ml-auto flex items-center gap-2 shrink-0">
                {due && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] shrink-0",
                      status === "overdue"
                        ? "bg-danger/10 text-danger border-danger/30"
                        : status === "today"
                          ? "bg-warn/10 text-warn border-warn/30"
                          : "bg-card text-muted border-line"
                    )}
                  >
                    <Clock className="w-3 h-3" />
                    {formatDueDate(due)}
                  </span>
                )}

                {totalSubtasks > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] text-muted shrink-0"
                    title={`Subtasks: ${doneSubtasks}/${totalSubtasks}`}
                  >
                    <Check className="w-3 h-3" />
                    {doneSubtasks}/{totalSubtasks}
                  </span>
                )}

                {card.attachments.length > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] text-muted shrink-0"
                    title={`${card.attachments.length} attachment${card.attachments.length === 1 ? "" : "s"}`}
                  >
                    <Paperclip className="w-3 h-3" />
                    {card.attachments.length}
                  </span>
                )}

                {card.project_id && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] text-muted shrink-0 max-w-[110px]"
                    title={projectName ? `Project: ${projectName}` : "Linked to a project"}
                  >
                    <Folder className="w-3 h-3 shrink-0" />
                    <span className="truncate">{projectName ?? "Project"}</span>
                  </span>
                )}

                {card.priority && (
                  <span
                    className={cn("w-1.5 h-1.5 rounded-full shrink-0", priorityDotClass(card.priority))}
                    title={`Priority: ${PRIORITY_META[card.priority].label}`}
                  />
                )}

                {card.description && (
                  <span title="Has description" className="text-muted shrink-0 inline-flex">
                    <FileText className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {onRemove && !isStatic && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Delete card"
            aria-label="Delete card"
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 press p-1 rounded-md text-muted hover:text-danger transition-opacity shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------
// Add-list composer — the closed trigger is a compact dashed button; while
// open it keeps that same footprint (a ghost trigger) and the solid panel
// drops BELOW it like a menu — columns are content-height now, so there is
// no full-height wrapper to anchor against. Enter/Add submits, Esc/X/
// click-away cancels. Creation stays optimistic + instant (TaskBoard.addList
// stages the column immediately and swaps the temp id for the server row on
// resolve).
// ------------------------------------------------------------------------------

function AddListComposer({ onAdd }: { onAdd: (name: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // Click-away / Esc dismissal (page-transition wrapper keeps a filter, so
  // fixed shields here don't resolve against the viewport either).
  const panelRef = useRef<HTMLDivElement | null>(null);
  useDismissable(open, panelRef, () => {
    if (!busy) setOpen(false);
  });

  const submit = async () => {
    const listName = draft.trim();
    if (!listName || busy) return;
    setBusy(true);
    const ok = await onAdd(listName);
    setBusy(false);
    if (ok) {
      setDraft("");
      setOpen(false);
    }
    // Failure: the popover stays open with the name so Enter retries.
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="press w-[260px] shrink-0 rounded-2xl border border-dashed border-line-strong/80 bg-card/50 hover:bg-card/80 text-muted hover:text-fg hover:border-accent/50 text-xs font-semibold flex items-center justify-center gap-1.5 py-3 cursor-pointer backdrop-blur-sm transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add another list
      </button>
    );
  }

  return (
    <div ref={panelRef} className="w-[260px] shrink-0">
      <motion.div
        initial={{ opacity: 0, y: 4, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        role="form"
        aria-label="Add list"
        className="rounded-2xl border border-line bg-card/95 shadow-xl p-3 space-y-2.5 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-fg">New list</span>
          <button
            onClick={() => setOpen(false)}
            title="Cancel"
            aria-label="Cancel"
            className="press p-1 rounded-md text-muted hover:text-fg hover:bg-surface cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="List name…"
          maxLength={200}
          className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-line text-xs text-fg placeholder:text-faint focus:outline-none focus:border-accent"
        />
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setOpen(false)}
            className="press px-2 py-1 rounded-lg text-[11px] text-muted hover:text-fg cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={!draft.trim() || busy}
            className="press inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg text-[11px] font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Add list
          </button>
        </div>
      </motion.div>
    </div>
  );
}
