"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Ban, Plus, X } from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { addBlockedDay, listBlockedDays, removeBlockedDay } from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { invalidateBookingCaches } from "@/components/dashboard/booking/utils";

/* Days off, scoped to one consultation and surfaced where the service itself
   lives (Services card expansion, service edit page). */
export function ServiceDaysOffEditor({ consultationId }: { consultationId: string }) {
  const { getToken } = useAuth();
  const [newDay, setNewDay] = useState("");

  const key = `booking:days-off:${consultationId}`;
  const { data, loading, refresh } = useApiData<string[]>(
    key,
    async (token) => listBlockedDays(consultationId, token).catch(() => []),
    { reportContext: "booking-days-off" }
  );
  const daysOff = data ?? [];

  const addDay = async () => {
    if (!newDay) return;
    try {
      const token = (await getToken()) || undefined;
      await addBlockedDay(consultationId, newDay, token);
      setNewDay("");
      invalidateCache(key);
      invalidateBookingCaches();
      await refresh(true);
      toast.success("Day off added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the day off");
    }
  };

  const removeDay = async (date: string) => {
    try {
      const token = (await getToken()) || undefined;
      await removeBlockedDay(consultationId, date, token);
      invalidateCache(key);
      invalidateBookingCaches();
      await refresh(true);
      toast.success("Day is bookable again");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the day off");
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-line bg-bg/60 p-4">
      <div className="flex items-center gap-2 text-xs">
        <Ban className="w-3.5 h-3.5 text-warn" />
        <span className="font-medium text-fg">Days off</span>
        <span className="text-muted">— these dates disappear from the booking page</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={newDay}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setNewDay(e.target.value)}
          className="h-9 px-3 rounded-xl bg-bg border border-line text-fg text-sm focus:border-accent focus:outline-none transition-all"
        />
        <Button
          type="button"
          size="sm"
          onClick={addDay}
          disabled={!newDay}
          className="h-9 bg-accent hover:bg-accent-hi text-accent-fg text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add day off
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-8 w-full rounded-xl" />
      ) : daysOff.length === 0 ? (
        <p className="text-xs text-faint">No days off — every working day is bookable.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {daysOff.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface border border-line text-xs text-fg font-mono"
            >
              {d}
              <button
                type="button"
                onClick={() => removeDay(d)}
                className="text-faint hover:text-danger transition-colors cursor-pointer"
                title="Make this day bookable"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
