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

interface FlagPatch {
  visible?: boolean;
  label_override?: string | null;
}

interface FeatureFlagsContextValue {
  // True once the flags payload has loaded (or definitively failed — the
  // failure path leaves defaults in place rather than blocking the app).
  ready: boolean;
  isOwner: boolean;
  isVisible: (key: string) => boolean;
  labelFor: (id: string, fallback: string) => string;
  setFlag: (key: string, patch: FlagPatch) => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

function applyPatch(flags: FeatureFlag[], key: string, patch: Partial<FeatureFlag>): FeatureFlag[] {
  const idx = flags.findIndex((f) => f.key === key);
  const row: FeatureFlag =
    idx === -1 ? { key, visible: true, label_override: null } : { ...flags[idx] };
  if (patch.visible !== undefined) row.visible = patch.visible;
  if (patch.label_override !== undefined) row.label_override = patch.label_override;
  if (idx === -1) return [...flags, row];
  const next = [...flags];
  next[idx] = row;
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

    const setFlag = async (key: string, patch: FlagPatch) => {
      const prev = byKey.get(key);
      write((p) => ({ is_owner: p?.is_owner ?? true, flags: applyPatch(p?.flags ?? [], key, patch) }));
      try {
        const token = (await getToken()) || undefined;
        const saved = await updateFeatureFlag({ key, ...patch }, token, email);
        write((p) => ({
          is_owner: p?.is_owner ?? true,
          flags: applyPatch(p?.flags ?? [], key, {
            visible: saved.visible,
            label_override: saved.label_override,
          }),
        }));
      } catch (err) {
        logHandledError("Failed to save feature flag:", err);
        toast.error("Could not save that change — reverting.");
        write((p) => ({
          is_owner: p?.is_owner ?? true,
          flags: applyPatch(p?.flags ?? [], key, {
            visible: prev?.visible ?? true,
            label_override: prev?.label_override ?? null,
          }),
        }));
      }
    };

    return {
      ready: data !== null,
      isOwner: data?.is_owner ?? false,
      isVisible: (key) => byKey.get(key)?.visible ?? true,
      labelFor: (id, fallback) => byKey.get(id)?.label_override?.trim() || fallback,
      setFlag,
    };
  }, [data, mutate, email, getToken]);

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error("useFeatureFlags must be used inside <FeatureFlagsProvider>");
  return ctx;
}
