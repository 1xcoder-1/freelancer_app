"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  getCachedData,
  setCachedData,
  subscribeToCache,
  fetchWithDeduplication,
  invalidateCache,
} from "@/lib/cache";
import { reportLoadError } from "@/lib/report";

interface UseApiDataOptions<T> {
  initialData?: T;
  enabled?: boolean;
  ttlMs?: number;
  reportContext?: string;
  onSuccess?: (data: T) => void;
  onError?: (err: unknown) => void;
}

interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  isValidating: boolean;
  error: Error | null;
  refresh: (isManualRefresh?: boolean) => Promise<T | null>;
  mutate: (newData: T | ((prev: T | null) => T), shouldRevalidate?: boolean) => void;
}

export function useApiData<T>(
  key: string | null,
  fetcher: (token?: string) => Promise<T>,
  options: UseApiDataOptions<T> = {}
): UseApiDataResult<T> {
  const {
    initialData,
    enabled = true,
    ttlMs,
    reportContext,
    onSuccess,
    onError,
  } = options;

  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  // Synchronous cache lookup for 0ms initial render
  const cached = key ? getCachedData<T>(key) : null;

  const [data, setData] = useState<T | null>(() => {
    if (cached) return cached.data;
    if (initialData !== undefined) return initialData;
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    // If we have cached data or initialData, we are NOT in blocking loading state
    if (cached) return false;
    if (initialData !== undefined) return false;
    return enabled;
  });

  const [isValidating, setIsValidating] = useState<boolean>(() => {
    if (!enabled || !key) return false;
    return !cached || cached.isStale;
  });

  const [error, setError] = useState<Error | null>(null);

  // Subscribe to external cache updates
  useEffect(() => {
    if (!key) return;
    return subscribeToCache<T>(key, (updatedData) => {
      setData(updatedData);
      setLoading(false);
      setIsValidating(false);
    });
  }, [key]);

  const loadData = useCallback(
    async (isManualRefresh: boolean = false): Promise<T | null> => {
      if (!key || !enabled) return null;

      if (isManualRefresh) {
        setLoading(true);
      }
      setIsValidating(true);
      setError(null);

      try {
        const token = (await getTokenRef.current()) || undefined;
        const freshData = await fetchWithDeduplication(
          key,
          () => fetcher(token),
          ttlMs
        );

        setData(freshData);
        if (onSuccess) onSuccess(freshData);
        return freshData;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        if (reportContext) {
          reportLoadError(err, reportContext);
        }
        if (onError) onError(err);
        return null;
      } finally {
        setLoading(false);
        setIsValidating(false);
      }
    },
    [key, enabled, ttlMs, fetcher, reportContext, onSuccess, onError]
  );

  // Trigger load on mount or key change if needed
  useEffect(() => {
    if (!enabled || !key) return;

    const currentCached = getCachedData<T>(key);
    if (!currentCached || currentCached.isStale) {
      void loadData(false);
    }
  }, [key, enabled, loadData]);

  const mutate = useCallback(
    (
      newData: T | ((prev: T | null) => T),
      shouldRevalidate: boolean = false
    ) => {
      if (!key) return;
      setData((prev) => {
        const resolved =
          typeof newData === "function"
            ? (newData as (prev: T | null) => T)(prev)
            : newData;
        setCachedData(key, resolved, ttlMs);
        return resolved;
      });

      if (shouldRevalidate) {
        loadData(false);
      }
    },
    [key, ttlMs, loadData]
  );

  return {
    data,
    loading,
    isValidating,
    error,
    refresh: (manual?: boolean) => loadData(manual ?? true),
    mutate,
  };
}

export { invalidateCache };
