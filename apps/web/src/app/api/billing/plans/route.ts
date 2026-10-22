import { NextResponse } from "next/server";
import { getPricingMatrix } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * Read-only proxy for the pricing matrix so client components (paywall screens,
 * upgrade cards) can render the same numbers the marketing page and the API's
 * enforcement use. Contains no user data.
 */
export async function GET() {
  const matrix = await getPricingMatrix();
  if (!matrix) {
    return NextResponse.json({ error: "Pricing unavailable" }, { status: 503 });
  }
  return NextResponse.json(matrix);
}
