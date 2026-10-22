import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { logHandledError } from "@/lib/log-error";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const SYNC_SECRET = process.env.BILLING_SYNC_SECRET || "";

type ClerkMoney = { amount: number; currency: string } | undefined;

const cents = (money: ClerkMoney) => (typeof money?.amount === "number" ? money.amount : null);
const currencyOf = (money: ClerkMoney) => money?.currency ?? null;
const iso = (ms: number | null | undefined) =>
  typeof ms === "number" ? new Date(ms).toISOString() : null;

/**
 * The signed-in user's plan, straight from the API that enforces it.
 *
 * Before asking, this route re-reads the Clerk subscription server-side and
 * writes the resulting tier into the API (PUT /billing/sync, signed with
 * BILLING_SYNC_SECRET). That is the only path by which a paid tier reaches
 * enforcement — a browser holding a Clerk token cannot claim one — and it is
 * why the admin's plan is correct even before Clerk's webhook fires.
 *
 * A sync failure is never allowed to inflate a plan: the API then falls back to
 * whatever tier it already stored (Free for a brand-new account), and the
 * dashboard still renders.
 */
export async function GET() {
  const { userId, sessionClaims, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let syncError: string | null = null;
  try {
    const client = await clerkClient();
    const subscription = await client.billing.getUserBillingSubscription(userId);
    const item = subscription.subscriptionItems.find(
      (entry) => entry.status === "active" || entry.status === "past_due"
    );

    let plan = item?.plan ?? null;
    if (!plan && item?.planId) {
      const planList = await client.billing.getPlanList({ payerType: "user" });
      plan = planList.data.find((candidate) => candidate.id === item.planId) ?? null;
    }

    // Only a live subscription syncs to a paid tier. With no subscription at
    // all nothing is written: the stored row (and any owner override the API
    // applies server-side) decides the plan.
    if (item) {
      const res = await fetch(`${API_URL}/api/v1/billing/sync`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-billing-sync-secret": SYNC_SECRET,
        },
        body: JSON.stringify({
          clerk_id: userId,
          status: subscription.status,
          plan_name: plan?.name ?? null,
          amount_cents: cents(item.amount) ?? cents(plan?.fee),
          currency: currencyOf(item.amount) ?? currencyOf(plan?.fee),
          period_start: iso(item.periodStart),
          period_end: iso(item.periodEnd),
          source: "clerk_sync",
        }),
      });
      if (!res.ok) {
        syncError = `sync HTTP ${res.status}`;
        logHandledError("Billing sync refused:", new Error(await res.text()));
      }
    }
  } catch (err) {
    // Billing not enabled for this instance, or Clerk unreachable: not fatal.
    syncError = err instanceof Error ? err.message : "sync failed";
    logHandledError("Could not read the Clerk subscription:", err);
  }

  try {
    const token = await getToken();
    const res = await fetch(`${API_URL}/api/v1/billing/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    });
    if (!res.ok) {
      logHandledError("Plan snapshot fetch failed:", new Error(`HTTP ${res.status}`));
      return NextResponse.json(
        { error: "Could not load your plan", sync: syncError },
        { status: 502 }
      );
    }
    const snapshot = await res.json();
    // Email is only ever a diagnostic here; the plan itself is the API's answer.
    return NextResponse.json({ ...snapshot, account_email: sessionClaims?.email ?? null });
  } catch (err) {
    logHandledError("Plan snapshot fetch failed:", err);
    return NextResponse.json(
      { error: "Could not load your plan", sync: syncError },
      { status: 502 }
    );
  }
}
