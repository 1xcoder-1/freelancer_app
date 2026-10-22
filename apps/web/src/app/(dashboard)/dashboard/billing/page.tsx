"use client";

import Link from "next/link";
import { PricingTable } from "@clerk/nextjs";
import {
  CalendarDays,
  CreditCard,
  Globe,
  Layers,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "@/components/animated-icons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/patterns";
import { usePlan } from "@/hooks/use-plan";
import type { CapacityKind, MeterKind } from "@/lib/plans";

/* Billing — the account's own copy of the plan the API enforces.
   Every number here is the snapshot from GET /billing/me, so a meter on this
   page can never disagree with the wall a request actually hits. Checkout
   itself stays Clerk's. */

const CAPACITY_ORDER: CapacityKind[] = [
  "clients",
  "projects",
  "services",
  "link_pages",
  "portfolios",
];
const METER_ORDER: MeterKind[] = ["proposals", "ai_asks"];

const CAPACITY_ICONS: Record<CapacityKind, React.ElementType> = {
  clients: Users,
  projects: Layers,
  services: CalendarDays,
  link_pages: Globe,
  portfolios: Sparkles,
};

const money = (cents: number | null, currency: string | null) =>
  cents === null
    ? "—"
    : `${currency === "USD" ? "$" : `${currency} `}${(cents / 100).toFixed(2)}`;

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" })
    : "—";

export default function BillingPage() {
  const { snapshot, definition, ready, loading } = usePlan({
    freshOnMount: true,
  });

  const sub = snapshot?.subscription ?? null;
  const due = snapshot?.status === "past_due";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
              Billing &amp; usage
            </h1>
            {snapshot && (
              <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-[10px] font-semibold uppercase tracking-wider">
                {snapshot.plan}
                {snapshot.is_owner && " · owner"}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            Live usage against your plan. Clerk handles the payment; this page
            only mirrors what the server already enforces.
          </p>
        </div>

        <Link
          href="/pricing"
          className="press inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-line bg-card px-3.5 text-xs font-medium text-fg transition-colors hover:bg-surface self-start sm:self-auto"
        >
          Compare plans
        </Link>
      </div>

      {!ready || !snapshot ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-[172px] w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 enter-stagger">
            <StatCard
              label="Current plan"
              value={snapshot.plan}
              icon={CreditCard}
              rows={[
                {
                  text:
                    snapshot.price === 0
                      ? "Free forever"
                      : `$${snapshot.price} / month`,
                  dot: "info",
                },
                {
                  text: due
                    ? "Payment due — card needs attention"
                    : snapshot.status
                      ? snapshot.status.replace("_", " ")
                      : "No subscription",
                  dot: due ? "warn" : "ok",
                },
              ]}
            />

            {sub && (
              <StatCard
                label="Subscription"
                value={money(sub.amount_cents, sub.currency)}
                icon={Wallet}
                rows={[
                  { text: sub.plan_name || "Clerk plan", dot: "info" },
                  {
                    text: `${day(sub.period_start)} → ${day(sub.period_end)}`,
                    dot: due ? "warn" : "ok",
                  },
                  {
                    text: `Synced ${day(sub.synced_at)} via ${sub.source || "sync"}`,
                    dot: "info",
                  },
                ]}
              />
            )}

            {CAPACITY_ORDER.map((kind) => {
              const usage = snapshot.capacities[kind];
              if (!usage) return null;
              const slots =
                usage.limit === null
                  ? null
                  : Math.max(0, usage.limit - usage.used);
              const full = slots === 0;
              return (
                <StatCard
                  key={kind}
                  label={usage.label}
                  value={
                    usage.unlimited
                      ? `${usage.used} · unlimited`
                      : `${usage.used} / ${usage.limit}`
                  }
                  icon={CAPACITY_ICONS[kind]}
                  href={usage.href || undefined}
                  rows={[
                    {
                      text: usage.unlimited
                        ? "Owner account — no cap"
                        : full
                          ? "Limit reached — upgrade for more"
                          : `${slots} ${slots === 1 ? "slot" : "slots"} left`,
                      dot: usage.unlimited ? "info" : full ? "warn" : "ok",
                    },
                  ]}
                />
              );
            })}

            {METER_ORDER.map((kind) => {
              const usage = snapshot.meters[kind];
              if (!usage) return null;
              const left = Math.max(0, Number(usage.limit ?? 0) - usage.used);
              return (
                <StatCard
                  key={kind}
                  label={`${usage.label} · this month`}
                  value={`${usage.used} / ${usage.limit}`}
                  icon={TrendingUp}
                  href={usage.href || undefined}
                  rows={[
                    {
                      text:
                        usage.limit === 0
                          ? "Not on this plan"
                          : left === 0
                            ? `Used up — resets after ${snapshot.period}`
                            : `${left} left in ${snapshot.period}`,
                      dot: left === 0 ? "warn" : "ok",
                    },
                  ]}
                />
              );
            })}
          </div>

          {!snapshot.sync_configured && (
            <div className="rounded-2xl border border-warn/25 bg-warn/[0.06] p-4 text-xs text-warn">
              Plan sync is not configured on this deployment
              (BILLING_SYNC_SECRET), so a Clerk subscription cannot reach the
              API and every account stays on Free.
            </div>
          )}

          <div className="rounded-2xl border border-line bg-card p-5 sm:p-7">
            <div className="mb-5 flex flex-col gap-1">
              <h2 className="font-display text-sm sm:text-[15px] font-medium text-fg">
                Plans
              </h2>
              <p className="text-xs text-muted">
                {definition
                  ? `You are on ${definition.name} ($${definition.price}/month). Upgrades apply immediately.`
                  : "Upgrades apply immediately."}
              </p>
            </div>

            <PricingTable
              newSubscriptionRedirectUrl="/dashboard/billing"
              appearance={{
                variables: {
                  colorPrimary: "var(--accent)",
                  colorBackground: "var(--card)",
                  colorText: "var(--fg)",
                  colorMutedForeground: "var(--muted)",
                  colorMuted: "var(--surface)",
                  colorInput: "var(--surface)",
                  colorInputForeground: "var(--fg)",
                  colorNeutral: "var(--fg)",
                  colorBorder: "var(--line)",
                  borderRadius: "0.75rem",
                  fontFamily: "inherit",
                },
              }}
            />
          </div>
        </>
      )}

      {loading && !ready && (
        <p className="text-center text-xs text-muted">Loading your plan…</p>
      )}
    </div>
  );
}
