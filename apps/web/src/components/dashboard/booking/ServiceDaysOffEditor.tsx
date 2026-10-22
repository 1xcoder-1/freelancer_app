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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={newDay}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setNewDay(e.target.value)}
          className="h-9 px-3 rounded-xl bg-surface/50 border border-line text-fg text-sm focus:border-accent/60 focus:bg-card focus:outline-none focus:ring-1 focus:ring-accent/30 transition-all font-mono"
        />
        <Button
          type="button"
          size="sm"
          onClick={addDay}
          disabled={!newDay}
          className="h-9 px-3.5 rounded-xl border border-accent/40 bg-accent/15 hover:bg-accent hover:text-white text-accent text-xs font-semibold cursor-pointer shadow-[0_0_12px_rgba(212,107,40,0.1)] active:scale-95 transition-all disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Day Off
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-8 w-full rounded-xl" />
      ) : daysOff.length === 0 ? (
        <p className="text-xs text-muted">No days off added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2 pt-1">
          {daysOff.map((d) => (
            <span
              key={d}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface/80 border border-line/70 text-xs text-fg font-mono shadow-2xs hover:border-line-strong transition-all"
            >
              {d}
              <button
                type="button"
                onClick={() => removeDay(d)}
                className="text-muted hover:text-danger hover:scale-110 transition-all cursor-pointer p-0.5 rounded"
                title="Remove day off"
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
