"use client";

import { useCallback, useMemo } from "react";
import { invalidateCache } from "@/lib/cache";
import { useApiData } from "@/hooks/use-api-data";
import {
  fetchPricingMatrix,
  type CapacityKind,
  type CapacityUsage,
  type FeatureKind,
  type InsightModule,
  type MeterKind,
  type PlanCard,
  type PlanKey,
  type PlanSnapshot,
  type PricingMatrix,
} from "@/lib/plans";

export const BILLING_SNAPSHOT_KEY = "billing:snapshot";

/**
 * Invalidate the shared snapshot after any mutation that moves a meter or fills
 * a slot, so a meter updates the moment the row is created rather than on the
 * next poll.
 */
export function invalidatePlanSnapshot() {
  invalidateCache(BILLING_SNAPSHOT_KEY);
}

export interface UsePlanResult {
  /** The tier the API enforces. Free until the first snapshot arrives. */
  plan: PlanKey;
  snapshot: PlanSnapshot | null;
  /** The matrix row for the current tier — null until both halves loaded. */
  definition: PlanCard | null;
  /** The row one step above the current tier, or null at the top plan. */
  nextPlan: PlanCard | null;
  /** Where every upgrade CTA points: the pricing page, scrolled to that tier. */
  upgradeHref: string;
  matrix: PricingMatrix | null;
  status: string | null;
  isOwner: boolean;
  /** False until the first successful fetch — gate create actions on this. */
  ready: boolean;
  loading: boolean;
  isValidating: boolean;
  error: Error | null;
  refresh: () => Promise<PlanSnapshot | null>;
  capacity: (kind: CapacityKind) => CapacityUsage | null;
  meter: (kind: MeterKind) => CapacityUsage | null;
  /** Sold features only — toggled features live in the feature-flag hook. */
  feature: (kind: FeatureKind) => boolean;
  insight: (module: InsightModule) => boolean;
}

async function fetchSnapshot(): Promise<PlanSnapshot> {
  const res = await fetch("/api/billing/me", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load your plan");
  return (await res.json()) as PlanSnapshot;
}

async function fetchBundle(): Promise<{ snapshot: PlanSnapshot; matrix: PricingMatrix }> {
  const [snapshot, matrix] = await Promise.all([fetchSnapshot(), fetchPricingMatrix()]);
  return { snapshot, matrix };
}

/**
 * The plan, exactly as the API enforces it.
 *
 * The snapshot (tier + live usage) and the matrix (every tier's numbers) load
 * together under one cache key so all mounted meters share a single request and
 * can never render two different versions of pricing.
 */
export function usePlan(options: { freshOnMount?: boolean } = {}): UsePlanResult {
  const { data, loading, isValidating, error, refresh } = useApiData<{
    snapshot: PlanSnapshot;
    matrix: PricingMatrix;
  }>(BILLING_SNAPSHOT_KEY, fetchBundle, {
    // ttl 0 = always revalidate after mount, so returning from Clerk's
    // checkout never shows the pre-upgrade plan.
    ttlMs: options.freshOnMount ? 0 : 60_000,
    reportContext: "Billing plan",
  });

  const snapshot = data?.snapshot ?? null;
  const matrix = data?.matrix ?? null;

  const definition = useMemo(
    () => (matrix && snapshot ? matrix.plans.find((p) => p.key === snapshot.tier) ?? null : null),
    [matrix, snapshot]
  );

  // The plan one step up, taken from the matrix's own ordering rather than a
  // list duplicated here — a fifth tier would slot in without touching this file.
  const nextPlan = useMemo(() => {
    if (!matrix || !definition) return null;
    const index = matrix.plans.findIndex((p) => p.key === definition.key);
    return index >= 0 ? matrix.plans[index + 1] ?? null : null;
  }, [matrix, definition]);

  const upgradeHref = nextPlan ? `/pricing?focus=${nextPlan.key}` : "/pricing";

  const refetch = useCallback(async () => {
    const next = await refresh(true);
    return next?.snapshot ?? null;
  }, [refresh]);

  return {
    plan: snapshot?.tier ?? "free",
    snapshot,
    definition,
    nextPlan,
    upgradeHref,
    matrix,
    status: snapshot?.status ?? null,
    isOwner: snapshot?.is_owner ?? false,
    ready: snapshot !== null && matrix !== null,
    loading,
    isValidating,
    error,
    refresh: refetch,
    capacity: (kind) => snapshot?.capacities[kind] ?? null,
    meter: (kind) => snapshot?.meters[kind] ?? null,
    feature: (kind) => snapshot?.features[kind] ?? false,
    insight: (module) => snapshot?.features.insight_modules[module] ?? false,
  };
}
