"use client";

// Task detail drawer — full build (status, tags, subtasks, attachments, project):
//
//   card      — the full TaskCard from the board state (live: every optimistic
//               mutation TaskBoard applies reflects here instantly)
//   lists     — the board's lists, powering the Status select (move = append at
//               the end of the target list, folding in the "Done" semantics)
//   onPatch   — persist a TaskCardPatchPayload; TaskBoard owns the API call,
//               optimistic state and revert, the drawer only edits.
//   onDelete  — delete after the drawer's confirm dialog.
//   on*Subtask / on*Attachment — TaskBoard-owned optimistic ops (stage → API →
//               swap/revert + toast); the drawer renders straight from the card
//               prop and never keeps its own copy of those collections.
//
// Autosave contract: title commits on blur/Enter; description saves debounced
// (800ms) and on blur; priority/due/project/completed/status commit on change.
// The pending description edit is flushed on card switch AND on unmount, so
// closing the drawer never loses the last keystrokes.
//
// Attachment file URLs (Cloudinary CDN) live in a module-level cache so
// re-opening the drawer and board re-renders render instantly with zero
// network calls; image thumbnails render blur-up from w_400 thumbs (never the
// full-size) and the lightbox opens the w_1600 variant.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  Check,
  Clock,
  ExternalLink,
  FileText,
  Folder,
  Image as ImageIcon,
  Link2 as LinkIcon,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from "@/components/animated-icons";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  ProfileField,
  UnderlineInput,
  UnderlineSelect,
  UnderlineTextarea,
} from "@/components/dashboard/profile/profile-fields";
import { toast } from "sonner";

import { confirmDialog } from "@/components/common/ConfirmDialog";
import {
  createTaskAttachment,
  getTaskAttachmentFile,
  uploadFileToCloudinary,
  type TaskAttachment,
  type TaskAttachmentKind,
  type TaskCard,
  type TaskCardPatchPayload,
  type TaskList,
  type TaskPriority,
  type TaskSubtask,
} from "@/lib/api";
import { compressTaskImage } from "@/lib/image-compressor";
import { logHandledError } from "@/lib/log-error";
import { cn } from "@/lib/utils";
import { useProjects } from "./use-projects-cache";

const MAX_TAGS = 10;
const TAG_MAX_LENGTH = 30;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // mirrors /storage/upload's limit
const IMAGE_COMPRESS_THRESHOLD = 150 * 1024; // only bother compressing above ~150KB

// Mirrors apps/api/app/api/v1/endpoints/storage.py ALLOWED_CONTENT_TYPES
// (images, documents, archives, videos). SVG is deliberately absent — an SVG
// can carry a <script> (stored XSS) and the backend rejects it too.
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const IMAGE_INPUT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const DOCUMENT_INPUT_ACCEPT =
  "application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/plain,.txt,text/csv,.csv,application/zip,.zip";

// Fixed, pleasant dot palette for tag chips. Colors are assigned
// deterministically (FNV-1a hash of the tag text), so a tag renders the same
// color on every render and on every card — never random per paint.
const TAG_DOT_COLORS = [
  "#60a5fa", // blue
  "#f472b6", // pink
  "#34d399", // emerald
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#f87171", // red
  "#22d3ee", // cyan
  "#a3e635", // lime
  "#fb923c", // orange
  "#e879f9", // fuchsia
];

