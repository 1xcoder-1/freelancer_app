import { clerkClient } from "@clerk/nextjs/server";
import { logHandledError } from "@/lib/log-error";
import type { PlanKey, PricingMatrix } from "@/lib/plans";

/**
 * Clerk plan ids are minted in the Clerk dashboard, so they cannot live in
 * pricing.json (which is the product's own truth) or in code. This resolves them
 * at runtime by the fee the plan charges — the one attribute both sides agree on
 * — and falls back to the plan name if a dashboard price was rounded.
 *
 * Cached in-process for five minutes: the marketing pages render this on every
 * anonymous visit, and a Clerk API call per render would make the pricing page
 * depend on a third party it does not need to.
 */
export type ClerkPlanIds = Partial<Record<PlanKey, string>>;

const TTL_MS = 300_000;

let cache: { at: number; ids: ClerkPlanIds } | null = null;
let inflight: Promise<ClerkPlanIds> | null = null;

async function load(matrix: PricingMatrix): Promise<ClerkPlanIds> {
  const ids: ClerkPlanIds = {};
  try {
    const client = await clerkClient();
    const { data } = await client.billing.getPlanList({ payerType: "user" });
    for (const plan of matrix.plans) {
      // The free tier is Clerk's default plan and has no checkout of its own.
      if (plan.price <= 0) continue;
      const feeCents = plan.price * 100;
      const atFee = data.filter(
        (candidate) => (candidate.fee?.amount ?? -1) === feeCents
      );
      const match =
        atFee.find(
          (candidate) =>
            candidate.name.trim().toLowerCase() === plan.name.trim().toLowerCase()
        ) ?? atFee[0];
      if (match) ids[plan.key] = match.id;
    }
  } catch (err) {
    // Billing not enabled yet, or Clerk unreachable: the CTA degrades to the
    // in-app pricing table rather than 500ing the marketing page.
    logHandledError("Could not resolve Clerk plan ids:", err);
    return {};
  }
  return ids;
}

export async function getClerkPlanIds(matrix: PricingMatrix): Promise<ClerkPlanIds> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.ids;
  inflight = inflight ?? load(matrix);
  const ids = await inflight;
  inflight = null;
  cache = { at: Date.now(), ids };
  return ids;
}
