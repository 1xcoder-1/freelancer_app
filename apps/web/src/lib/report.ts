import * as Sentry from "@sentry/nextjs";
import type { ApiError } from "@/lib/api";

/**
 * Shared load-error reporting for dashboard/feature pages.
 *
 * Pages intentionally degrade to empty states on fetch failures (skeletons
 * resolve, lists show "no data"), but a silently swallowed error means Sentry
 * never sees a real outage. reportLoadError keeps the UI behavior and attaches
 * the page tag for grouping. Axios classifies 5xx/network failures centrally
 * in src/lib/api.ts, so this helper only handles the page-originated errors
 * (4xx with unexpected context, auth token failures, etc.).
 */
const reported = new Set<string>();

export function reportLoadError(err: unknown, page: string): void {
  const status = (err as ApiError)?.status;
  // Expected user-facing states: 4xx (expired share links, revoked tokens,
  // validation) are handled by the UI and must not pollute Sentry.
  if (typeof status === "number" && status >= 400 && status < 500) return;

  const message = err instanceof Error ? err.message : String(err);
  // Refresh-click loops re-raise the identical error; report each once.
  const key = `${page}::${status ?? "network"}::${message}`;
  if (reported.has(key)) return;
  if (reported.size > 100) reported.clear();
  reported.add(key);

  Sentry.withScope((scope) => {
    scope.setTag("page", page);
    if (typeof status === "number") scope.setContext("api", { status });
    Sentry.captureException(err instanceof Error ? err : new Error(message));
  });
}