function tagDotColor(tag: string): string {
  let hash = 2166136261;
  for (let i = 0; i < tag.length; i += 1) {
    hash ^= tag.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return TAG_DOT_COLORS[(hash >>> 0) % TAG_DOT_COLORS.length];
}

// ------------------------------------------------------------------------------
// Custom Calendar DatePicker matching the Experience Tab design
// ------------------------------------------------------------------------------

function parseCustomDate(str: string): Date | null {
  if (!str) return null;
  const trimmed = str.trim();

  // dd / mm / yyyy or dd-mm-yyyy or dd/mm/yyyy
  const dmyMatch = trimmed.match(/^(\d{1,2})[\s\/\-](\d{1,2})[\s\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // yyyy-mm-dd
  const ymdMatch = trimmed.match(/^(\d{4})[\s\/\-](\d{1,2})[\s\/\-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

function formatToYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatToDisplay(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day} / ${month} / ${year}`;
}

function TaskDatePicker({
  value,
  onChange,
  placeholder = "dd / mm / yyyy",
  disabled = false,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsedDate = parseCustomDate(value);
  const displayValue = parsedDate ? formatToDisplay(parsedDate) : "";
  const [viewDate, setViewDate] = useState<Date>(parsedDate || new Date());

  useEffect(() => {
    if (open) {
      const p = parseCustomDate(value);
      if (p) setViewDate(p);
    }
  }, [open, value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let firstDayIndex = firstDayOfMonth.getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6;

  const totalDaysCurrent = lastDayOfMonth.getDate();
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const days: Array<{
    dayNumber: number;
    isCurrentMonth: boolean;
    date: Date;
  }> = [];

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    days.push({
      dayNumber: d,
      isCurrentMonth: false,
      date: new Date(year, month - 1, d),
    });
  }

  for (let i = 1; i <= totalDaysCurrent; i++) {
    days.push({
      dayNumber: i,
      isCurrentMonth: true,
      date: new Date(year, month, i),
    });
  }

  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    days.push({
      dayNumber: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i),
    });
  }

  const monthName = viewDate.toLocaleDateString("en-US", { month: "long" });

  const handleSelectDay = (date: Date) => {
    onChange(formatToYMD(date));
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className="relative cursor-pointer"
      >
        <UnderlineInput
          value={displayValue}
          readOnly
          placeholder={placeholder}
          disabled={disabled}
          className="pr-12 cursor-pointer"
        />
        <div className="absolute right-1 top-2.5 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-neutral-400 hover:text-white rounded-md transition-colors cursor-pointer"
              title="Clear date"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <Calendar className="w-4 h-4 text-neutral-400 pointer-events-none" />
        </div>
      </div>

      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 sm:right-0 sm:left-auto mt-2 z-[200] w-[290px] sm:w-[310px] rounded-2xl border border-neutral-800 bg-[#141416] p-4 shadow-2xl shadow-black/95 select-none"
          >
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-neutral-800/60">
              <button
                type="button"
                onClick={prevMonth}
                className="w-7 h-7 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-semibold text-neutral-100 transition-colors">
                <span>{`${monthName} ${year}`}</span>
              </div>

              <button
                type="button"
                onClick={nextMonth}
                className="w-7 h-7 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-2 text-center">
              {["M", "T", "W", "T", "F", "S", "S"].map((dayName, idx) => (
                <span key={idx} className="text-xs font-medium text-neutral-400 py-1">
                  {dayName}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center">
              {days.map((item, idx) => {
                const isSelected =
                  parsedDate &&
                  parsedDate.getDate() === item.date.getDate() &&
                  parsedDate.getMonth() === item.date.getMonth() &&
                  parsedDate.getFullYear() === item.date.getFullYear();

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDay(item.date)}
                    className={`w-8 h-8 mx-auto flex items-center justify-center text-xs rounded-full transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#0070f3] text-white font-bold shadow-md shadow-blue-500/30"
                        : item.isCurrentMonth
                        ? "text-neutral-100 hover:bg-neutral-800 hover:text-white font-medium"
                        : "text-neutral-600 hover:bg-neutral-800/50 hover:text-neutral-400"
                    }`}
                  >
                    {item.dayNumber}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------------------
// Attachment file URL resolution + module-level cache
// ------------------------------------------------------------------------------

interface AttachmentFileRefs {
  url: string;
  thumb_url: string | null;
}

// attachmentId → resolved refs. Never evicted within the session: re-opening
// the drawer and board re-renders render instantly with zero network calls.
const attachmentFileCache = new Map<string, AttachmentFileRefs>();
// Deduplicates concurrent fetches for the same attachment.
const attachmentFileInflight = new Map<string, Promise<AttachmentFileRefs>>();
// Thumbs that finished decoding at least once — their tiles skip blur-up.
const thumbsLoaded = new Set<string>();

async function loadAttachmentFileRefs(
  attachmentId: string,
  token?: string
): Promise<AttachmentFileRefs> {
  const hit = attachmentFileCache.get(attachmentId);
  if (hit) return hit;
  let inflight = attachmentFileInflight.get(attachmentId);
  if (!inflight) {
    inflight = getTaskAttachmentFile(attachmentId, token)
      .then((refs) => {
        attachmentFileCache.set(attachmentId, refs);
        return refs;
      })
      .finally(() => {
        attachmentFileInflight.delete(attachmentId);
      });
    attachmentFileInflight.set(attachmentId, inflight);
  }
  return inflight;
}

// /storage/upload returns the CDN URL; the attachment layer wants the public
// id (file_key) so the backend can rebuild sized variants. Strip the
// /upload/ prefix, the version segment and the format extension Cloudinary
// appended. If the shape is unexpected, pass the URL through — the backend
// can still resolve it.
function fileKeyFromCdnUrl(url: string): string {
  const match = /\/upload\/(?:v\d+\/)?(.+)$/.exec(url);
  if (!match) return url;
  return match[1].replace(/\.[a-z0-9]{1,5}$/i, "");
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isOptimisticId(id: string): boolean {
  return id.startsWith("optimistic-");
}

// ------------------------------------------------------------------------------
// Upload pipeline helpers
// ------------------------------------------------------------------------------

// Per-file progress shown on the optimistic placeholder row.
type UploadProgressState = "compressing" | "uploading";

interface PreparedUpload {
  payload: File | Blob;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

// Images > ~150KB are compressed first (WebP, ≤1600px, q0.8) — except GIFs,
// which would lose their animation through the canvas pipeline. Compression is
// best-effort: any failure falls back to the original file.
async function prepareFileForUpload(file: File, kind: TaskAttachmentKind): Promise<PreparedUpload> {
  let payload: File | Blob = file;
  let fileName = file.name;
  let contentType = file.type || "application/octet-stream";
  let sizeBytes = file.size;

  if (kind === "image" && file.size > IMAGE_COMPRESS_THRESHOLD && file.type !== "image/gif") {
    try {
      const compressed = await compressTaskImage(file);
      payload = compressed.blob;
      fileName = compressed.fileName;
      contentType = "image/webp";
      sizeBytes = compressed.compressedSize;
    } catch (err) {
      logHandledError("Task image compression failed, uploading original:", err);
    }
  }

  return { payload, fileName, contentType, sizeBytes };
}

// ------------------------------------------------------------------------------
// Drawer
// ------------------------------------------------------------------------------

export interface TaskDetailDrawerProps {
  card: TaskCard | null;
  /** The board's lists — powers the Status select (list moves). */
  lists: TaskList[];
  onClose: () => void;
  onPatch: (cardId: string, patch: TaskCardPatchPayload) => Promise<void>;
  onDelete: (card: TaskCard) => Promise<void>;
  /** Subtask ops — TaskBoard stages optimistically and reverts + toasts. */
  onAddSubtask: (cardId: string, text: string) => Promise<void>;
  onToggleSubtask: (cardId: string, subtaskId: string, isDone: boolean) => Promise<void>;
  onDeleteSubtask: (cardId: string, subtaskId: string) => Promise<void>;
  /**
   * Attachment add — TaskBoard stages `staged` (client-generated optimistic id)
   * instantly, runs `upload` (compress → CDN → metadata) inside its guarded op
   * wrapper, swaps the created row in on success and reverts + toasts on
   * failure. Returns the server row, or null when the op failed.
   */
  onUploadAttachment: (
    cardId: string,
    staged: TaskAttachment,
    upload: () => Promise<TaskAttachment>
  ) => Promise<TaskAttachment | null>;
  onDeleteAttachment: (cardId: string, attachmentId: string) => Promise<void>;
}

export function TaskDetailDrawer({
  card,
  lists,
  onClose,
  onPatch,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onUploadAttachment,
  onDeleteAttachment,
}: TaskDetailDrawerProps) {
  const { getToken } = useAuth();
  const authToken = useCallback(async () => (await getToken()) || undefined, [getToken]);

  // Portal host: the drawer, backdrop and lightbox render into <body>. Root
  // cause for the old "small clipped panel stuck to the top-right corner": the
  // dashboard's page-transition wrapper keeps an animated `filter: blur(0px)`
  // on its root, and any filter value other than `none` makes that element the
  // containing block for position:fixed descendants — so the drawer's
  // inset-y-0 resolved against the auto-height page wrapper instead of the
  // viewport. Portalling to <body> restores true viewport-fixed geometry and
  // lifts the drawer above every page-level stacking context.
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot SSR gate: portals need document.body, which only exists client-side
    setPortalReady(true);
    return () => setPortalReady(false);
  }, []);

  const cardId = card?.id ?? null;
  const cardRef = useRef<TaskCard | null>(card);
  useEffect(() => {
    cardRef.current = card;
  }, [card]);

  // Local editable copies — synced only when switching cards so keystrokes
  // are never clobbered by background refreshes of the same card.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [dueDate, setDueDate] = useState("");

  // Transient UI state.
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [tagInputOpen, setTagInputOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [subtaskInputFocused, setSubtaskInputFocused] = useState(false);
  // Native dragover/drop hover state for the attachment drop zone.
  const [dragDepth, setDragDepth] = useState(0);
  // Per-optimistic-row upload phase (tempId → "compressing" | "uploading").
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgressState>>({});

  const subtaskInputRef = useRef<HTMLInputElement | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const linkInputRef = useRef<HTMLInputElement | null>(null);
  const dropZoneInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);

  // Projects (module-cached, one fetch per SPA session).
  const projects = useProjects();

  useEffect(() => {
    const c = cardRef.current;
    if (!c) return;
    setTitle(c.title);
    setDescription(c.description);
    setPriority(c.priority ?? "");
    setDueDate(c.due_date ?? "");
    setLightbox(null);
    setLinkOpen(false);
    setTagInputOpen(false);
    setTagDraft("");
    setSubtaskDraft("");
    setUploadProgress({});
  }, [cardId]);

  const patch = useCallback(
    (p: TaskCardPatchPayload) => {
      if (cardId) void onPatch(cardId, p);
    },
    [cardId, onPatch]
  );

  const commitTitle = useCallback(
    (value: string) => {
      const c = cardRef.current;
      if (!c) return;
      const trimmed = value.trim();
      if (!trimmed || trimmed === c.title) return;
      patch({ title: trimmed });
    },
    [patch]
  );

  // Debounced description autosave: 800ms after the last keystroke, or
  // immediately on blur / card switch / drawer close. The pending edit is
  // tracked against its card id so closing the drawer (card prop → null)
  // still flushes the last keystrokes.
  const descTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDescRef = useRef<{ cardId: string; value: string } | null>(null);
  const flushDescription = useCallback(() => {
    if (descTimerRef.current) {
      clearTimeout(descTimerRef.current);
      descTimerRef.current = null;
    }
    const pending = pendingDescRef.current;
    pendingDescRef.current = null;
    if (!pending) return;
    const c = cardRef.current;
    // Still mounted on the same card and server already has this value → no-op.
    if (c && c.id === pending.cardId && c.description === pending.value) return;
    void onPatch(pending.cardId, { description: pending.value });
  }, [onPatch]);
  const queueDescriptionSave = useCallback(
    (value: string) => {
      setDescription(value);
      if (cardId) pendingDescRef.current = { cardId, value };
      if (descTimerRef.current) clearTimeout(descTimerRef.current);
      descTimerRef.current = setTimeout(flushDescription, 800);
    },
    [cardId, flushDescription]
  );
  useEffect(() => {
    return () => {
      // Flush pending description edits when the drawer closes or card changes.
      if (descTimerRef.current) {
        clearTimeout(descTimerRef.current);
        descTimerRef.current = null;
      }
      const pending = pendingDescRef.current;
      pendingDescRef.current = null;
      if (pending) void onPatch(pending.cardId, { description: pending.value });
    };
  }, [cardId, onPatch]);

  // ---- Escape precedence -----------------------------------------------------
  // Transient UI (lightbox, link popover, tag input, focused subtask input)
  // pushes a closer onto a stack; Escape pops the top one, and only closes
  // the drawer when the stack is empty.
  const escapeStackRef = useRef<Array<() => void>>([]);
  const pushEscape = useCallback((closer: () => void) => {
    escapeStackRef.current.push(closer);
    return () => {
      const i = escapeStackRef.current.indexOf(closer);
      if (i !== -1) escapeStackRef.current.splice(i, 1);
    };
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    return pushEscape(() => setLightbox(null));
  }, [lightbox, pushEscape]);
  useEffect(() => {
    if (!linkOpen) return;
    return pushEscape(() => setLinkOpen(false));
  }, [linkOpen, pushEscape]);
  useEffect(() => {
    if (!tagInputOpen) return;
    return pushEscape(() => {
      setTagInputOpen(false);
      setTagDraft("");
    });
  }, [tagInputOpen, pushEscape]);
  useEffect(() => {
    if (!subtaskInputFocused) return;
    return pushEscape(() => {
      setSubtaskDraft("");
      subtaskInputRef.current?.blur();
    });
  }, [subtaskInputFocused, pushEscape]);

  // Close on Escape (top of the stack wins).
  useEffect(() => {
    if (!cardId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const closer = escapeStackRef.current[escapeStackRef.current.length - 1];
      if (closer) {
        closer();
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cardId, onClose]);

  const handleDelete = async () => {
    const c = cardRef.current;
    if (!c) return;
    const ok = await confirmDialog({
      message: `Delete "${c.title}"? This cannot be undone.`,
      danger: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await onDelete(c);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete card");
    }
  };

  // ---- Tags ------------------------------------------------------------------
  const commitTag = (raw: string) => {
    const c = cardRef.current;
    if (!c) return;
    const value = raw.trim().slice(0, TAG_MAX_LENGTH);
    setTagDraft("");
    setTagInputOpen(false);
    if (!value) return;
    if (c.tags.some((t) => t.toLowerCase() === value.toLowerCase())) return; // duplicate
    if (c.tags.length >= MAX_TAGS) {
      toast.error(`Up to ${MAX_TAGS} tags per card`);
      return;
    }
    patch({ tags: [...c.tags, value] });
  };

  const removeTag = (tag: string) => {
    const c = cardRef.current;
    if (!c) return;
    patch({ tags: c.tags.filter((t) => t !== tag) });
  };

  // ---- Subtasks --------------------------------------------------------------
  // Rendered straight from the card prop; TaskBoard owns the optimistic
  // add/toggle/delete (stage → API → swap/revert + toast).
  const subtasks = useMemo(() => card?.subtasks ?? [], [card?.subtasks]);
  const sortedSubtasks = useMemo(
    () => [...subtasks].sort((a, b) => a.position - b.position),
    [subtasks]
  );
  const doneSubtasks = sortedSubtasks.filter((s) => s.is_done).length;

  const addSubtask = () => {
    const c = cardRef.current;
    const value = subtaskDraft.trim();
    if (!c || !value) return;
    setSubtaskDraft("");
    void onAddSubtask(c.id, value);
  };

  const toggleSubtask = (subtask: TaskSubtask) => {
    const c = cardRef.current;
    if (!c || isOptimisticId(subtask.id)) return; // still being created server-side
    void onToggleSubtask(c.id, subtask.id, !subtask.is_done);
  };

  const removeSubtask = async (subtask: TaskSubtask) => {
    const c = cardRef.current;
    if (!c || isOptimisticId(subtask.id)) return;
    const ok = await confirmDialog({
      message: `Delete subtask "${subtask.text}"?`,
      danger: true,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    void onDeleteSubtask(c.id, subtask.id);
  };

  // ---- Attachments -----------------------------------------------------------
  const attachments = useMemo(() => card?.attachments ?? [], [card?.attachments]);
  const imageAttachments = useMemo(
    () => attachments.filter((a) => a.kind === "image"),
    [attachments]
  );
  const otherAttachments = useMemo(
    () => attachments.filter((a) => a.kind !== "image"),
    [attachments]
  );

  const setProgress = (tempId: string, state: UploadProgressState) => {
    setUploadProgress((prev) => ({ ...prev, [tempId]: state }));
  };
  const clearProgress = (tempId: string) => {
    setUploadProgress((prev) => {
      if (!(tempId in prev)) return prev;
      const rest = { ...prev };
      delete rest[tempId];
      return rest;
    });
  };

  // Validates a picked/dropped file against the backend allowlist.
  const validateFile = (file: File): TaskAttachmentKind | null => {
    const type = (file.type || "").toLowerCase();
    if (type && !ALLOWED_CONTENT_TYPES.has(type)) {
      toast.error(`"${file.name}" is not a supported file type`);
      return null;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`"${file.name}" is larger than 10 MB`);
      return null;
    }
    return type.startsWith("image/") ? "image" : "document";
  };

  // Full per-file pipeline: optimistic placeholder (TaskBoard) → compress →
  // CDN upload → attachment metadata → placeholder swapped for server truth
  // (or removed + toasted on failure).
  const uploadOneFile = async (file: File, kind: TaskAttachmentKind, ownerCardId: string, token?: string) => {
    const tempId = `optimistic-att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const staged: TaskAttachment = {
      id: tempId,
      card_id: ownerCardId,
      kind,
      url: null,
      file_key: null,
      file_name: file.name,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      created_at: new Date().toISOString(),
    };
    setProgress(tempId, "compressing");
    try {
      const created = await onUploadAttachment(ownerCardId, staged, async () => {
        const prepared = await prepareFileForUpload(file, kind);
        setProgress(tempId, "uploading");
        const uploaded = await uploadFileToCloudinary(prepared.payload, "uploads", token, prepared.fileName);
        return createTaskAttachment(
          ownerCardId,
          {
            kind,
            file_key: fileKeyFromCdnUrl(uploaded.url),
            file_name: prepared.fileName,
            content_type: prepared.contentType,
            size_bytes: prepared.sizeBytes,
          },
          token
        );
      });
      // Warm the URL cache so the thumbnail paints without a user-visible fetch.
      if (created && created.kind === "image") {
        void loadAttachmentFileRefs(created.id, token).catch(() => {
          // Tile will show "preview unavailable" and retry next mount.
        });
      }
    } catch (err) {
      // Defensive: onUploadAttachment reverts + toasts internally via TaskBoard's
      // op wrapper and resolves to null on failure, so this only fires on a
      // genuinely unexpected error — drop the placeholder, never an unhandled
      // rejection.
      logHandledError("Attachment upload crashed:", err);
      void onDeleteAttachment(ownerCardId, tempId);
    } finally {
      clearProgress(tempId);
    }
  };

  const handleFiles = (files: File[]) => {
    const c = cardRef.current;
    if (!c || files.length === 0) return;
    const valid: { file: File; kind: TaskAttachmentKind }[] = [];
    for (const file of files) {
      const kind = validateFile(file);
      if (kind) valid.push({ file, kind });
    }
    if (valid.length === 0) return;
    void (async () => {
      const token = await authToken();
      await Promise.all(valid.map(({ file, kind }) => uploadOneFile(file, kind, c.id, token)));
    })();
  };

  const addLink = async (rawUrl: string): Promise<boolean> => {
    const c = cardRef.current;
    if (!c) return false;
    const url = rawUrl.trim();
    if (!url || !isHttpUrl(url)) {
      toast.error("Enter a valid http(s):// URL");
      return false;
    }
    const host = new URL(url).hostname;
    const staged: TaskAttachment = {
      id: `optimistic-att-${Date.now()}`,
      card_id: c.id,
      kind: "link",
      url,
      file_key: null,
      file_name: host,
      content_type: null,
      size_bytes: null,
      created_at: new Date().toISOString(),
    };
    const created = await onUploadAttachment(c.id, staged, async () =>
      createTaskAttachment(c.id, { kind: "link", url, file_name: host }, await authToken())
    );
    return created !== null;
  };

  const submitLink = async () => {
    const value = linkInputRef.current?.value ?? "";
    const ok = await addLink(value);
    if (ok) {
      if (linkInputRef.current) linkInputRef.current.value = "";
      setLinkOpen(false);
    }
  };

  const removeAttachment = async (attachment: TaskAttachment) => {
    const c = cardRef.current;
    if (!c) return;
    if (isOptimisticId(attachment.id)) {
      // Still uploading — cancel the placeholder outright (no confirm).
      void onDeleteAttachment(c.id, attachment.id);
      return;
    }
    const ok = await confirmDialog({
      message: `Remove "${attachment.file_name}" from this card?`,
      danger: true,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    void onDeleteAttachment(c.id, attachment.id);
  };

  // ---- Derived display values -------------------------------------------------
  const completed = card?.completed ?? false;
  const due = card?.due_date ?? null;
  const projectId = card?.project_id ?? "";
  const projectOptions = projects ?? [];

  // Select options for Experience Tab style underline dropdowns
  const statusOptions = useMemo(
    () => lists.map((l) => ({ value: l.id, label: l.name })),
    [lists]
  );

  const priorityDropdownOptions = useMemo(
    () => [
      { value: "", label: "No priority" },
      { value: "urgent", label: "Urgent" },
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
      { value: "low", label: "Low" },
    ],
    []
  );

  const projectDropdownOptions = useMemo(
    () => [
      { value: "", label: "No project" },
      ...projectOptions.map((p) => ({
        value: p.id,
        label: p.title,
      })),
    ],
    [projectOptions]
  );

  const sectionIconButton =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-[11px] font-medium text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors cursor-pointer";
  const iconButton =
    "p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer";

  if (!portalReady) return null;

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {card && (
          <>
            <div className="fixed inset-0 z-[70] overflow-hidden flex justify-end">
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/80 backdrop-blur-xs cursor-pointer"
              aria-hidden
            />
            <motion.aside
              key="drawer-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Task details"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative z-10 w-full sm:max-w-2xl bg-[#111113] border-l border-neutral-800/80 shadow-2xl flex flex-col justify-between h-full overflow-hidden"
            >
              {/* Header: title + completed checkbox + actions */}
              <div className="flex items-center justify-between p-6 sm:p-7 border-b border-neutral-800/80 shrink-0">
                <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-4">
                  <button
                    type="button"
                    onClick={() => patch({ completed: !completed })}
                    aria-label={completed ? "Mark not done" : "Mark done"}
                    title={completed ? "Mark not done" : "Mark done"}
                    className={cn(
                      "w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                      completed
                        ? "bg-accent border-accent text-accent-fg"
                        : "border-neutral-700 bg-neutral-900/60 text-transparent hover:border-accent"
                    )}
                  >
                    <motion.span
                      initial={false}
                      animate={{ scale: completed ? 1 : 0.4, opacity: completed ? 1 : 0 }}
                      transition={{ duration: 0.14 }}
                      className="flex"
                    >
                      <Check className="w-4 h-4" strokeWidth={3} />
                    </motion.span>
                  </button>
                  <input
                    key={cardId ?? "no-card"}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={(e) => commitTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        commitTitle((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    maxLength={300}
                    placeholder="Task title..."
                    className={cn(
                      "flex-1 min-w-0 bg-transparent border-0 border-b border-transparent focus:border-amber-500 py-1 text-xl sm:text-2xl font-bold text-white tracking-tight focus:outline-none transition-colors",
                      completed && "line-through text-neutral-400"
                    )}
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    title="Delete task"
                    aria-label="Delete task"
                    className="w-8 h-8 rounded-full hover:bg-red-500/10 text-neutral-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    title="Close"
                    aria-label="Close"
                    className="w-8 h-8 rounded-full bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body: Experience Tab style inputs & sections */}
              <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {/* Status & Priority */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                  <ProfileField label="Status" required>
                    <UnderlineSelect
                      options={statusOptions}
                      value={card.list_id}
                      placeholder="Select status..."
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v && v !== card.list_id) patch({ list_id: v });
                      }}
                    />
                  </ProfileField>

                  <ProfileField label="Priority">
                    <UnderlineSelect
                      options={priorityDropdownOptions}
                      value={priority}
                      placeholder="Select priority..."
                      onChange={(e) => {
                        const v = e.target.value as TaskPriority | "";
                        setPriority(v);
                        patch({ priority: v === "" ? null : v });
                      }}
                    />
                  </ProfileField>
                </div>

                {/* Due Date & Project */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                  <ProfileField label="Due Date">
                    <TaskDatePicker
                      value={dueDate}
                      onChange={(val) => {
                        setDueDate(val);
                        patch({ due_date: val || null });
                      }}
                      placeholder="dd / mm / yyyy"
                    />
                  </ProfileField>

                  <ProfileField label="Project">
                    <UnderlineSelect
                      options={projectDropdownOptions}
                      value={projectId}
                      placeholder="No project"
                      onChange={(e) => {
                        const v = e.target.value;
                        patch({ project_id: v === "" ? null : v });
                      }}
                    />
                  </ProfileField>
                </div>

                {/* Description */}
                <ProfileField label="Description">
                  <UnderlineTextarea
                    rows={3}
                    value={description}
                    onChange={(e) => queueDescriptionSave(e.target.value)}
                    onBlur={() => flushDescription()}
                    placeholder="Describe the task in detail..."
                  />
                </ProfileField>

                {/* TAGS */}
                <section aria-label="Tags">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
                    Tags
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <AnimatePresence initial={false}>
                      {card.tags.map((tag) => (
                        <motion.span
                          key={tag}
                          layout
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ duration: 0.15 }}
                          className="group/tag inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-surface border border-line text-[11px] font-medium text-fg max-w-full hover:border-line-strong transition-colors"
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: tagDotColor(tag) }}
                            aria-hidden
                          />
                          <span className="truncate max-w-[140px]">{tag}</span>
                          <button
                            onClick={() => removeTag(tag)}
                            aria-label={`Remove tag ${tag}`}
                            title="Remove tag"
                            className="opacity-0 group-hover/tag:opacity-100 focus-visible:opacity-100 p-0.5 rounded-full text-faint hover:text-danger hover:bg-danger/10 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
                          >
                            <X className="w-2.5 h-2.5" strokeWidth={2.5} />
                          </button>
                        </motion.span>
                      ))}
                    </AnimatePresence>

                    {tagInputOpen ? (
                      <input
                        ref={tagInputRef}
                        autoFocus
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitTag(tagDraft);
                          }
                        }}
                        onBlur={() => {
                          setTagInputOpen(false);
                          setTagDraft("");
                        }}
                        maxLength={TAG_MAX_LENGTH}
                        placeholder="Tag name…"
                        aria-label="New tag name"
                        className="h-7 w-28 px-2.5 rounded-full bg-surface border border-line text-[11px] text-fg placeholder:text-faint focus:outline-none focus:border-accent"
                      />
                    ) : (
                      <button
                        onClick={() => setTagInputOpen(true)}
                        aria-label="Add tag"
                        title="Add tag"
                        className="w-7 h-7 rounded-full border border-dashed border-line-strong text-muted hover:text-accent hover:border-accent/60 flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </section>

                <div className="h-px bg-line/60" role="presentation" />

                {/* SUBTASKS */}
                <section aria-label="Subtasks">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                        Subtasks
                      </span>
                      <span className="text-[10px] font-mono text-muted px-1.5 py-px rounded bg-surface border border-line/60">
                        {sortedSubtasks.length}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted shrink-0">
                      {doneSubtasks} of {sortedSubtasks.length} done
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <AnimatePresence initial={false} mode="popLayout">
                      {sortedSubtasks.map((subtask) => (
                        <motion.div
                          key={subtask.id}
                          layout="position"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.16 }}
                          className="group/sub flex items-center gap-2.5 py-1"
                        >
                          <button
                            onClick={() => toggleSubtask(subtask)}
                            aria-label={subtask.is_done ? `Reopen "${subtask.text}"` : `Complete "${subtask.text}"`}
                            className={cn(
                              "w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
                              subtask.is_done
                                ? "bg-accent border-accent text-accent-fg"
                                : "border-line-strong text-transparent hover:border-accent"
                            )}
                          >
                            <motion.span
                              initial={false}
                              animate={{ scale: subtask.is_done ? 1 : 0.4, opacity: subtask.is_done ? 1 : 0 }}
                              transition={{ duration: 0.14 }}
                              className="flex"
                            >
                              <Check className="w-3 h-3" strokeWidth={3} />
                            </motion.span>
                          </button>
                          <span
                            className={cn(
                              "flex-1 min-w-0 text-xs leading-snug break-words",
                              subtask.is_done ? "line-through text-muted" : "text-fg"
                            )}
                          >
                            {subtask.text}
                          </span>
                          {isOptimisticId(subtask.id) && (
                            <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0" aria-hidden />
                          )}
                          <button
                            onClick={() => void removeSubtask(subtask)}
                            aria-label={`Delete subtask "${subtask.text}"`}
                            title="Delete subtask"
                            className="opacity-0 group-hover/sub:opacity-100 focus-visible:opacity-100 p-1 rounded-md text-muted hover:text-danger transition-opacity shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Add row */}
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      ref={subtaskInputRef}
                      value={subtaskDraft}
                      onChange={(e) => setSubtaskDraft(e.target.value)}
                      onFocus={() => setSubtaskInputFocused(true)}
                      onBlur={() => setSubtaskInputFocused(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSubtask();
                        }
                      }}
                      maxLength={500}
                      placeholder="Add a subtask..."
                      aria-label="Add a subtask"
                      className="flex-1 min-w-0 h-8 px-2.5 rounded-lg bg-surface border border-line text-xs text-fg placeholder:text-faint focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={addSubtask}
                      disabled={!subtaskDraft.trim()}
                      aria-label="Add subtask"
                      title="Add subtask"
                      className="w-8 h-8 rounded-full bg-accent hover:bg-accent-hi text-accent-fg flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </section>

                <div className="h-px bg-line/60" role="presentation" />

                {/* ATTACHMENTS */}
                <section aria-label="Attachments">
                  <div className="flex items-center gap-2 mb-2">
                    <Paperclip className="w-3.5 h-3.5 text-muted" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Attachments
                    </span>
                    <span className="text-[10px] font-mono text-muted px-1.5 py-px rounded bg-surface border border-line/60">
                      {attachments.length}
                    </span>
                  </div>

                  {/* Drop zone */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Upload attachments"
                    onClick={() => dropZoneInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        dropZoneInputRef.current?.click();
                      }
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDragDepth((d) => d + 1);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDragLeave={() => setDragDepth((d) => Math.max(0, d - 1))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragDepth(0);
                      handleFiles(Array.from(e.dataTransfer.files));
                    }}
                    className={cn(
                      "rounded-xl border border-dashed px-4 py-5 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
                      dragDepth > 0
                        ? "border-accent bg-accent/10"
                        : "border-line-strong/70 hover:border-accent/60 hover:bg-surface/60"
                    )}
                  >
                    <Upload className="w-4 h-4 text-muted mx-auto mb-1.5" />
                    <p className="text-xs text-muted">
                      Click to upload or drag and drop files
                    </p>
                    <p className="text-[10px] text-faint mt-0.5">
                      Supports images, PDFs, documents, or text files
                    </p>
                  </div>
                  <input
                    ref={dropZoneInputRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => {
                      handleFiles(Array.from(e.target.files ?? []));
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={imageInputRef}
                    type="file"
                    multiple
                    hidden
                    accept={IMAGE_INPUT_ACCEPT}
                    onChange={(e) => {
                      handleFiles(Array.from(e.target.files ?? []));
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={documentInputRef}
                    type="file"
                    multiple
                    hidden
                    accept={DOCUMENT_INPUT_ACCEPT}
                    onChange={(e) => {
                      handleFiles(Array.from(e.target.files ?? []));
                      e.target.value = "";
                    }}
                  />

                  {/* Kind buttons */}
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <button
                      onClick={() => setLinkOpen((o) => !o)}
                      aria-expanded={linkOpen}
                      className={sectionIconButton}
                    >
                      <LinkIcon className="w-3.5 h-3.5" /> Link
                    </button>
                    <button onClick={() => imageInputRef.current?.click()} className={sectionIconButton}>
                      <ImageIcon className="w-3.5 h-3.5" /> Image
                    </button>
                    <button onClick={() => documentInputRef.current?.click()} className={sectionIconButton}>
                      <FileText className="w-3.5 h-3.5" /> Document
                    </button>
                  </div>

                  {/* Link URL popover */}
                  <AnimatePresence initial={false}>
                    {linkOpen && (
                      <motion.div
                        key="link-popover"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.16 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-2 mt-2.5">
                          <input
                            ref={linkInputRef}
                            autoFocus
                            type="url"
                            inputMode="url"
                            placeholder="https://example.com/page"
                            aria-label="Link URL"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void submitLink();
                              }
                            }}
                            className="flex-1 min-w-0 h-8 px-2.5 rounded-lg bg-surface border border-line text-xs text-fg placeholder:text-faint focus:outline-none focus:border-accent"
                          />
                          <button
                            onClick={() => void submitLink()}
                            aria-label="Save link"
                            title="Save link"
                            className={cn(iconButton, "text-accent hover:text-accent")}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setLinkOpen(false)} aria-label="Cancel link" title="Cancel" className={iconButton}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Image thumbnails */}
                  {imageAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <AnimatePresence initial={false} mode="popLayout">
                        {imageAttachments.map((attachment) => (
                          <motion.div
                            key={attachment.id}
                            layout="position"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.16 }}
                            className="relative"
                          >
                            <ImageAttachmentTile
                              attachment={attachment}
                              progress={uploadProgress[attachment.id]}
                              onOpen={(refs) =>
                                setLightbox({ url: refs.url, name: attachment.file_name })
                              }
                              onRemove={() => void removeAttachment(attachment)}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Links + documents */}
                  {otherAttachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <AnimatePresence initial={false} mode="popLayout">
                        {otherAttachments.map((attachment) => (
                          <motion.div
                            key={attachment.id}
                            layout="position"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97 }}
                            transition={{ duration: 0.16 }}
                          >
                            <FileAttachmentRow
                              attachment={attachment}
                              progress={uploadProgress[attachment.id]}
                              onRemove={() => void removeAttachment(attachment)}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </section>
              </div>

            </motion.aside>
          </div>

            {/* Lightbox — outside the transformed aside so it covers the viewport */}
            <AnimatePresence>
              {lightbox && (
                <motion.div
                  key="attachment-lightbox"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`Image preview: ${lightbox.name}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setLightbox(null)}
                  className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
                >
                  <motion.img
                    key={lightbox.url}
                    src={lightbox.url}
                    alt={lightbox.name}
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.96, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    draggable={false}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  />
                  <button
                    onClick={() => setLightbox(null)}
                    aria-label="Close preview"
                    title="Close (Esc)"
                    className="absolute top-4 right-4 p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body
  );
}

// ------------------------------------------------------------------------------
// Attachment sub-components
// ------------------------------------------------------------------------------

type FileRefsState = { refs: AttachmentFileRefs | null; failed: boolean };

function initialStateFor(attachment: TaskAttachment): FileRefsState {
  if (attachment.kind === "link") {
    return { refs: { url: attachment.url ?? "#", thumb_url: null }, failed: false };
  }
  const cached = attachmentFileCache.get(attachment.id);
  if (cached) return { refs: cached, failed: false };
  return { refs: null, failed: false };
}

// Resolves the CDN URL(s) for one attachment: links pass their stored URL
// through, files go through the (cached, deduped) /file endpoint. Rows are
// keyed by attachment id, so the initializer picks up warm cache instantly.
function useAttachmentFileRefs(attachment: TaskAttachment): FileRefsState {
  const { getToken } = useAuth();
  const [state, setState] = useState<FileRefsState>(() => initialStateFor(attachment));

  useEffect(() => {
    if (state.refs || state.failed) return;
    if (attachment.kind === "link" || isOptimisticId(attachment.id)) return;
    let cancelled = false;
    (async () => {
      try {
        const token = (await getToken()) || undefined;
        const refs = await loadAttachmentFileRefs(attachment.id, token);
        if (!cancelled) setState({ refs, failed: false });
      } catch (err) {
        // Storage unconfigured / unreachable — graceful tile, never a crash.
        logHandledError("Attachment preview unavailable:", err);
        if (!cancelled) setState({ refs: null, failed: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachment.id, attachment.kind, state.refs, state.failed, getToken]);

  return state;
}

function ImageAttachmentTile({
  attachment,
  progress,
  onOpen,
  onRemove,
}: {
  attachment: TaskAttachment;
  progress?: UploadProgressState;
  onOpen: (refs: AttachmentFileRefs) => void;
  onRemove: () => void;
}) {
  const uploading = isOptimisticId(attachment.id);
  const { refs, failed } = useAttachmentFileRefs(attachment);
  const thumbSrc = refs?.thumb_url ?? refs?.url ?? null;
  // Mount-time snapshot: warm-cache remounts (thumbsLoaded) skip blur-up.
  // Cold resolutions start blurred and flip via the img's onLoad below —
  // no state sync effect needed.
  const [loaded, setLoaded] = useState(() => (thumbSrc ? thumbsLoaded.has(thumbSrc) : false));

  return (
    <div className="w-[96px] h-[96px] group/tile">
      {uploading ? (
        <div
          className="w-full h-full rounded-xl border border-line bg-surface flex flex-col items-center justify-center gap-1.5"
          title={`${progress === "compressing" ? "Compressing" : "Uploading"} ${attachment.file_name}…`}
        >
          <Loader2 className="w-4 h-4 text-accent animate-spin" />
          <span className="text-[9px] text-faint px-1 truncate max-w-full">
            {progress === "compressing" ? "Compressing…" : "Uploading…"}
          </span>
        </div>
      ) : failed || !thumbSrc ? (
        <div className="w-full h-full rounded-xl border border-line bg-surface flex flex-col items-center justify-center gap-1 px-1.5 text-center">
          <ImageIcon className="w-4 h-4 text-faint shrink-0" />
          <span className="text-[9px] text-faint leading-tight line-clamp-2 break-all">
            {attachment.file_name}
          </span>
          <span className="text-[8px] text-faint/80">Preview unavailable</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(refs as AttachmentFileRefs)}
          aria-label={`Open image ${attachment.file_name}`}
          className="relative block w-full h-full rounded-xl overflow-hidden border border-line bg-surface cursor-zoom-in group-hover/tile:border-line-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          {/* Blur-up: a soft accent block shows while the w_400 thumb decodes */}
          {!loaded && <span className="absolute inset-0 bg-accent-soft/50 blur-md" aria-hidden />}
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary Cloudinary CDN URLs, next/image has no configured domains */}
          <img
            src={thumbSrc}
            alt={attachment.file_name}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => {
              thumbsLoaded.add(thumbSrc);
              setLoaded(true);
            }}
            className={cn(
              "w-full h-full object-cover transition-[opacity,filter] duration-300",
              loaded ? "opacity-100 blur-0" : "opacity-0 blur-md"
            )}
          />
        </button>
      )}
      {!uploading && (
        <button
          onClick={onRemove}
          aria-label={`Remove attachment ${attachment.file_name}`}
          title="Remove attachment"
          className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full bg-card border border-line-strong text-muted hover:text-danger hover:border-danger/50 flex items-center justify-center opacity-0 group-hover/tile:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          <X className="w-3 h-3" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

function FileAttachmentRow({
  attachment,
  progress,
  onRemove,
}: {
  attachment: TaskAttachment;
  progress?: UploadProgressState;
  onRemove: () => void;
}) {
  const isLink = attachment.kind === "link";
  const { refs, failed } = useAttachmentFileRefs(attachment);
  const size = formatBytes(attachment.size_bytes);
  const uploading = isOptimisticId(attachment.id);

  const open = () => {
    if (!refs?.url) return;
    window.open(refs.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="group/file flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-surface/60 border border-line/70 hover:border-line-strong transition-colors">
      {isLink ? (
        <LinkIcon className="w-4 h-4 text-accent shrink-0" aria-hidden />
      ) : (
        <FileText className="w-4 h-4 text-muted shrink-0" aria-hidden />
      )}
      <div className="flex-1 min-w-0">
        <span className="block text-xs text-fg truncate" title={attachment.file_name}>
          {attachment.file_name}
        </span>
        <span className="block text-[10px] font-mono text-faint truncate">
          {uploading
            ? progress === "compressing"
              ? "Compressing…"
              : "Uploading…"
            : failed && !isLink
              ? "Preview unavailable"
              : isLink
                ? refs?.url ?? attachment.url ?? ""
                : [size, attachment.content_type].filter(Boolean).join(" · ")}
        </span>
      </div>
      {uploading && (
        <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0" aria-hidden />
      )}
      {!uploading && refs?.url && (
        <button
          onClick={() => (isLink ? window.open(refs.url as string, "_blank", "noopener,noreferrer") : open())}
          aria-label={isLink ? `Open ${attachment.file_name} in a new tab` : `Download ${attachment.file_name}`}
          title={isLink ? "Open link" : "Open file"}
          className={cn(
            "p-1 rounded-md text-faint hover:text-fg hover:bg-surface transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
            "opacity-0 group-hover/file:opacity-100 focus-visible:opacity-100"
          )}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        onClick={onRemove}
        aria-label={`Remove attachment ${attachment.file_name}`}
        title="Remove attachment"
        className="p-1 rounded-md text-muted hover:text-danger transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
