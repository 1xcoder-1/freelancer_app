"use client";

// Drag & drop for the task board — implemented directly on pointer events
// because @dnd-kit is not a dependency of this app. The design goal is
// Trello-grade smoothness with zero per-frame React work:
//
//   * pointermove mutates NOTHING in React — the drag ghost is moved by
//     writing a transform to a DOM node ref, and the drop target only
//     commits to state when it actually changes (placeholder hop), which
//     is a handful of renders per drag, not hundreds.
//   * insertion index = pointer Y against cached card midpoints of the
//     hovered column; midpoints are recomputed only when the hovered
//     column changes, not on every mouse move.
//   * geometry is discovered through element registries (registerColumn /
//     registerCardArea) + data attributes, so the engine knows nothing about
//     TaskBoard's internals and TaskBoard keeps owning all board state.
//   * on drop the engine reports semantic targets ({listId, index}); the
//     board translates that into the backend's before/after midpoint
//     contract and runs the optimistic update.
//
// The API is split in two hooks so render state stays analyzer-pure:
//   useBoardDndState()  — plain useState triple (drag, cardPreview, listPreviewIndex)
//   useBoardDndEngine() — the pointer-event machinery; returns ONLY action
//                         functions that are invoked from event handlers /
//                         callback refs, never during render.

import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";

const DRAG_THRESHOLD_PX = 6; // pointer must travel this far before a drag activates
const EDGE_ZONE_PX = 80; // proximity to a scroll edge that triggers auto-scroll
const EDGE_MAX_SPEED = 18; // max px/frame auto-scroll at the very edge

export interface CardDragCandidate {
  id: string;
  list_id: string;
}

export interface CardDropTarget {
  cardId: string;
  fromListId: string;
  toListId: string;
  toIndex: number;
}

export interface ListDropTarget {
  listId: string;
  toIndex: number;
}

export interface CardDragState {
  kind: "card";
  cardId: string;
  fromListId: string;
  width: number;
  height: number;
  grabDx: number;
  grabDy: number;
}

export interface ListDragState {
  kind: "list";
  listId: string;
  width: number;
  height: number;
  grabDx: number;
  grabDy: number;
}

export type DragState = CardDragState | ListDragState | null;

export interface CardDropPreview {
  listId: string;
  index: number;
}

// ---- pure render state (safe to read during render) -------------------------

export function useBoardDndState() {
  const [drag, setDrag] = useState<DragState>(null);
  const [cardPreview, setCardPreview] = useState<CardDropPreview | null>(null);
  const [listPreviewIndex, setListPreviewIndex] = useState<number | null>(null);
  return {
    drag,
    setDrag,
    cardPreview,
    setCardPreview,
    listPreviewIndex,
    setListPreviewIndex,
  } as const;
}

// ---- pointer-event engine ---------------------------------------------------

interface Pointer {
  x: number;
  y: number;
}

interface PendingDrag {
  card?: { id: string; list_id: string };
  listId?: string;
  rect: DOMRect;
  grabDx: number;
  grabDy: number;
}

