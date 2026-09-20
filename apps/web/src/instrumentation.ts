import * as Sentry from "@sentry/nextjs";

// Next.js convention: this file MUST stay at src/instrumentation.ts.
// Sentry runtime configs live in @/config (src/config/).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./config/sentry.server");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./config/sentry.edge");
  }
}

export const onRequestError = Sentry.captureRequestError;
