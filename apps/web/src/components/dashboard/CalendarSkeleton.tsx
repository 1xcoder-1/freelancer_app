import React from "react";

export function CalendarSkeleton() {
  return (
    <div
      className="relative flex flex-col h-[calc(100vh-8rem)] min-h-[520px] bg-card text-fg overflow-hidden rounded-2xl border border-line animate-pulse"
      aria-busy="true"
      aria-label="Loading calendar"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-14 shrink-0 border-b border-line/40">
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Nav arrows skeleton */}
          <div className="h-8 w-16 rounded-lg bg-surface/60 border border-line" />
          {/* Today button skeleton */}
          <div className="h-8 w-14 rounded-lg bg-surface/60 border border-line" />
          {/* Month/Year title skeleton */}
          <div className="flex items-center h-8 pl-1">
            <div className="h-5 w-28 rounded-md bg-surface" />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Google button skeleton */}
          <div className="h-8 w-18 rounded-lg bg-surface/60 border border-line" />
          {/* Day / Week / Month switcher skeleton */}
          <div className="h-8 w-34 rounded-lg bg-surface/80 border border-line-strong" />
          {/* New Event button skeleton */}
          <div className="h-8 w-26 rounded-lg bg-accent/20 border border-accent/30" />
        </div>
      </div>

      {/* Month Cells Grid */}
      <div className="flex-1 min-h-0 px-3 pb-3 md:px-5 md:pb-5 pt-3 flex flex-col">
        <div className="grid grid-cols-7 flex-1 min-h-0 border-t border-l border-line rounded-xl overflow-hidden">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="border-r border-b border-line p-1.5 md:p-2 min-h-[72px] md:min-h-[96px] flex flex-col justify-between"
            >
              <div className="flex justify-center pt-1">
                <div className="w-5 h-5 rounded-full bg-surface/60" />
              </div>
              <div className="mt-auto space-y-1 pb-1">
                {i % 3 === 0 && (
                  <div className="h-3.5 w-4/5 rounded bg-accent/15 border border-accent/20" />
                )}
                {i % 4 === 1 && (
                  <div className="h-3.5 w-3/4 rounded bg-surface/70" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
