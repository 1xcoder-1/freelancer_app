"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Lock,
  Sparkles,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/hooks/use-plan";
import type {
  CapacityKind,
  CapacityUsage,
  FeatureKind,
  MeterKind,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

// Capacity gating for every metered dimension (clients, projects, services,
// link pages, portfolios). Numbers and labels come from the API's plan snapshot
// — nothing here knows what a plan costs or how many rows it allows.

const SECTION_NAMES: Record<CapacityKind, string> = {
  clients: "Clients",
  projects: "Projects",
  services: "Services",
  link_pages: "Link pages",
  portfolios: "Portfolio",
};

export interface PlanCapacity extends CapacityUsage {
  kind: CapacityKind;
  planName: string;
  /** Label for one of them, derived from the API's plural label. */
  singular: string;
  limitLabel: string | null;
  atLimit: boolean;
  loaded: boolean;
  backHref: string;
  backLabel: string;
  upgradeHref: string;
}

export function usePlanCapacity(kind: CapacityKind): PlanCapacity {
  const { snapshot, upgradeHref } = usePlan();
  const usage = snapshot?.capacities[kind] ?? null;
  const label = usage?.label || kind.replace("_", " ");
  const limit = usage?.limit ?? null;

  if (!snapshot || !usage) {
    // Nothing is known about this dimension yet: report an unloaded, unlocked
    // state so a create button renders normally instead of flickering a paywall.
    return {
      used: 0,
      limit: null,
      unlimited: false,
      label,
      href: null,
      kind,
      planName: "",
      singular: label.replace(/s$/, ""),
      limitLabel: null,
      atLimit: false,
      loaded: false,
      backHref: "/dashboard",
      backLabel: `Back to ${SECTION_NAMES[kind] || label}`,
      upgradeHref,
    };
  }

  return {
    ...usage,
    kind,
    planName: snapshot.plan,
    // The API sends the plural label ("client cards"); the copy that needs the
    // singular ("3-client limit") strips the trailing s rather than duplicating
    // a second label table in the browser.
    singular: label.replace(/s$/, ""),
    limitLabel: limit === null ? null : `${usage.used} / ${limit}`,
    atLimit: limit !== null && usage.used >= limit,
    loaded: true,
    backHref: usage.href || "/dashboard",
    backLabel: `Back to ${SECTION_NAMES[kind] || label}`,
    upgradeHref,
  };
}

/** Compact meter for page headers: "12 / 50 client cards". */
export function PlanUsageChip({
  capacity,
  className,
}: {
  capacity: PlanCapacity;
  className?: string;
}) {
  if (!capacity.loaded) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] whitespace-nowrap",
        capacity.atLimit
          ? "border-warn/30 bg-warn/10 text-warn"
          : "border-line bg-card text-muted",
        className
      )}
      title={
        capacity.unlimited
          ? `${capacity.used} ${capacity.label} on the ${capacity.planName} plan (owner account — no cap)`
          : `${capacity.used} of ${capacity.limit} ${capacity.label} on the ${capacity.planName} plan`
      }
    >
      <span className="font-semibold tabular-nums">{capacity.used}</span>
      <span className="opacity-60">
        / {capacity.unlimited ? "unlimited" : capacity.limit}
      </span>
      <span>{capacity.label}</span>
      {capacity.atLimit && (
        <Link
          href={capacity.upgradeHref}
          className="ml-0.5 font-semibold text-accent hover:underline"
        >
          Upgrade
        </Link>
      )}
    </span>
  );
}

/** Inline warning shown beside the create action once the limit is reached. */
export function PlanLimitBanner({
  capacity,
  className,
}: {
  capacity: PlanCapacity;
  className?: string;
}) {
  if (!capacity.atLimit) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-warn/25 bg-warn/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
        <div>
          <p className="text-sm font-semibold text-fg">
            {capacity.limit}-{capacity.singular} limit reached on {capacity.planName}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Your existing {capacity.label} stay fully editable. Upgrade to add
            more.
          </p>
        </div>
      </div>
      <Link
        href={capacity.upgradeHref}
        className="shrink-0 self-start sm:self-auto"
      >
        <Button size="sm" className="h-8">
          Upgrade plan
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  );
}

