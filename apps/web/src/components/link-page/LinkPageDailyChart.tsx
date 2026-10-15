"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const VIEWS_COLOR = "#10b981";
const CLICKS_COLOR = "#818cf8";

function fmtDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string; dataKey: string }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const d = label
    ? new Date(`${label}T00:00:00Z`).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <div className="rounded-xl border border-line bg-card/95 backdrop-blur-md px-3.5 py-2.5 shadow-xl text-xs space-y-2 min-w-[140px]">
      <p className="text-[11px] font-medium text-muted">{d}</p>
      <div className="space-y-1.5 pt-0.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.name}</span>
            </span>
            <span className="font-mono font-semibold text-fg tabular-nums">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LinkPageDailyChart({
  daily,
  compact = false,
}: {
  daily: { date: string; views: number; clicks: number }[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "h-44 w-full" : "h-56 w-full pt-1"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={daily} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="lpViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={VIEWS_COLOR} stopOpacity={0.22} />
              <stop offset="100%" stopColor={VIEWS_COLOR} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="lpClicks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CLICKS_COLOR} stopOpacity={0.22} />
              <stop offset="100%" stopColor={CLICKS_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDay}
            tick={{ fontSize: 10, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            width={28}
            tick={{ fontSize: 10, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="views"
            name="Views"
            stroke={VIEWS_COLOR}
            strokeWidth={2}
            fill="url(#lpViews)"
            activeDot={{ r: 4, fill: VIEWS_COLOR, stroke: "#18181b", strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey="clicks"
            name="Clicks"
            stroke={CLICKS_COLOR}
            strokeWidth={2}
            fill="url(#lpClicks)"
            activeDot={{ r: 4, fill: CLICKS_COLOR, stroke: "#18181b", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
