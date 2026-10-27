"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";

/* Live preview channel over a native WebSocket to the FastAPI backend.
   The editor connects as "publisher" and streams debounced draft snapshots;
   preview tabs connect as "viewer" with a short-lived preview token and
   re-render on every snapshot. Nothing here persists — saving stays on the
   REST endpoints. */

export interface PreviewPageItemState {
  id: string;
  label: string;
  url: string;
  item_type?: string;
  icon?: string | null;
  description?: string | null;
  image_url?: string | null;
  display?: string | null;
  active: boolean;
}

export interface PreviewPageState {
  display_name: string;
  headline?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  template: string;
  background_image_url?: string | null;
  background_overlay?: number | null;
  items: PreviewPageItemState[];
}

export type PreviewChannelStatus = "connecting" | "live" | "offline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const WS_BASE = `${API_URL.replace(/^http/, "ws")}/api/v1/link-pages/ws/`;
const MAX_RECONNECT_ATTEMPTS = 8;
const PING_INTERVAL_MS = 25_000;

interface SocketHandlers {
  getRole: () => "publisher" | "viewer";
  getToken: () => Promise<string | undefined>;
  onReady: (socket: WebSocket) => void;
  onState: (state: PreviewPageState) => void;
  onStatus: (status: PreviewChannelStatus) => void;
}

function openPreviewSocket(pageId: string, handlers: SocketHandlers): () => void {
  let socket: WebSocket | null = null;
  let disposed = false;
  let attempt = 0;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const clearPing = () => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (disposed) return;
    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      handlers.onStatus("offline");
      return;
    }
    const delay = Math.min(1000 * 2 ** attempt, 10_000);
    attempt += 1;
    setTimeout(() => {
      if (!disposed) connect();
    }, delay);
  };

  const connect = () => {
    if (disposed) return;
    handlers.onStatus("connecting");
    try {
      socket = new WebSocket(`${WS_BASE}${encodeURIComponent(pageId)}`);
    } catch {
      scheduleReconnect();
      return;
    }
    const sock = socket;

    sock.onopen = async () => {
      const token = await handlers.getToken().catch(() => undefined);
      if (!token) {
        sock.close();
        return;
      }
      sock.send(JSON.stringify({ type: "auth", role: handlers.getRole(), token }));
    };

    sock.onmessage = (event) => {
      let msg: { type?: string; state?: PreviewPageState };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg?.type === "ready") {
        attempt = 0;
        handlers.onStatus("live");
        handlers.onReady(sock);
        clearPing();
        pingTimer = setInterval(() => {
          if (sock.readyState === WebSocket.OPEN) {
            sock.send(JSON.stringify({ type: "ping" }));
          }
        }, PING_INTERVAL_MS);
      } else if (msg?.type === "state" && msg.state) {
        handlers.onState(msg.state);
      }
    };

    sock.onclose = () => {
      clearPing();
      if (!disposed) scheduleReconnect();
    };
    sock.onerror = () => {
      try {
        sock.close();
      } catch {
        // already closing
      }
    };
  };

  connect();
  return () => {
    disposed = true;
    clearPing();
    try {
      socket?.close();
    } catch {
      // never open
    }
  };
}

function sendState(socket: WebSocket, state: PreviewPageState) {
  socket.send(JSON.stringify({ type: "state", state }));
}

/* Editor side: call publish(draftState) on every change — it debounces itself
   through the effect that drives it and always flushes the latest draft once
   the socket becomes ready. */
export function useLivePreviewPublisher(pageId?: string) {
  const { getToken } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<PreviewPageState | null>(null);
  const [socketStatus, setSocketStatus] = useState<PreviewChannelStatus>("connecting");
  // Derived, not set in an effect: "offline" is a static fact of the inputs.
  const status: PreviewChannelStatus = pageId ? socketStatus : "offline";

  useEffect(() => {
    if (!pageId) return;
    const close = openPreviewSocket(pageId, {
      getRole: () => "publisher",
      getToken: async () => (await getToken()) ?? undefined,
      onReady: (socket) => {
        socketRef.current = socket;
        if (pendingRef.current) sendState(socket, pendingRef.current);
      },
      onState: () => {},
      onStatus: setSocketStatus,
    });
    return () => {
      close();
      socketRef.current = null;
    };
  }, [pageId, getToken]);

  const publish = useCallback((state: PreviewPageState) => {
    pendingRef.current = state;
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) sendState(socket, state);
  }, []);

  return { publish, status };
}

/* Preview tab side: receives draft snapshots pushed by the editor. */
export function useLivePreviewSubscriber(pageId: string | null, token: string | null) {
  const [state, setState] = useState<PreviewPageState | null>(null);
  const [socketStatus, setSocketStatus] = useState<PreviewChannelStatus>("connecting");
  const status: PreviewChannelStatus = pageId && token ? socketStatus : "offline";

  useEffect(() => {
    if (!pageId || !token) return;
    return openPreviewSocket(pageId, {
      getRole: () => "viewer",
      getToken: async () => token ?? undefined,
      onReady: () => {},
      onState: (next) => setState(next),
      onStatus: setSocketStatus,
    });
  }, [pageId, token]);

  return { state, status };
}
