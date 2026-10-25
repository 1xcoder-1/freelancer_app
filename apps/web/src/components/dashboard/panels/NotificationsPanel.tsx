"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  CheckCheck,
  DollarSign,
  AlertTriangle,
  Eye,
  FileSignature,
  Ban,
  Quote,
  Send,
  Trash2,
  RefreshCw,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterPill, PageHeader } from "@/components/dashboard/patterns";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type NotificationItem,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { useWorkspaceCurrency } from "@/hooks/use-workspace-currency";
import { humanizeNotificationTitle, humanizeNotificationBody } from "@/lib/humanize";
import { confirmDialog } from "@/components/common/ConfirmDialog";

// Each producer in the API writes a dotted `kind`; the inbox gives it a glyph
// and a tint so a scan of the feed reads at a glance.
const KIND_META: Record<string, { icon: React.ElementType; tint: string; label: string }> = {
  "invoice.paid": { icon: DollarSign, tint: "text-ok", label: "Payment" },
  "invoice.overdue": { icon: AlertTriangle, tint: "text-danger", label: "Invoice" },
  "invoice.reminder": { icon: Send, tint: "text-warn", label: "Reminder" },
  "contract.viewed": { icon: Eye, tint: "text-info", label: "Contract" },
  "contract.signed": { icon: FileSignature, tint: "text-ok", label: "Contract" },
  "contract.declined": { icon: Ban, tint: "text-danger", label: "Contract" },
  "testimonial.submitted": { icon: Quote, tint: "text-violet", label: "Testimonial" },
};

const fallbackMeta = { icon: MessageSquare, tint: "text-muted", label: "Update" };

function timeAgo(iso: string): string {
  const then = new Date(iso.endsWith("Z") ? iso : `${iso}Z`).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso.endsWith("Z") ? iso : `${iso}Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Timestamps are stored naive UTC, so day buckets are cut on the UTC calendar
// — otherwise a row written at 23:50 UTC would jump between "Today" and
// "Yesterday" depending on the viewer's offset.
const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

function dayLabel(iso: string): string {
  const then = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  const back = Math.round((utcDay(new Date()) - utcDay(then)) / 86_400_000);
  if (back <= 0) return "Today";
  if (back === 1) return "Yesterday";
  if (back < 7) return then.toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function groupByDay(items: NotificationItem[]): { label: string; items: NotificationItem[] }[] {
  const groups: { label: string; items: NotificationItem[] }[] = [];
  for (const n of items) {
    const label = dayLabel(n.occurred_at);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }
  return groups;
}

export function NotificationsPanel() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { currency } = useWorkspaceCurrency();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // The SSE stream (use-live-notifications) invalidates this cache key the
  // moment a producer writes, so updates arrive instantly; the poll is just
  // the safety net for a dropped connection, hence the lazy cadence.
  const { data: feedData, loading, refresh: loadData } = useApiData<NotificationItem[]>(
    "notifications:feed",
    async (token) => getNotifications(false, token),
    { reportContext: "inbox", pollMs: 60_000 }
  );

  const notifications = useMemo(() => feedData ?? [], [feedData]);
  const unread = useMemo(() => notifications.filter((n) => !n.is_read), [notifications]);
  const filtered = onlyUnread ? unread : notifications;
  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  const refreshFeed = async () => {
    invalidateCache("notifications:feed");
    invalidateCache("notifications:unread");
    await loadData();
  };

  const open = async (n: NotificationItem) => {
    setBusyId(n.id);
    try {
      const token = (await getToken()) || undefined;
      if (!n.is_read) await markNotificationRead(n.id, token);
      await refreshFeed();
      if (n.link) router.push(n.link);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open this notification");
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (n: NotificationItem) => {
    const ok = await confirmDialog({
      title: "Dismiss notification",
      message: "Removes this row from your inbox. The underlying record is untouched.",
      confirmLabel: "Dismiss",
      danger: true,
    });
    if (!ok) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteNotification(n.id, token);
      await refreshFeed();
      toast.success("Dismissed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not dismiss");
    }
  };

  const markAll = async () => {
    try {
      const token = (await getToken()) || undefined;
      const marked = await markAllNotificationsRead(token);
      await refreshFeed();
      toast.success(marked ? `${marked} marked as read` : "Inbox already up to date");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the inbox");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox"
        subtitle="Payments landing, contracts opened and signed, quotes submitted — the signals that also go out by email, visible inside the book."
        actions={
          <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
            {loading ? "Loading..." : `${unread.length} Unread`}
          </Badge>
        }
      />

      {/* Filter pills on the left; the two feed actions share that line */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FilterPill
            active={!onlyUnread}
            onClick={() => setOnlyUnread(false)}
          >
            Everything ({notifications.length})
          </FilterPill>
          <FilterPill
            active={onlyUnread}
            onClick={() => setOnlyUnread(true)}
          >
            Unread only ({unread.length})
          </FilterPill>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading}
            className="border-line text-fg bg-card hover:bg-surface w-9 h-9 p-0 rounded-lg flex items-center justify-center shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            onClick={() => void markAll()}
            disabled={!unread.length}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
            Mark all read
          </Button>
        </div>
      </div>

      {/* Feed — day by day, compact */}
      {loading && notifications.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[52px] w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-dashed border-line p-12 text-center rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-7 h-7 text-accent" />
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            {onlyUnread ? "Inbox zero" : "Nothing has happened yet"}
          </h3>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">
            {onlyUnread
              ? "Every signal is read. New events appear here on their own."
              : "Send an invoice or a contract link — the moment a client opens, signs, or pays, it lands here."}
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <p className="px-1 text-[10px] font-mono uppercase tracking-[0.15em] text-faint">
                {group.label}
              </p>
              <div className="rounded-xl border border-line bg-card divide-y divide-line overflow-hidden">
                <AnimatePresence initial={false}>
                  {group.items.map((n) => {
                    const meta = KIND_META[n.kind] ?? fallbackMeta;
                    const Icon = meta.icon;
                    return (
                      <motion.div
                        key={n.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className={`group relative flex items-center gap-3 px-3.5 py-2.5 transition-colors cursor-pointer hover:bg-surface ${
                          n.is_read ? "" : "bg-accent-soft/30"
                        } ${busyId === n.id ? "opacity-60" : ""}`}
                        onClick={() => void open(n)}
                      >
                        <span
                          className={`w-8 h-8 rounded-lg bg-surface border border-line flex items-center justify-center shrink-0 ${meta.tint}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                            <p className="text-sm font-medium text-fg truncate">{humanizeNotificationTitle(n.title)}</p>
                          </div>
                          {n.body && (
                            <p className="text-xs text-muted truncate pl-3.5 mt-0.5">{humanizeNotificationBody(n.body, currency)}</p>
                          )}
                        </div>

                        <span className="text-[10px] font-mono uppercase tracking-wider text-faint shrink-0">
                          {meta.label} · {timeAgo(n.occurred_at)}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void dismiss(n);
                          }}
                          title="Dismiss"
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-faint hover:text-danger hover:bg-danger/10 transition-all shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
