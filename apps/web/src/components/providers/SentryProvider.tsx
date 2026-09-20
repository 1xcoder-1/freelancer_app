"use client";

/**
 * Sentry is initialized for the browser in `src/instrumentation-client.ts`,
 * which is the mechanism @sentry/nextjs v10 actually loads (auto-injected
 * into the client bundle by withSentryConfig).
 *
 * This provider is intentionally a passthrough — calling Sentry.init()
 * again here would be a double initialization (the SDK warns and ignores it).
 */
export function SentryProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
