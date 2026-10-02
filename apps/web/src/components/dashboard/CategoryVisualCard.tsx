"use client";

import React from "react";

export function ChaiCupIcon({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Tilted Chai cup matching ChaiCode design from the reference image */}
      <g transform="rotate(10 16 16)">
        {/* Warm Orange Chai Tea Fill in the lower portion */}
        <path
          d="M9.5 12.5h13l-1.4 11.2c-.15 1.1-1.1 1.9-2.2 1.9h-5.8c-1.1 0-2.05-.8-2.2-1.9L9.5 12.5z"
          fill="#ea580c"
          className="dark:fill-[#f97316]"
        />
        {/* Glass Cup Body Outline */}
        <path
          d="M8 7h16l-1.8 17.2c-.18 1.4-1.35 2.5-2.75 2.5h-6.9c-1.4 0-2.57-1.1-2.75-2.5L8 7z"
          stroke="#9ca3af"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Glass Cup Rim */}
        <path
          d="M7 7h18"
          stroke="#9ca3af"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        {/* White Code Bracket Glyph </> inside beverage */}
        <path
          d="M12.5 17.5l-1.8 1.4 1.8 1.4M19.5 17.5l1.8 1.4-1.8 1.4M16.8 16.5l-1.6 4.8"
          stroke="#ffffff"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

interface CategoryVisualCardProps {
  title: string | any;
  currentCount?: number | string | any;
  totalCount?: number | string | any;
  topRightContent?: React.ReactNode;
  subtitle?: string | any;
  category?: string | any;
  onClick?: () => void;
  tags?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function CategoryVisualCard({
  title,
  currentCount,
  totalCount,
  topRightContent,
  subtitle = "Direct Client",
  onClick,
  tags,
  icon,
  className = "",
}: CategoryVisualCardProps) {
  // Safe extraction to prevent any [object Object] rendering
  let safeTitle = "Client Profile";
  if (typeof title === "string" && title.trim() && title.trim() !== "[object Object]" && !title.includes("[object Object]")) {
    safeTitle = title.trim();
  } else if (title && typeof title === "object") {
    const extracted = (title as any).name || (title as any).title || (title as any).label || "";
    if (typeof extracted === "string" && extracted.trim() && extracted !== "[object Object]") {
      safeTitle = extracted.trim();
    }
  }

  let cleanSubtitle = "";
  if (typeof subtitle === "string" && subtitle.trim() && subtitle.trim() !== "[object Object]" && !subtitle.includes("[object Object]")) {
    cleanSubtitle = subtitle.trim().replace(/^By\s+/i, "").trim();
  } else if (subtitle && typeof subtitle === "object") {
    const extracted = (subtitle as any).name || (subtitle as any).company_name || (subtitle as any).label || "";
    if (typeof extracted === "string" && extracted.trim() && extracted !== "[object Object]") {
      cleanSubtitle = extracted.trim().replace(/^By\s+/i, "").trim();
    }
  }

  const displaySubtitle = cleanSubtitle ? `By ${cleanSubtitle}` : "By Direct Client";

  let safeCurrent: string | null = null;
  if (typeof currentCount === "number") {
    safeCurrent = String(currentCount);
  } else if (typeof currentCount === "string" && currentCount.trim() && currentCount !== "[object Object]") {
    safeCurrent = currentCount.trim();
  }

  let safeTotal: string | null = null;
  if (typeof totalCount === "number") {
    safeTotal = String(totalCount);
  } else if (typeof totalCount === "string" && totalCount.trim() && totalCount !== "[object Object]") {
    safeTotal = totalCount.trim();
  }

  const hasCounter = safeCurrent !== null && safeTotal !== null;

  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border border-line dark:border-[#26272d] bg-card dark:bg-[#141518] hover:bg-surface/50 dark:hover:bg-[#18181c] hover:border-line-strong dark:hover:border-[#383942] p-5 sm:p-6 shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between min-h-[175px] sm:min-h-[180px] select-none transition-all duration-200 ease-out hover:-translate-y-0.5 no-scrollbar scrollbar-none ${className}`}
    >
      {/* Background Subtle Grid & Pixel Block Texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.08] transition-opacity duration-300 group-hover:opacity-[0.06] dark:group-hover:opacity-[0.11]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #ea580c 1px, transparent 1px),
            linear-gradient(to bottom, #ea580c 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(circle at 10% 15%, black 0%, transparent 65%)",
          WebkitMaskImage: "radial-gradient(circle at 10% 15%, black 0%, transparent 65%)",
        }}
      />

      {/* Subtle Warm Amber/Orange Ambient Glow at bottom right corner */}
      <div className="pointer-events-none absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-gradient-to-tl from-orange-400/20 via-amber-300/10 to-transparent dark:from-orange-500/20 dark:via-amber-500/10 dark:to-transparent blur-2xl opacity-70 dark:opacity-60 group-hover:opacity-90 dark:group-hover:opacity-80 transition-opacity duration-300" />

      {/* Top Section: Title & Fraction Counter or Top-Right Badge */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0 pr-2">
          <h4 className="font-display text-[15px] sm:text-[16.5px] font-medium text-fg dark:text-[#f4f4f5] tracking-wide line-clamp-2 transition-colors leading-snug capitalize">
            {safeTitle}
          </h4>
          {tags && <div className="flex flex-wrap items-center gap-1.5">{tags}</div>}
        </div>

        {/* Top-Right Badge or Fraction Counter */}
        {topRightContent ? (
          <div className="flex items-center shrink-0 pt-0.5">
            {topRightContent}
          </div>
        ) : hasCounter ? (
          <div className="flex items-center shrink-0 pt-0.5">
            <div className="font-mono text-sm sm:text-base font-semibold tracking-tight flex items-baseline">
              <span className="text-accent text-base sm:text-[17px] font-bold">{safeCurrent}</span>
              <span className="text-muted font-medium text-xs sm:text-sm">/{safeTotal}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom Section: "By Subtitle" & Chai Cup */}
      <div className="relative z-10 flex items-end justify-between gap-2 pt-2">
        <span className="font-display text-xs sm:text-[13px] text-muted dark:text-[#a1a1aa] font-normal tracking-wide truncate max-w-[75%] group-hover:text-fg transition-colors capitalize">
          {displaySubtitle}
        </span>
        <div className="shrink-0 transition-transform duration-300 ease-out group-hover:scale-115 group-hover:rotate-3">
          {icon || <ChaiCupIcon className="w-7 h-7" />}
        </div>
      </div>
    </div>
  );
}