export function useBoardDndEngine(opts: {
  scrollRef: RefObject<HTMLElement | null>;
  setDrag: Dispatch<SetStateAction<DragState>>;
  setCardPreview: Dispatch<SetStateAction<CardDropPreview | null>>;
  setListPreviewIndex: Dispatch<SetStateAction<number | null>>;
  onCardDrop: (target: CardDropTarget) => void;
  onListDrop: (target: ListDropTarget) => void;
}) {
  const { scrollRef } = opts;

  // Everything the pointermove handler reads lives in refs so a single set
  // of window listeners survives re-renders untouched.
  const dragRef = useRef<DragState>(null);
  const pendingRef = useRef<PendingDrag | null>(null);
  const startRef = useRef<Pointer>({ x: 0, y: 0 });
  const pointerRef = useRef<Pointer>({ x: 0, y: 0 });
  const ghostRef = useRef<HTMLElement | null>(null);
  const columnsRef = useRef(new Map<string, HTMLElement>());
  const cardAreasRef = useRef(new Map<string, HTMLElement>());
  const hoveredColumnRef = useRef<string | null>(null);
  const midpointsRef = useRef<{ listId: string; points: number[] }>({ listId: "", points: [] });
  const cardPreviewRef = useRef<CardDropPreview | null>(null);
  const listPreviewRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const activeRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Latest callbacks without re-binding the window listeners.
  const cbsRef = useRef(opts);
  cbsRef.current = opts;

  // ---- element registries ---------------------------------------------------

  const setGhostEl = useCallback((el: HTMLElement | null) => {
    ghostRef.current = el;
    // Position immediately on mount so the ghost never flashes at (0,0).
    if (el) positionGhost();
  }, []);

  const registerColumn = useCallback((listId: string, el: HTMLElement | null) => {
    if (el) columnsRef.current.set(listId, el);
    else columnsRef.current.delete(listId);
  }, []);

  const registerCardArea = useCallback((listId: string, el: HTMLElement | null) => {
    if (el) cardAreasRef.current.set(listId, el);
    else cardAreasRef.current.delete(listId);
  }, []);

  // ---- ghost ----------------------------------------------------------------

  function positionGhost() {
    const g = ghostRef.current;
    const d = dragRef.current;
    if (!g || !d) return;
    const x = pointerRef.current.x - d.grabDx;
    const y = pointerRef.current.y - d.grabDy;
    g.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }

  // ---- geometry -------------------------------------------------------------

  const computeCardMidpoints = useCallback((listId: string): number[] => {
    const area = cardAreasRef.current.get(listId);
    if (!area) return [];
    const points: number[] = [];
    const cards = area.querySelectorAll<HTMLElement>("[data-card-id]");
    cards.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height === 0) return; // exit-animated leftovers
      points.push(r.top + r.height / 2);
    });
    return points;
  }, []);

  const findColumnAt = useCallback((x: number): string | null => {
    for (const [listId, el] of columnsRef.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right) return listId;
    }
    return null;
  }, []);

  const indexFromMidpoints = useCallback((points: number[], y: number): number => {
    for (let i = 0; i < points.length; i++) {
      if (y < points[i]) return i;
    }
    return points.length;
  }, []);

  const listInsertIndex = useCallback((x: number, draggedListId: string | null): number => {
    const entries = [...columnsRef.current.entries()]
      .filter(([id, el]) => id !== draggedListId && el && el.isConnected)
      .map(([id, el]) => ({ id, rect: el.getBoundingClientRect() }))
      .filter((e) => e.rect.width > 0)
      .sort((a, b) => a.rect.left - b.rect.left);
    let index = 0;
    for (const e of entries) {
      if (x > e.rect.left + e.rect.width / 2) index++;
      else break;
    }
    return index;
  }, []);

  // ---- target tracking (cheap, state-committing only on change) -------------

  const updateCardTarget = useCallback(() => {
    const p = pointerRef.current;
    const listId = findColumnAt(p.x);
    if (!listId) return; // keep last target while crossing gaps
    if (hoveredColumnRef.current !== listId) {
      hoveredColumnRef.current = listId;
      midpointsRef.current = { listId, points: computeCardMidpoints(listId) };
    }
    const index = indexFromMidpoints(midpointsRef.current.points, p.y);
    const prev = cardPreviewRef.current;
    if (!prev || prev.listId !== listId || prev.index !== index) {
      const next = { listId, index };
      cardPreviewRef.current = next;
      cbsRef.current.setCardPreview(next);
    }
  }, [findColumnAt, computeCardMidpoints, indexFromMidpoints]);

  const updateListTarget = useCallback(
    (draggedListId: string) => {
      const index = listInsertIndex(pointerRef.current.x, draggedListId);
      if (listPreviewRef.current !== index) {
        listPreviewRef.current = index;
        cbsRef.current.setListPreviewIndex(index);
      }
    },
    [listInsertIndex]
  );

  // ---- auto-scroll (board horizontally + hovered column vertically) ---------

  const autoScrollTick = useCallback(() => {
    if (!activeRef.current) return;
    const p = pointerRef.current;
    const scroller = scrollRef.current;
    let didScroll = false;
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      if (p.x < r.left + EDGE_ZONE_PX) {
        const t = Math.max(0, (r.left + EDGE_ZONE_PX - p.x) / EDGE_ZONE_PX);
        scroller.scrollLeft -= EDGE_MAX_SPEED * t;
        didScroll = true;
      } else if (p.x > r.right - EDGE_ZONE_PX) {
        const t = Math.max(0, (p.x - (r.right - EDGE_ZONE_PX)) / EDGE_ZONE_PX);
        scroller.scrollLeft += EDGE_MAX_SPEED * t;
        didScroll = true;
      }
    }
    const columnId = hoveredColumnRef.current;
    const area = columnId ? cardAreasRef.current.get(columnId) : null;
    if (area) {
      const r = area.getBoundingClientRect();
      if (p.y < r.top + EDGE_ZONE_PX) {
        const t = Math.max(0, (r.top + EDGE_ZONE_PX - p.y) / EDGE_ZONE_PX);
        area.scrollTop -= EDGE_MAX_SPEED * t;
        didScroll = true;
      } else if (p.y > r.bottom - EDGE_ZONE_PX) {
        const t = Math.max(0, (p.y - (r.bottom - EDGE_ZONE_PX)) / EDGE_ZONE_PX);
        area.scrollTop += EDGE_MAX_SPEED * t;
        didScroll = true;
      }
    }
    if (didScroll) {
      const d = dragRef.current;
      if (d?.kind === "card") updateCardTarget();
      else if (d?.kind === "list") updateListTarget(d.listId);
    }
    rafRef.current = requestAnimationFrame(autoScrollTick);
  }, [scrollRef, updateCardTarget, updateListTarget]);

  // ---- lifecycle ------------------------------------------------------------

  const detach = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  const finishDrag = useCallback(
    (dropped: boolean) => {
      cancelAnimationFrame(rafRef.current);
      activeRef.current = false;
      detach();
      document.body.classList.remove("taskboard-dragging");

      const d = dragRef.current;
      if (d && dropped) {
        if (d.kind === "card") {
          const t = cardPreviewRef.current;
          if (t) {
            cbsRef.current.onCardDrop({
              cardId: d.cardId,
              fromListId: d.fromListId,
              toListId: t.listId,
              toIndex: t.index,
            });
          }
        } else {
          const index = listPreviewRef.current;
          if (index !== null) {
            cbsRef.current.onListDrop({ listId: d.listId, toIndex: index });
          }
        }
        // Swallow the click that follows pointerup so dropping a card never
        // opens the detail drawer underneath the pointer.
        window.addEventListener(
          "click",
          (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
          },
          { capture: true, once: true }
        );
      }

      dragRef.current = null;
      pendingRef.current = null;
      cardPreviewRef.current = null;
      listPreviewRef.current = null;
      hoveredColumnRef.current = null;
      midpointsRef.current = { listId: "", points: [] };
      ghostRef.current = null;
      cbsRef.current.setDrag(null);
      cbsRef.current.setCardPreview(null);
      cbsRef.current.setListPreviewIndex(null);
    },
    [detach]
  );

  const activate = useCallback(
    (p: PendingDrag) => {
      activeRef.current = true;
      document.body.classList.add("taskboard-dragging");
      if (p.card) {
        const d: CardDragState = {
          kind: "card",
          cardId: p.card.id,
          fromListId: p.card.list_id,
          width: p.rect.width,
          height: p.rect.height,
          grabDx: p.grabDx,
          grabDy: p.grabDy,
        };
        dragRef.current = d;
        cbsRef.current.setDrag(d);
      } else if (p.listId) {
        const d: ListDragState = {
          kind: "list",
          listId: p.listId,
          width: p.rect.width,
          height: p.rect.height,
          grabDx: p.grabDx,
          grabDy: p.grabDy,
        };
        dragRef.current = d;
        cbsRef.current.setDrag(d);
      }
      positionGhost();
      rafRef.current = requestAnimationFrame(autoScrollTick);
    },
    [autoScrollTick]
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
      const pending = pendingRef.current;
      if (!pending) return;
      if (!dragRef.current) {
        const dist = Math.hypot(
          e.clientX - startRef.current.x,
          e.clientY - startRef.current.y
        );
        if (dist < DRAG_THRESHOLD_PX) return;
        activate(pending);
      }
      positionGhost();
      const d = dragRef.current;
      if (d?.kind === "card") updateCardTarget();
      else if (d?.kind === "list") updateListTarget(d.listId);
    },
    [activate, updateCardTarget, updateListTarget]
  );

  const onPointerUp = useCallback(() => {
    if (dragRef.current) finishDrag(true);
    else {
      // Threshold never crossed — a plain click; just clean up listeners.
      pendingRef.current = null;
      detach();
    }
  }, [detach, finishDrag]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && (dragRef.current || pendingRef.current)) {
        finishDrag(false);
      }
    },
    [finishDrag]
  );

  const attachListeners = useCallback(() => {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onPointerMove, onPointerUp, onKeyDown]);

  // If the component unmounts mid-drag, don't leak listeners.
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cancelAnimationFrame(rafRef.current);
        activeRef.current = false;
        document.body.classList.remove("taskboard-dragging");
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  // ---- public API (invoked from event handlers / callback refs only) --------

  const startCardDrag = useCallback(
    (e: React.PointerEvent, card: CardDragCandidate) => {
      if (e.button !== 0) return;
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      pendingRef.current = {
        card: { id: card.id, list_id: card.list_id },
        rect,
        grabDx: e.clientX - rect.left,
        grabDy: e.clientY - rect.top,
      };
      startRef.current = { x: e.clientX, y: e.clientY };
      pointerRef.current = { x: e.clientX, y: e.clientY };
      attachListeners();
    },
    [attachListeners]
  );

  const startListDrag = useCallback(
    (e: React.PointerEvent, listId: string) => {
      if (e.button !== 0) return;
      const colEl =
        columnsRef.current.get(listId) ??
        ((e.currentTarget as HTMLElement).closest(".group\\/column") as HTMLElement | null) ??
        (e.currentTarget as HTMLElement);
      const rect = colEl.getBoundingClientRect();
      pendingRef.current = {
        listId,
        rect,
        grabDx: e.clientX - rect.left,
        grabDy: e.clientY - rect.top,
      };
      startRef.current = { x: e.clientX, y: e.clientY };
      pointerRef.current = { x: e.clientX, y: e.clientY };
      attachListeners();
    },
    [attachListeners]
  );

  return {
    startCardDrag,
    startListDrag,
    registerColumn,
    registerCardArea,
    setGhostEl,
  };
}
