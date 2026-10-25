"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import {
  X,
  CalendarDays,
  Clock,
  Video,
  Trash2,
  Users,
  Briefcase,
  Receipt,
  ArrowUpRight,
  Loader2,
} from "@/components/animated-icons";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import {
  deleteCalendarEvent,
  type CalendarFeedItem,
} from "@/lib/api";
import { humanizeCalendarTitle } from "@/lib/humanize";

export function CalendarEventDetailModal({
  item,
  onClose,
  onDeleted,
}: {
  item: CalendarFeedItem;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const { getToken } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const start = new Date(item.start_time);
  const end = new Date(item.end_time);

  const handleDelete = async () => {
    const friendlyTitle = humanizeCalendarTitle(item.title);
    const ok = await confirmDialog({
      title: "Delete event",
      message: `Are you sure you want to remove "${friendlyTitle}" from your schedule?`,
      confirmLabel: "Delete Event",
      danger: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const token = (await getToken()) || undefined;
      await deleteCalendarEvent(item.id, token);
      toast.success("Event deleted from calendar");
      if (onDeleted) onDeleted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setDeleting(false);
    }
  };

  const typeConfig: Record<string, { label: string; bg: string; dot: string }> = {
    meeting: { label: "Meeting", bg: "bg-sky-500/10 text-sky-400 border-sky-500/20", dot: "bg-sky-500" },
    client_work: { label: "Client Work", bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-500" },
    deadline: { label: "Deadline", bg: "bg-rose-500/10 text-rose-400 border-rose-500/20", dot: "bg-rose-500" },
    personal: { label: "Personal", bg: "bg-purple-500/10 text-purple-400 border-purple-500/20", dot: "bg-purple-500" },
  };

  const style = typeConfig[item.event_type] || {
    label: item.event_type.replace("_", " "),
    bg: "bg-surface text-fg border-line",
    dot: "bg-accent",
  };

  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const durationText = item.is_all_day
    ? "Full Day"
    : diffHours > 0 && diffMinutes > 0
      ? `${diffHours}h ${diffMinutes}m`
      : diffHours > 0
        ? `${diffHours} hr${diffHours > 1 ? "s" : ""}`
        : `${diffMinutes} mins`;

  const getFeatureTarget = () => {
    if (item.project_id) {
      return {
        href: `/dashboard/projects/${item.project_id}`,
        label: "Go to Project",
        Icon: Briefcase,
      };
    }
    if (item.source === "booking") {
      return {
        href: "/dashboard/booking",
        label: "Go to Bookings",
        Icon: CalendarDays,
      };
    }
    if (item.source === "invoice") {
      return {
        href: "/dashboard/projects?tab=invoices",
        label: "Go to Invoices",
        Icon: Receipt,
      };
    }
    if (item.client_name) {
      return {
        href: "/dashboard/clients",
        label: "Go to Client",
        Icon: Users,
      };
    }
    if (item.event_type === "client_work" || item.event_type === "deadline") {
      return {
        href: "/dashboard/projects",
        label: "Go to Projects",
        Icon: Briefcase,
      };
    }
    return {
      href: "/dashboard/calendar",
      label: "Go to Calendar",
      Icon: CalendarDays,
    };
  };

  const featureTarget = getFeatureTarget();

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-card border border-line rounded-2xl p-6 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-line/60">
          <div className="space-y-1.5 min-w-0">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${style.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {style.label}
              {item.source !== "local" ? ` · ${item.source}` : ""}
            </span>
            <h3 className="font-bold text-fg text-lg tracking-tight truncate">
              {humanizeCalendarTitle(item.title)}
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {item.source === "local" && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                title="Delete Event"
                aria-label="Delete Event"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin text-danger" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface active:scale-95 transition-all cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Structured Info Cards */}
        <div className="mt-4 space-y-3 text-xs">
          {/* Date & Time */}
          <div className="p-3.5 rounded-xl bg-surface/50 border border-line/70 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-fg font-medium">
                <CalendarDays className="w-3.5 h-3.5 text-accent shrink-0" />
                <span>
                  {start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface border border-line text-muted">
                {durationText}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted pl-5.5">
              <Clock className="w-3 h-3 text-muted shrink-0" />
              <span>
                {item.is_all_day
                  ? "All Day Event"
                  : `${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
              </span>
            </div>
          </div>

          {/* Client & Project Info */}
          {(item.client_name || item.project_id) && (
            <div className="p-3 rounded-xl bg-surface/50 border border-line/70 space-y-2">
              {item.client_name && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-muted">
                    <Users className="w-3.5 h-3.5 text-info shrink-0" />
                    <span>Client:</span>
                  </div>
                  <Link
                    href="/dashboard/clients"
                    className="text-fg hover:text-accent font-semibold transition-colors truncate"
                  >
                    {item.client_name}
                  </Link>
                </div>
              )}

              {item.project_id && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-muted">
                    <Briefcase className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span>Project:</span>
                  </div>
                  <Link
                    href={`/dashboard/projects/${item.project_id}`}
                    className="text-fg hover:text-accent font-semibold transition-colors truncate"
                  >
                    View Project
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div className="p-3 rounded-xl bg-surface/50 border border-line/70 space-y-1">
              <p className="text-[11px] font-semibold text-fg/80">Notes</p>
              <p className="text-muted leading-relaxed whitespace-pre-wrap">{item.description}</p>
            </div>
          )}
        </div>

        {/* Meeting Join Button */}
        {item.meeting_link && (
          <div className="mt-4">
            <a
              href={item.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-9 rounded-xl bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span>Join Meeting Now</span>
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-line/60 flex items-center justify-between gap-3">
          <Link
            href={featureTarget.href}
            onClick={onClose}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs transition-all active:scale-[0.97] shadow-xs cursor-pointer group"
          >
            <featureTarget.Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{featureTarget.label}</span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-line bg-surface/60 hover:bg-surface text-xs font-semibold text-fg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
