"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { notificationsStreamUrl, getUnreadNotificationCount } from "@/lib/api";
import { invalidateCache } from "@/lib/cache";
import { useApiData } from "@/hooks/use-api-data";

// One SSE connection per app, shared by every consumer (sidebar badge,
// dashboard header, inbox panel). Server pings "changed" the moment a
// producer writes; we invalidate the notifications cache keys and every
// mounted useApiData consumer refetches. A 60s poll stays as the safety net
// for a closed tab race or a multi-worker API deployment.

let source: EventSource | null = null;
let refCount = 0;
let reconnectTimer: number | null = null;
let backoffMs = 3000;

function closeStream() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  source?.close();
  source = null;
}

// Debounced so a burst of producer writes (e.g. the overdue scan marking
// several invoices) triggers one refetch, not one per row.
let debounceTimer: number | null = null;
function notifyChanged() {
  if (debounceTimer !== null) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    invalidateCache(/^notifications:/);
  }, 300);
}

function openStream(getToken: (opts?: { skipCache?: boolean }) => Promise<string | null>) {
  void (async () => {
    const token = (await getToken({ skipCache: true })) || null;
    if (!token) return;
    source = new EventSource(notificationsStreamUrl(token));
    source.addEventListener("ready", () => {
      backoffMs = 3000;
    });
    source.addEventListener("changed", notifyChanged);
    // Session tokens expire, so never rely on EventSource's auto-reconnect
    // (it would replay the stale token in the URL) — close and reopen with a
    // fresh one, backing off while the API is down.
    source.onerror = () => {
      closeStream();
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        if (refCount > 0) openStream(getToken);
      }, backoffMs);
      backoffMs = Math.min(backoffMs * 2, 60_000);
    };
  })();
}

/**
 * Live unread count for the inbox. Opens the shared SSE stream while mounted
 * and returns the current unread number (0 until the first fetch lands).
 */
export function useLiveNotifications(): number {
  const { getToken } = useAuth();

  useEffect(() => {
    refCount += 1;
    if (!source && reconnectTimer === null) openStream(getToken);
    return () => {
      refCount -= 1;
      if (refCount <= 0) {
        refCount = 0;
        closeStream();
      }
    };
    // getToken is stable across renders in Clerk's hook; reopening on its
    // identity would tear down the shared stream on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data } = useApiData<number>(
    "notifications:unread",
    async (token) => getUnreadNotificationCount(token),
    { pollMs: 60_000 }
  );

  return data ?? 0;
}
