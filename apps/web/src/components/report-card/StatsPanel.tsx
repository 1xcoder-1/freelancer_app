"use client";

import React, { useMemo } from "react";
import { Flame, Eye } from "@/components/animated-icons";
import type { DeliveryStats, HeatmapCell } from "@/lib/api";

interface StatsPanelProps {
  accent: string;
  currentStreak: number;
  maxStreak: number;
  activeDaysCount: number;
  viewsCount: number;
  deliveryStats: DeliveryStats;
  heatmap: HeatmapCell[];
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || "").replace("#", "");
  if (clean.length !== 6) return `rgba(234, 99, 17, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * The GitHub-style delivery stats (radial gauge, scope bars, 365-day heatmap)
 * folded into the minimal reference layout: mono eyebrow label, dotted
 * dividers and no card chrome. All numbers come from the owner's real Neon
 * projects / milestones / time entries.
 */
export function StatsPanel({
  accent,
  currentStreak,
  maxStreak,
  activeDaysCount,
  viewsCount,
  deliveryStats,
  heatmap,
}: StatsPanelProps) {
  const weeks = useMemo(() => {
    const grouped: HeatmapCell[][] = [];
    for (let i = 0; i < (heatmap || []).length; i += 7) {
      grouped.push(heatmap.slice(i, i + 7));
    }
    return grouped;
  }, [heatmap]);

  const solved = deliveryStats?.total_solved || 0;
  const target = deliveryStats?.total_target || 0;
  const percentage =
    target > 0 ? Math.min(100, Math.round((solved / target) * 100)) : 0;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const easy = deliveryStats?.easy || { solved: 0, total: 0 };
  const medium = deliveryStats?.medium || { solved: 0, total: 0 };
  const hard = deliveryStats?.hard || { solved: 0, total: 0 };
  const pct = (s: number, t: number) => (t > 0 ? Math.round((s / t) * 100) : 0);

  const levelColor = (level: number) => {
    if (level <= 0) return "var(--surface)";
    return hexToRgba(accent, 0.3 + level * 0.175);
  };

  return (
    <section id="activity" className="pt-10">
      <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-faint mb-5">
        Activity &amp; delivery
      </p>

      {/* Compact stat strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted mb-8">
        <span className="inline-flex items-center gap-1.5">
          <Flame className="w-4 h-4" style={{ color: accent }} />
          <span className="font-mono font-bold text-fg">
            {currentStreak}
          </span>{" "}
          day streak
        </span>
        <span>
          best <span className="font-mono font-bold text-fg">{maxStreak}</span>{" "}
          days
        </span>
        <span>
          <span className="font-mono font-bold text-fg">{activeDaysCount}</span>{" "}
          active days
        </span>
        <span>
          <span className="font-mono font-bold text-fg">{solved}</span>/
          <span className="font-mono text-fg">{target}</span> delivered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Eye className="w-4 h-4" />
          <span className="font-mono font-bold text-fg">
            {viewsCount || 0}
          </span>{" "}
          views
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-center pb-8">
        {/* Radial completion gauge */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
            <circle
              cx="70"
              cy="70"
              r={radius}
              stroke="var(--line)"
              strokeWidth="10"
              fill="transparent"
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              stroke={accent}
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-xl font-mono font-bold text-fg">
              {percentage}%
            </span>
            <span className="text-[10px] font-mono uppercase text-faint">
              on time
            </span>
          </div>
        </div>

        {/* Scope breakdown bars */}
        <div className="space-y-3">
          {[
            { label: "Small projects", stat: easy, color: "var(--ok)" },
            { label: "Mid-size builds", stat: medium, color: "var(--warn)" },
            { label: "Enterprise work", stat: hard, color: "var(--danger)" },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted">{row.label}</span>
                <span className="font-mono text-fg">
                  {row.stat.solved}/{row.stat.total} (
                  {pct(row.stat.solved, row.stat.total)}%)
                </span>
              </div>
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--surface)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct(row.stat.solved, row.stat.total)}%`,
                    background: row.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 365-day contribution heatmap */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-1 min-w-[680px]">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-1">
              {week.map((cell, cIdx) => (
                <div
                  key={cIdx}
                  title={`${cell.date}: ${cell.count} activities`}
                  className="w-2.5 h-2.5 rounded-[3px] transition-transform hover:scale-125"
                  style={{ background: levelColor(cell.level) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
        <span>Last 12 months of tracked work</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className="w-2.5 h-2.5 rounded-[3px]"
              style={{ background: levelColor(level) }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  );
}