/** Full replacement for a create page when the account is already at its cap. */
export function PlanLimitBlock({ capacity }: { capacity: PlanCapacity }) {
  if (!capacity.atLimit) return null;

  return (
    <div className="mx-auto max-w-lg space-y-5 rounded-2xl border border-line bg-card p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-warn/10 text-warn">
        <Lock className="h-5 w-5" />
      </span>
      <div>
        <h2 className="font-display text-xl font-medium tracking-wide text-fg">
          The {capacity.singular} shelf is full
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your {capacity.planName} plan allows {capacity.limit}{" "}
          {capacity.label}. Existing {capacity.label} stay fully editable —
          upgrade for more room.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <Link href={capacity.backHref}>
          <Button variant="outline">
            <ArrowLeft className="h-3.5 w-3.5" />
            {capacity.backLabel}
          </Button>
        </Link>
        <Link href={capacity.upgradeHref}>
          <Button>
            Upgrade plan
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

/* ============================ METERS & FEATURE LOCKS ==============
   Capacities count rows that never go away; meters count actions
   inside a billing month and reset. Both live in the same snapshot,
   so a meter reads here exactly as the API counts it server-side.
=================================================================== */

export interface PlanMeter extends CapacityUsage {
  kind: MeterKind;
  planName: string;
  /** Which billing period the allowance belongs to, e.g. "monthly". */
  period: string;
  remaining: number;
  atLimit: boolean;
  loaded: boolean;
  upgradeHref: string;
}

export function usePlanMeter(kind: MeterKind): PlanMeter {
  const { snapshot, upgradeHref } = usePlan();
  const usage = snapshot?.meters[kind] ?? null;
  const label = usage?.label || kind.replace("_", " ");

  if (!snapshot || !usage) {
    return {
      used: 0,
      limit: 0,
      unlimited: false,
      label,
      href: null,
      kind,
      planName: "",
      period: "monthly",
      remaining: 0,
      atLimit: false,
      loaded: false,
      upgradeHref,
    };
  }

  const limit = usage.limit ?? 0;
  return {
    ...usage,
    limit,
    kind,
    planName: snapshot.plan,
    period: snapshot.period || "monthly",
    remaining: Math.max(0, limit - usage.used),
    atLimit: usage.used >= limit,
    loaded: true,
    upgradeHref,
  };
}

/** Header meter: "7 / 30 proposals · 23 left this month". */
export function PlanMeterChip({
  meter,
  className,
}: {
  meter: PlanMeter;
  className?: string;
}) {
  if (!meter.loaded) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] whitespace-nowrap",
        meter.atLimit
          ? "border-warn/30 bg-warn/10 text-warn"
          : "border-line bg-card text-muted",
        className
      )}
      title={`${meter.used} of ${meter.limit} ${meter.label} used on the ${meter.planName} plan (${meter.period})`}
    >
      <span className="font-semibold tabular-nums">{meter.used}</span>
      <span className="opacity-60">/ {meter.limit}</span>
      <span>{meter.label}</span>
      <span className="opacity-60">
        · {meter.atLimit ? "reset" : `${meter.remaining} left`} {meter.period}
      </span>
      {meter.atLimit && (
        <Link
          href={meter.upgradeHref}
          className="ml-0.5 font-semibold text-accent hover:underline"
        >
          Upgrade
        </Link>
      )}
    </span>
  );
}

/** "Sold on your plan?" check — drives disabled buttons and upsell screens. */
export function usePlanFeature(kind: FeatureKind) {
  const { snapshot, upgradeHref, nextPlan } = usePlan();

  return {
    /** False until the snapshot arrives, so a create button never flickers. */
    loaded: snapshot !== null,
    allowed: snapshot?.features[kind] ?? false,
    planName: snapshot?.plan ?? "",
    nextPlanName: nextPlan?.name ?? null,
    upgradeHref,
  };
}

/**
 * Replaces a locked section's body. Copy is passed in because it is prose, not
 * pricing: every number on screen still comes from the snapshot.
 */
export function PlanFeatureLock({
  title,
  body,
  feature,
  backHref,
  backLabel,
}: {
  title: string;
  body: string;
  feature: FeatureKind;
  backHref?: string;
  backLabel?: string;
}) {
  const { planName, nextPlanName, upgradeHref } = usePlanFeature(feature);

  return (
    <div className="mx-auto max-w-lg space-y-5 rounded-2xl border border-line bg-card p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Sparkles className="h-5 w-5" />
      </span>
      <div>
        <h2 className="font-display text-xl font-medium tracking-wide text-fg">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {body}
          {nextPlanName && (
            <>
              {" "}
              It is included from the <strong className="text-fg">{nextPlanName}</strong>{" "}
              plan onwards; you are on {planName || "the free plan"}.
            </>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {backHref && (
          <Link href={backHref}>
            <Button variant="outline">
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLabel || "Back to dashboard"}
            </Button>
          </Link>
        )}
        <Link href={upgradeHref}>
          <Button>
            Upgrade plan
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
