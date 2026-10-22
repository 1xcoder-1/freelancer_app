"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { useApiData } from "@/hooks/use-api-data";
import {
  getFeatureFlags,
  updateFeatureFlag,
  type FeatureFlag,
  type FeatureFlagsPayload,
} from "@/lib/api";
import { logHandledError } from "@/lib/log-error";

interface FeatureFlagsContextValue {
  // True only once the flags payload has loaded. False means "unknown", so
  // gated surfaces stay hidden instead of flashing before the real state.
  ready: boolean;
  isOwner: boolean;
  // Owner bypass: the owner always keeps access to pages hidden from others.
  canSee: (key: string) => boolean;
  // Stored switch state — what the owner's management list displays.
  isVisible: (key: string) => boolean;
  labelFor: (id: string, fallback: string) => string;
  setVisible: (key: string, visible: boolean) => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

function withVisibility(flags: FeatureFlag[], key: string, visible: boolean): FeatureFlag[] {
  const idx = flags.findIndex((f) => f.key === key);
  if (idx === -1) return [...flags, { key, visible, label_override: null }];
  const next = [...flags];
  next[idx] = { ...next[idx], visible };
  return next;
}

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { getToken } = useAuth();
  // Wait for the Clerk profile so the owner check works even when the session
  // token template omits the email claim (the API falls back to this param).
  const email = user?.primaryEmailAddress?.emailAddress || undefined;

  // Key is scoped by account: the cache lives in JS memory and client-side
  // login (router.replace) never reloads the page, so a payload fetched as a
  // non-owner would otherwise keep its stale is_owner:false for the TTL window.
  const { data, mutate } = useApiData<FeatureFlagsPayload>(
    `dashboard:feature-flags:${email ?? "anon"}`,
    (token) => getFeatureFlags(token, email),
    { enabled: Boolean(email), reportContext: "feature-flags" }
  );

  const value = useMemo<FeatureFlagsContextValue>(() => {
    const flags = data?.flags ?? [];
    const byKey = new Map(flags.map((f) => [f.key, f]));
    const write = (updater: (prev: FeatureFlagsPayload | null) => FeatureFlagsPayload) =>
      mutate((prev) => updater(prev), false);

    const setVisible = async (key: string, visible: boolean) => {
      const prevVisible = byKey.get(key)?.visible ?? true;
      write((p) => ({
        is_owner: p?.is_owner ?? false,
        flags: withVisibility(p?.flags ?? [], key, visible),
      }));
      try {
        const token = (await getToken()) || undefined;
        const saved = await updateFeatureFlag({ key, visible }, token, email);
        write((p) => ({
          is_owner: p?.is_owner ?? false,
          flags: withVisibility(p?.flags ?? [], key, saved.visible),
        }));
      } catch (err) {
        logHandledError("Failed to save feature flag:", err);
        toast.error("Could not save that change — reverting.");
        write((p) => ({
          is_owner: p?.is_owner ?? false,
          flags: withVisibility(p?.flags ?? [], key, prevVisible),
        }));
      }
    };

    return {
      ready: data !== null,
      isOwner: data?.is_owner ?? false,
      canSee: (key) => Boolean(data && (data.is_owner || (byKey.get(key)?.visible ?? true))),
      isVisible: (key) => byKey.get(key)?.visible ?? true,
      labelFor: (id, fallback) => byKey.get(id)?.label_override?.trim() || fallback,
      setVisible,
    };
  }, [data, mutate, email, getToken]);

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error("useFeatureFlags must be used inside <FeatureFlagsProvider>");
  return ctx;
}
