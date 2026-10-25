"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { notificationsStreamUrl, getUnreadNotificationCount } from "@/lib/api";
import { invalidateCache } from "@/lib/cache";
import { useApiData } from "@/hooks/use-api-data";

const CHANNEL_NAME = "fb_notifications_bus";
const HEARTBEAT_INTERVAL_MS = 3000;
const LEADER_TIMEOUT_MS = 7000;

let source: EventSource | null = null;
let reconnectTimer: number | null = null;
let backoffMs = 3000;
let refCount = 0;
let channel: BroadcastChannel | null = null;
let isLeader = false;
let tabId = "";
let lastLeaderHeartbeat = 0;
let heartbeatTimer: number | null = null;
let leaderCheckTimer: number | null = null;
let currentGetToken: ((opts?: { skipCache?: boolean }) => Promise<string | null>) | null = null;

function getTabId(): string {
  if (!tabId) {
    tabId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return tabId;
}

function initChannel() {
  if (channel || typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "changed") {
        notifyChanged();
      } else if (msg.type === "heartbeat") {
        lastLeaderHeartbeat = Date.now();
        if (isLeader && msg.tabId !== getTabId()) {
          // If two tabs both think they are leader, the lower tabId yields
          if (msg.tabId < getTabId()) {
            stepDown();
          }
        }
      } else if (msg.type === "leader_stepping_down") {
        lastLeaderHeartbeat = 0;
        attemptBecomeLeader();
      }
    };
  } catch {
    channel = null;
  }
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

function broadcastChanged() {
  notifyChanged();
  try {
    channel?.postMessage({ type: "changed", from: getTabId() });
  } catch {
    // Channel closed or unvailable
  }
}

function closeStream() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  source?.close();
  source = null;
}

function openStream() {
  if (!currentGetToken || !isLeader) return;
  closeStream();

  void (async () => {
    try {
      const token = (await currentGetToken?.({ skipCache: true })) || null;
      if (!token || !isLeader) return;

      source = new EventSource(notificationsStreamUrl(token));
      source.addEventListener("ready", () => {
        backoffMs = 3000;
      });
      source.addEventListener("changed", broadcastChanged);
      source.onerror = () => {
        closeStream();
        if (isLeader && refCount > 0) {
          reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;
            if (isLeader && refCount > 0) openStream();
          }, backoffMs);
          backoffMs = Math.min(backoffMs * 2, 60_000);
        }
      };
    } catch {
      // Token or setup error
    }
  })();
}

function becomeLeader() {
  if (isLeader) return;
  isLeader = true;
  lastLeaderHeartbeat = Date.now();

  try {
    channel?.postMessage({ type: "heartbeat", tabId: getTabId() });
  } catch {
    // Ignore
  }

  if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
  heartbeatTimer = window.setInterval(() => {
    if (!isLeader) return;
    try {
      channel?.postMessage({ type: "heartbeat", tabId: getTabId() });
    } catch {
      // Ignore
    }
  }, HEARTBEAT_INTERVAL_MS);

  openStream();
}

function stepDown() {
  if (!isLeader) return;
  isLeader = false;
  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  closeStream();
  try {
    channel?.postMessage({ type: "leader_stepping_down", tabId: getTabId() });
  } catch {
    // Ignore
  }
}

function attemptBecomeLeader() {
  if (!channel) {
    becomeLeader();
    return;
  }

  const now = Date.now();
  const leaderIsStale = now - lastLeaderHeartbeat > LEADER_TIMEOUT_MS;
  const isVisible = typeof document === "undefined" || document.visibilityState === "visible";

  if (leaderIsStale && isVisible) {
    becomeLeader();
  }
}

function startCoordination(getToken: (opts?: { skipCache?: boolean }) => Promise<string | null>) {
  currentGetToken = getToken;
  initChannel();

  if (!channel) {
    becomeLeader();
    return;
  }

  if (leaderCheckTimer === null) {
    leaderCheckTimer = window.setInterval(() => {
      if (!isLeader) {
        attemptBecomeLeader();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  attemptBecomeLeader();

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        attemptBecomeLeader();
      }
    });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      if (isLeader) {
        stepDown();
      }
    });
  }
}

/**
 * Live unread count for the inbox. Coordinates SSE across tabs and returns
 * the current unread number (0 until the first fetch lands).
 */
export function useLiveNotifications(): number {
  const { getToken } = useAuth();

  useEffect(() => {
    refCount += 1;
    startCoordination(getToken);
    return () => {
      refCount -= 1;
      if (refCount <= 0) {
        refCount = 0;
        stepDown();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data } = useApiData<number>(
    "notifications:unread",
    async (token) => getUnreadNotificationCount(token),
    { pollMs: 60_000 }
  );

  return data ?? 0;
}
