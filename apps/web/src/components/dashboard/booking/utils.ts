/* Shared display helpers for the Booking module pages/panels. */

import { invalidateCache } from "@/hooks/use-api-data";

/**
 * The Calls page caches `booking:calls` and the Services page `booking:services`.
 * Any booking mutation clears both, and the cache layer refetches every mounted
 * consumer immediately — no waiting for the poll.
 */
export const invalidateBookingCaches = () => invalidateCache(/^booking:(calls|services)$/);

export function fmtWhen(iso: string): string {
  return `${new Date(`${iso}Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${iso.slice(11, 16)} UTC`;
}

export const STATUS_TONE: Record<string, string> = {
  pending: "bg-warn/10 text-warn border-warn/30",
  confirmed: "bg-accent-soft text-accent border-accent/30",
  completed: "bg-ok/10 text-ok border-ok/30",
  cancelled: "bg-faint/10 text-faint border-line",
  no_show: "bg-danger/10 text-danger border-danger/30",
};
