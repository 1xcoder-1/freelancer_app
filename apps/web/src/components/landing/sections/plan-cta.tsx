"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { cn } from "@/lib/utils";

/**
 * The single CTA on a pricing card. Clerk owns payment, so a signed-in visitor
 * gets a real checkout button (no round trip through the dashboard); an
 * anonymous one is sent to sign-up and brought back to this same card.
 */
export function PlanCta({
  planKey,
  planName,
  price,
  planId,
  isCurrent,
  highlighted,
}: {
  planKey: string;
  planName: string;
  price: number;
  planId?: string;
  isCurrent: boolean;
  highlighted: boolean;
}) {
  const { isSignedIn, isLoaded } = useAuth();

  const shell = cn(
    "mt-6 w-full",
    // Clerk renders a bare <button>; the card's own CTA styling is applied to it
    // so the checkout button is indistinguishable from the links beside it.
    "[&>button]:w-full [&>button]:cursor-pointer [&>button]:rounded-[2px] [&>button]:px-4 [&>button]:py-2.5 [&>button]:text-sm [&>button]:font-medium [&>button]:transition-colors",
    highlighted
      ? "[&>button]:bg-fg [&>button]:text-bg [&>button]:hover:bg-brand [&>button]:hover:text-white"
      : "[&>button]:border [&>button]:border-line [&>button]:bg-bg [&>button]:text-fg [&>button]:hover:bg-surface"
  );

  const linkClasses = cn(
    "mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-[2px] px-4 py-2.5 text-sm font-medium transition-colors",
    highlighted
      ? "bg-fg text-bg hover:bg-brand hover:text-white"
      : "border border-line bg-bg text-fg hover:bg-surface"
  );

  const returnHere = `/sign-up?redirect_url=${encodeURIComponent(`/pricing?focus=${planKey}`)}`;

  // Clerk's session state is unknown during SSR: render the same destination the
  // signed-out visitor would get, so the card never flashes a checkout button.
  if (!isLoaded) {
    return (
      <Link href={returnHere} className={linkClasses}>
        {price === 0 ? "Start for free" : `Choose ${planName}`}
        <span aria-hidden>→</span>
      </Link>
    );
  }

  if (isSignedIn) {
    if (isCurrent) {
      return (
        <Link href="/dashboard/billing" className={linkClasses}>
          Your current plan
        </Link>
      );
    }
    if (price === 0) {
      return (
        <Link href="/dashboard" className={linkClasses}>
          Open your workspace
          <span aria-hidden>→</span>
        </Link>
      );
    }
    // Clerk Billing not configured for this instance: the in-app table is the
    // only path that can start a payment, so the card still leads somewhere real.
    if (!planId) {
      return (
        <Link href={`/dashboard/billing?focus=${planKey}`} className={linkClasses}>
          Choose {planName}
          <span aria-hidden>→</span>
        </Link>
      );
    }
    return (
      <div className={shell}>
        <CheckoutButton
          planId={planId}
          planPeriod="month"
          newSubscriptionRedirectUrl="/dashboard/billing"
        >
          {`Choose ${planName}`}
        </CheckoutButton>
      </div>
    );
  }

  if (price === 0) {
    return (
      <Link href={returnHere} className={linkClasses}>
        Start for free
        <span aria-hidden>→</span>
      </Link>
    );
  }
  return (
    <Link href={returnHere} className={linkClasses}>
      Choose {planName}
      <span aria-hidden>→</span>
    </Link>
  );
}
