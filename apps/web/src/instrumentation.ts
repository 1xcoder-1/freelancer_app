import * as Sentry from "@sentry/nextjs";

// Next.js convention: this file MUST stay at src/instrumentation.ts.
// Sentry runtime configs live in @/config (src/config/).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { default: EventEmitter } = await import("node:events");
    EventEmitter.defaultMaxListeners = 30;
    await import("./config/sentry.server");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./config/sentry.edge");
  }
}

export const onRequestError = Sentry.captureRequestError;
