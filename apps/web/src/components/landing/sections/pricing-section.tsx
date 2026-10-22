import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Check } from "@/components/animated-icons";
import { Container, Eyebrow, Section } from "@/components/landing/layout";
import { Rise, Stagger, StaggerItem } from "@/components/landing/motion";
import { PlanCta } from "@/components/landing/sections/plan-cta";
import { getClerkPlanIds } from "@/lib/clerk-plans";
import { logHandledError } from "@/lib/log-error";
import {
  getPricingMatrix,
  planFeatureList,
  type PlanKey,
  type PricingMatrix,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

/* ============================ PRICING =============================
   Four capacities of the same book. Every number on these cards is
   the API's own (apps/api/config/pricing.json through
   GET /billing/plans), so a limit can never be advertised here that
   the server would not enforce. Shared by the home page and /pricing.
=================================================================== */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/** The tier a signed-in visitor already pays for, straight from the API. */
async function currentPlanKey(): Promise<PlanKey | null> {
  const { userId, getToken } = await auth();
  if (!userId) return null;
  try {
    const token = await getToken();
    if (!token) return null;
    const res = await fetch(`${API_URL}/api/v1/billing/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return ((await res.json()) as { tier?: PlanKey }).tier ?? null;
  } catch (err) {
    logHandledError("Could not read the visitor's plan:", err);
    return null;
  }
}

export async function PricingSection({
  showHeading = true,
  id = "pricing",
  focus,
}: {
  showHeading?: boolean;
  id?: string;
  /** The tier an upgrade CTA sent the visitor here for. */
  focus?: PlanKey;
}) {
  const matrix: PricingMatrix | null = await getPricingMatrix();
  if (!matrix) {
    // Never fall back to invented numbers: an unavailable matrix shows a link
    // to the billing page instead of a price list that may be wrong.
    return (
      <Section id={id} className="scroll-mt-20">
        <Container>
          <p className="text-center text-sm text-muted">
            Pricing is temporarily unavailable.{" "}
            <Link href="/dashboard/billing" className="text-brand underline">
              Open Billing
            </Link>
            .
          </p>
        </Container>
      </Section>
    );
  }

  const [planIds, currentKey] = await Promise.all([
    getClerkPlanIds(matrix),
    currentPlanKey(),
  ]);

  return (
    <Section id={id} className="scroll-mt-20">
      <Container>
        {showHeading && (
          <Stagger className="mx-auto max-w-2xl text-center">
            <StaggerItem>
              <Eyebrow>Pricing</Eyebrow>
            </StaggerItem>
            <StaggerItem>
              <h2 className="mt-4 text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl">
                One book, four sizes.
              </h2>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-4 text-base font-light text-muted sm:text-lg">
                Pick the room your roster needs — change it whenever the work
                does.
              </p>
            </StaggerItem>
          </Stagger>
        )}

        <Stagger
          className={cn(
            "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
            showHeading ? "mt-12" : "mt-2"
          )}
        >
          {matrix.plans.map((plan) => {
            const highlighted = Boolean(plan.highlighted) || focus === plan.key;
            const isCurrent = currentKey === plan.key;
            return (
              <StaggerItem key={plan.key} className="h-full">
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-[2px] border p-6 transition-colors",
                    highlighted
                      ? "border-brand/40 bg-brand/[0.06]"
                      : "border-fg/10 bg-fg/[0.03] hover:border-fg/20"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted/60">
                      {plan.name}
                    </span>
                    {isCurrent ? (
                      <span className="rounded-[2px] border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                        Current
                      </span>
                    ) : (
                      plan.highlighted && (
                        <span className="rounded-[2px] border border-brand/30 bg-brand/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-brand-light">
                          Most popular
                        </span>
                      )
                    )}
                  </div>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-4xl font-medium tracking-tight text-fg tabular-nums">
                      ${plan.price}
                    </span>
                    <span className="text-sm text-muted">
                      /{matrix.billingPeriod}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-muted">{plan.tagline}</p>

                  <div className="my-5 h-px bg-line/60" />

                  <ul className="flex-1 space-y-2.5">
                    {planFeatureList(plan, matrix).map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-[13px] leading-5 text-fg/85"
                      >
                        <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <PlanCta
                    planKey={plan.key}
                    planName={plan.name}
                    price={plan.price}
                    planId={planIds[plan.key]}
                    isCurrent={isCurrent}
                    highlighted={Boolean(plan.highlighted)}
                  />
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>

        <Rise className="mt-8 text-center">
          <p className="text-xs leading-5 text-muted/60">
            Billed monthly in {matrix.currency}. Your existing work stays fully
            editable on every plan — a limit only pauses adding more.
          </p>
        </Rise>
      </Container>
    </Section>
  );
}
