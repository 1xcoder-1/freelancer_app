import * as Sentry from "@sentry/nextjs";

// Next.js / @sentry/nextjs convention: this file MUST stay at
// src/instrumentation-client.ts so the browser runtime can discover it.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
    debug: false,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,

    // Filter out noise that isn't a real app error
    ignoreErrors: [
      // Router throws its own special errors for navigation handling
      /NEXT_REDIRECT/,
      /Dynamic server usage/,
      // Browser extensions (ad blockers etc.)
      /chrome-extension:\/\//,
      /moz-extension:\/\//,
    ],
  });
}

// Required by @sentry/nextjs to trace App Router navigations
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
