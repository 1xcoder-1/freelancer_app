"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  CardContent,
  CardSettings,
  ReportCardData,
  getMyReportCard,
  getPublicReportCard,
  saveReportCardContent,
  saveReportCardSettings,
  type ApiError,
} from "@/lib/api";

import { useApiData } from "@/hooks/use-api-data";

/** Owner-side data layer: loads/saves the signed-in user's card in Neon. */
export function useOwnerReportCard() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const { data, loading, error, refresh: reloadData, mutate } = useApiData<ReportCardData>(
    "report-card:my",
    async (token) => {
      return await getMyReportCard(token);
    },
    { reportContext: "report_card" }
  );

  const saveContent = useCallback(async (content: CardContent) => {
    const token = (await getTokenRef.current()) || undefined;
    const next = await saveReportCardContent(content, token);
    mutate(next);
  }, [mutate]);

  const saveSettings = useCallback(async (settings: CardSettings) => {
    const token = (await getTokenRef.current()) || undefined;
    const next = await saveReportCardSettings(settings, token);
    mutate(next);
  }, [mutate]);

  return {
    data,
    loading,
    error: error ? error.message : null,
    refresh: () => reloadData(true),
    saveContent,
    saveSettings,
  };
}

type PublicCardStatus =
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
