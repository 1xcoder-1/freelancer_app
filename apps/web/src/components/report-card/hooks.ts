"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  ApiError,
  CardContent,
  CardSettings,
  ReportCardData,
  getMyReportCard,
  getPublicReportCard,
  saveReportCardContent,
  saveReportCardSettings,
} from "@/lib/api";

/** Owner-side data layer: loads/saves the signed-in user's card in Neon. */
export function useOwnerReportCard() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);

  // Clerk re-creates getToken every render; keeping the latest one in a ref
  // (updated from an effect, never during render) lets refresh() stay stable so
  // the load effect below runs once instead of looping.
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const [data, setData] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const token = (await getTokenRef.current()) || undefined;
      const next = await getMyReportCard(token);
      setData(next);
      setError(null);
    } catch (err) {
      console.warn("Failed to load report card:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load report card",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveContent = useCallback(async (content: CardContent) => {
    const token = (await getTokenRef.current()) || undefined;
    const next = await saveReportCardContent(content, token);
    setData(next);
  }, []);

  const saveSettings = useCallback(async (settings: CardSettings) => {
    const token = (await getTokenRef.current()) || undefined;
    const next = await saveReportCardSettings(settings, token);
    setData(next);
  }, []);

  return { data, loading, error, refresh, saveContent, saveSettings };
}

export type PublicCardStatus =
  "loading" | "ok" | "revoked" | "expired" | "notfound";

/**
 * Public share-view data layer. Polls the server so a revoked/expired link
 * stops working in real time without the viewer reloading the page.
 */
export function usePublicReportCard(
  username: string,
  shareToken?: string | null,
) {
  const [data, setData] = useState<ReportCardData | null>(null);
  const [status, setStatus] = useState<PublicCardStatus>("loading");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!username) {
        if (mounted) setStatus("notfound");
        return;
      }
      try {
        const next = await getPublicReportCard(username, shareToken);
        if (!mounted) return;
        setData(next);
        setStatus("ok");
      } catch (err) {
        if (!mounted) return;
        const httpStatus = (err as ApiError)?.status;
        if (httpStatus === 410) setStatus("expired");
        else if (httpStatus === 403) setStatus("revoked");
        else if (httpStatus === 404) setStatus("notfound");
        else setStatus((prev) => (prev === "ok" ? "ok" : "notfound"));
      }
    };

    load();
    const interval = setInterval(load, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [username, shareToken]);

  return { data, status };
}
