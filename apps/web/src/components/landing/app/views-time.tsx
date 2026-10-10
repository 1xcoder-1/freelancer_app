"use client";

import * as React from "react";
import { ChevronDown, Clock, Pause, RefreshCw, Square } from "lucide-react";
import { IconButton, PageTitle } from "./primitives";

/* /dashboard/time-tracker */
export function TimeView() {
  const entries = [
    { d: "Homepage hero section", p: "Website redesign", t: "Fri, Oct 9", s: "01:12:30" },
    { d: "Focus Session", p: "Brand system", t: "Fri, Oct 9", s: "00:48:05" },
    { d: "Retainer sync", p: "Monthly retainer", t: "Thu, Oct 8", s: "01:05:00" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 pb-1">
        <PageTitle
          title="Time"
          subtitle="Start the clock, stop it, and the hours are ready to bill. It keeps counting even if you close the tab or switch devices."
        />
        <IconButton label="Refresh" />
      </div>

      <div className="space-y-4 rounded-xl border border-[#28282a] bg-[#161617] p-6 shadow-xl">
        <div className="grid grid-cols-3 items-center gap-4">
          <div>
            <label className="text-xs font-semibold text-[#a19d98]">Project</label>
            <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-[#28282a] bg-[#0e0e0f] px-3 py-2 text-sm text-[#f0efed]">
              <span className="min-w-0 truncate">Website redesign</span>
              <ChevronDown className="size-4 shrink-0 text-[#a19d98]" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#a19d98]">
              What are you doing?
            </label>
            <div className="mt-1 truncate rounded-lg border border-[#28282a] bg-[#0e0e0f] px-3 py-2 text-sm text-[#6f6b66]">
              e.g. Building the homepage
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="font-mono text-3xl font-bold text-[#6ea8dc]">02:40:11</span>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#28282a] px-3 text-sm text-[#f0efed]">
                <Pause className="size-4" />
                Pause
              </span>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#d46b28] px-3 text-sm font-semibold text-white">
                <Square className="size-4" />
                Stop &amp; Save
              </span>
            </div>
          </div>
        </div>
        <p className="border-t border-[#28282a] pt-3 text-xs text-[#6f6b66]">
          Tracking <span className="font-medium text-[#f0efed]">Website redesign</span> •
          gets billed • saving every second
        </p>
      </div>

      <div className="space-y-3">
        {entries.map((e) => (
          <div
            key={e.d}
            className="flex items-center justify-between rounded-xl border border-[#28282a] bg-[#161617] p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="rounded-xl bg-[#6ea8dc]/10 p-2.5 text-[#6ea8dc]">
                <Clock className="size-5" />
              </span>
              <div className="min-w-0">
                <h4 className="truncate text-sm font-semibold text-[#f0efed]">{e.d}</h4>
                <p className="truncate text-xs text-[#a19d98]">
                  {e.p} • {e.t}
                </p>
              </div>
            </div>
            <span className="shrink-0 font-mono text-sm font-semibold text-[#6ea8dc]">
              {e.s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
