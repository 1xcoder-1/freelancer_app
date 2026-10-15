"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Monitor, Pencil, Smartphone } from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { LinkPageRender } from "@/components/link-page/templates";
import type { LinkPage } from "@/lib/api";
import { cn } from "@/lib/utils";

export function PreviewClientView({ page }: { page: LinkPage }) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");

  const activeItems = (page.items ?? []).filter((i) => i.active !== false);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Sleek, minimal toolbar — zero extra text clutter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-line">
        {/* Left: Back button & Page name */}
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/link-page/${page.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-xl h-8 px-3 border-line text-muted hover:text-fg hover:bg-surface cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
            </Button>
          </Link>
          <span className="font-display font-medium text-sm text-fg capitalize">
            {page.name || page.display_name}
          </span>
        </div>

        {/* Center: Mobile / Desktop toggle switcher */}
        <div className="inline-flex items-center p-1 rounded-xl bg-surface border border-line">
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
              device === "mobile"
                ? "bg-card text-fg shadow-xs border border-line"
                : "text-muted hover:text-fg"
            )}
            title="Mobile preview"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile</span>
          </button>
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
              device === "desktop"
                ? "bg-card text-fg shadow-xs border border-line"
                : "text-muted hover:text-fg"
            )}
            title="Desktop preview"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Desktop</span>
          </button>
        </div>

        {/* Right: Actions (Open live & Edit — icon only) */}
        <div className="flex items-center gap-1.5">
          {page.published && (
            <a href={`/p/${page.slug}`} target="_blank" rel="noopener noreferrer">
              <Button
                variant="outline"
                size="sm"
                className="text-xs rounded-xl h-8 w-8 p-0 border-line text-muted hover:text-fg hover:bg-surface cursor-pointer transition-colors"
                title="Open live page"
                aria-label="Open live page"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
          <Link href={`/dashboard/link-page/edit/${page.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-xl h-8 w-8 p-0 border-line hover:border-line-strong bg-card hover:bg-surface text-fg cursor-pointer transition-all shadow-xs"
              title="Edit link page"
              aria-label="Edit link page"
            >
              <Pencil className="w-3.5 h-3.5 text-accent" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Preview Staging Area */}
      <div className="flex justify-center items-start py-4 px-2 min-h-[calc(100vh-160px)]">
        {device === "mobile" ? (
          /* High-Fidelity Realistic Smartphone Mockup Frame */
          <div className="relative mx-auto my-2 select-none">
            {/* Left Hardware Buttons (Action key & Volume rocker) */}
            <div className="w-[3.5px] h-7 bg-zinc-700 dark:bg-zinc-600 absolute -left-[3.5px] top-28 rounded-l-xs shadow-xs border-l border-y border-white/20" />
            <div className="w-[3.5px] h-12 bg-zinc-700 dark:bg-zinc-600 absolute -left-[3.5px] top-40 rounded-l-xs shadow-xs border-l border-y border-white/20" />
            <div className="w-[3.5px] h-12 bg-zinc-700 dark:bg-zinc-600 absolute -left-[3.5px] top-56 rounded-l-xs shadow-xs border-l border-y border-white/20" />

            {/* Right Hardware Button (Power / Side key) */}
            <div className="w-[3.5px] h-16 bg-zinc-700 dark:bg-zinc-600 absolute -right-[3.5px] top-44 rounded-r-xs shadow-xs border-r border-y border-white/20" />

            {/* Realistic Phone Body / Titanium Chassis */}
            <div className="relative w-[375px] sm:w-[385px] rounded-[54px] p-[10px] bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_25px_60px_-15px_rgba(0,0,0,0.65),0_12px_24px_-8px_rgba(0,0,0,0.4)] ring-1 ring-black/40">
              {/* Inner Screen Bezel */}
              <div className="relative rounded-[44px] p-[2px] bg-black shadow-inner overflow-hidden ring-1 ring-white/10">
                {/* iOS Status Bar */}
                <div className="absolute top-0 inset-x-0 h-11 z-30 flex items-center justify-between px-7 pt-1 pointer-events-none text-white font-sans text-xs">
                  {/* Time */}
                  <span className="font-semibold text-[13px] tracking-tight pl-1 drop-shadow-xs">9:41</span>

                  {/* Dynamic Island */}
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[114px] h-[28px] bg-black rounded-full shadow-md flex items-center justify-between px-2.5 ring-1 ring-white/10">
                    {/* Front Camera Lens with reflection */}
                    <div className="w-2.5 h-2.5 rounded-full bg-[#0a0f1d] ring-[0.5px] ring-white/15 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-[#1e293b]" />
                    </div>
                    {/* Sensor */}
                    <div className="w-1.5 h-1.5 rounded-full bg-[#14151a]" />
                  </div>

                  {/* Status Icons: Signal, Wi-Fi, Battery */}
                  <div className="flex items-center gap-1.5 pr-1 drop-shadow-xs">
                    {/* Signal bars */}
                    <svg className="w-3.5 h-3 fill-white" viewBox="0 0 17 12">
                      <rect x="0" y="8.5" width="2.5" height="3.5" rx="0.5" />
                      <rect x="4.5" y="6" width="2.5" height="6" rx="0.5" />
                      <rect x="9" y="3.5" width="2.5" height="8.5" rx="0.5" />
                      <rect x="13.5" y="0.5" width="2.5" height="11.5" rx="0.5" />
                    </svg>
                    {/* Wi-Fi */}
                    <svg className="w-3.5 h-3 fill-white" viewBox="0 0 16 12">
                      <path d="M8 9.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-4.24-3.18a6 6 0 0 1 8.48 0 .75.75 0 0 1-1.06 1.06 4.5 4.5 0 0 0-6.36 0 .75.75 0 0 1-1.06-1.06zm-2.83-2.83a10 10 0 0 1 14.14 0 .75.75 0 0 1-1.06 1.06 8.5 8.5 0 0 0-12.02 0 .75.75 0 0 1-1.06-1.06z" />
                    </svg>
                    {/* Battery */}
                    <div className="flex items-center gap-0.5">
                      <div className="w-5 h-2.5 rounded-[4px] border border-white p-0.5 flex items-center">
                        <div className="h-full w-full bg-white rounded-[2px]" />
                      </div>
                      <div className="w-[1.5px] h-1 bg-white rounded-r-[1px]" />
                    </div>
                  </div>
                </div>

                {/* Screen Viewport with smooth scroll & safe-area padding */}
                <div
                  className="rounded-[42px] bg-bg h-[720px] overflow-y-auto overflow-x-hidden scrollbar-hide flex flex-col [&>div]:min-h-full [&>div]:flex-1 pt-9 pb-8"
                  style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  <LinkPageRender
                    template={page.template}
                    inert
                    data={{
                      display_name: page.display_name,
                      headline: page.headline,
                      bio: page.bio,
                      avatar_url: page.avatar_url,
                      items: activeItems,
                    }}
                  />
                </div>

                {/* Subtle Screen Glass Sheen Overlay */}
                <div className="pointer-events-none absolute inset-0 rounded-[42px] bg-gradient-to-tr from-transparent via-transparent to-white/[0.04] z-20" />

                {/* Bottom iOS Home Indicator Bar */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/50 backdrop-blur-md rounded-full z-30 pointer-events-none shadow-sm" />
              </div>
            </div>
          </div>
        ) : (
          /* Realistic Desktop Browser Frame */
          <div className="w-full max-w-5xl rounded-2xl border border-line bg-card shadow-2xl overflow-hidden transition-all duration-300">
            {/* Browser Header Bar */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-line bg-surface/70">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <div className="mx-auto flex items-center justify-center gap-1.5 px-4 py-1 rounded-md bg-card border border-line text-xs font-mono text-muted max-w-xs w-full text-center">
                <span>/p/{page.slug}</span>
              </div>
              <div className="w-10" />
            </div>

            {/* Desktop Viewport */}
            <div
              className="h-[680px] overflow-y-auto overflow-x-hidden scrollbar-hide flex flex-col [&>div]:min-h-full [&>div]:flex-1"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              <LinkPageRender
                template={page.template}
                inert
                data={{
                  display_name: page.display_name,
                  headline: page.headline,
                  bio: page.bio,
                  avatar_url: page.avatar_url,
                  items: activeItems,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
