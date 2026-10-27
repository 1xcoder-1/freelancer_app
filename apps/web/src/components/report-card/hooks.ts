"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  CardContent,
  CardSettings,
  ReportCardData,
  getMyReportCard,
  saveReportCardContent,
  saveReportCardSettings,
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
