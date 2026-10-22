// Pricing on this side is a *copy of the server's answer*, never a second set of
// numbers. The matrix lives in apps/api/config/pricing.json and is served by
// GET /api/v1/billing/plans; every card, meter and paywall here renders from
// that response, so a price or limit can only ever be changed in one place and
// the API keeps refusing requests at the same number the page advertises.
import { logHandledError } from "@/lib/log-error";

export type PlanKey = "free" | "starter" | "growth" | "pro";

/** Row-count caps (total rows in the workspace). */
export type CapacityKind = "clients" | "projects" | "services" | "link_pages" | "portfolios";

/** Per-calendar-month allowances. */
export type MeterKind = "proposals" | "ai_asks";

export type FeatureKind = "proposals" | "insights";
export type InsightModule = "reports" | "testimonials" | "shared_links";

export interface DimensionMeta {
  label: string;
  singular: string;
  feature: string;
  href: string;
}

export interface PlanRate {
  reads_per_min: number;
  writes_per_min: number;
  ai_per_min: number;
  burst: number;
}

export interface PlanFeatures {
  proposals: boolean;
  insights: boolean;
  insight_modules: Record<InsightModule, boolean>;
}

export interface PlanCard {
  key: PlanKey;
  name: string;
  price: number;
  tagline: string;
  limits: Record<CapacityKind, number>;
  meters: Record<MeterKind, number>;
  features: PlanFeatures;
  rate: PlanRate;
  highlighted?: boolean;
}

export interface PricingMatrix {
  version: number;
  currency: string;
  billingPeriod: string;
  dimensions: Record<CapacityKind, DimensionMeta>;
  meters: Record<MeterKind, DimensionMeta>;
  insightModules: Record<InsightModule, string>;
  plans: PlanCard[];
}

export interface CapacityUsage {
  used: number;
  /** Null only for owner accounts, whose row caps are exempted server-side. */
  limit: number | null;
  unlimited: boolean;
  label: string;
  href: string | null;
}

export interface SubscriptionInfo {
  plan_name: string | null;
  amount_cents: number | null;
  currency: string | null;
  period_start: string | null;
  period_end: string | null;
  source: string | null;
  synced_at: string | null;
}

/** GET /api/v1/billing/me — what the plan is, what it allows, what is used. */
export interface PlanSnapshot {
  tier: PlanKey;
  plan: string;
  price: number;
  status: string | null;
  is_owner: boolean;
  period: string;
  capacities: Record<CapacityKind, CapacityUsage>;
  meters: Record<MeterKind, CapacityUsage>;
  features: PlanFeatures;
  rate: Omit<PlanRate, "burst">;
  subscription: SubscriptionInfo | null;
  sync_configured: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/**
 * The matrix, for server rendering (marketing + pricing pages).
 *
 * Cached for five minutes rather than on every request: it changes only when
 * pricing.json is deployed, and the marketing pages are the highest-traffic
 * surface the app has. A failure here is not allowed to take the page down, so
 * it returns null and the caller renders the "pricing unavailable" state
 * instead of inventing numbers.
 */
export async function getPricingMatrix(): Promise<PricingMatrix | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/billing/plans`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      logHandledError("Pricing matrix fetch failed:", new Error(`HTTP ${res.status}`));
      return null;
    }
    return (await res.json()) as PricingMatrix;
  } catch (err) {
    logHandledError("Pricing matrix fetch failed:", err);
    return null;
  }
}

/**
 * The matrix for a client component, through the same-origin proxy so the
 * browser never needs the API's URL or CORS. Throws on failure: callers wrap it
 * in their own loading/error state rather than rendering invented numbers.
 */
export async function fetchPricingMatrix(): Promise<PricingMatrix> {
  const res = await fetch("/api/billing/plans", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load pricing");
  return (await res.json()) as PricingMatrix;
}

/**
 * The structured 402 body the API raises when a plan is out of room
 * (app/core/quota.py). Returns null for any other error so a quota denial and a
 * real failure never look the same on screen.
 */
export function planDenialFrom(payload: unknown): PlanDenial | null {
  const detail = (payload as { detail?: unknown } | null)?.detail;
  if (!detail || typeof detail !== "object") return null;
  const candidate = detail as Partial<PlanDenial>;
  if (typeof candidate.code !== "string" || !candidate.code.startsWith("plan_")) return null;
  return candidate as PlanDenial;
}

export interface PlanDenial {
  code: "plan_limit_reached" | "plan_meter_exhausted" | "plan_feature_locked";
  kind: string;
  used: number;
  limit: number;
  tier: PlanKey;
  label: string;
  upgrade_to: PlanKey | null;
  upgrade_href: string;
  period?: string;
}

/** Marketing headline for one plan, built from the matrix so it stays true. */
export function planFeatureList(plan: PlanCard, matrix: PricingMatrix): string[] {
  // Every capacity dimension the API enforces, in the matrix's own order, so a
  // new dimension shows up on the cards without editing this function.
  const room = (Object.keys(matrix.dimensions) as CapacityKind[])
    .map((kind) => {
      const meta = matrix.dimensions[kind];
      const count = plan.limits[kind];
      return `${count} ${count === 1 ? meta.singular : meta.label}`;
    })
    .join(", ");

  const sold: string[] = [];
  if (plan.features.proposals) {
    sold.push(`${plan.meters.proposals} proposals/mo`);
  }
  if (plan.features.insights) {
    const modules = matrix.insightModules;
    const open = (Object.keys(plan.features.insight_modules) as InsightModule[]).filter(
      (m) => plan.features.insight_modules[m]
    );
    sold.push(
      open.length === Object.keys(modules).length
        ? "All insights: reports, testimonials, shared links"
        : `Insights: ${open.map((m) => modules[m].toLowerCase()).join(", ")}`
    );
  }
  sold.push(`Book AI: ${plan.meters.ai_asks} questions/mo`);
  sold.push("Time tracking & money — unlimited on every plan");

  return [room, ...sold];
}
