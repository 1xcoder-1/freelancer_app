"use client";

import React from "react";
import { Sun, Sunrise, Sunset, Moon, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface WelcomeToastProps {
  toastId: string | number;
  userName?: string;
}

export function WelcomeToast({ toastId, userName }: WelcomeToastProps) {
  const now = new Date();
  const hour = now.getHours();

  let salutation = "Good morning";
  let Icon = Sun;
  let bgBadge = "bg-amber-500/15 border-amber-500/30 text-amber-400";
  let glowColor = "rgba(245, 158, 11, 0.12)";

  if (hour >= 5 && hour < 12) {
    salutation = "Good morning";
    Icon = Sunrise;
    bgBadge = "bg-amber-500/15 border-amber-500/30 text-amber-400";
    glowColor = "rgba(245, 158, 11, 0.14)";
  } else if (hour >= 12 && hour < 17) {
    salutation = "Good afternoon";
    Icon = Sun;
    bgBadge = "bg-orange-500/15 border-orange-500/30 text-orange-400";
    glowColor = "rgba(249, 115, 22, 0.14)";
  } else if (hour >= 17 && hour < 22) {
    salutation = "Good evening";
    Icon = Sunset;
    bgBadge = "bg-indigo-500/15 border-indigo-500/30 text-indigo-400";
    glowColor = "rgba(99, 102, 241, 0.16)";
  } else {
    salutation = "Good night";
    Icon = Moon;
    bgBadge = "bg-violet-500/15 border-violet-500/30 text-violet-400";
    glowColor = "rgba(139, 92, 246, 0.14)";
  }

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const name = userName?.trim();
  const greeting = name ? `${salutation}, ${name}!` : `${salutation}!`;

  return (
    <div
      className="relative flex items-center justify-between gap-3.5 w-full sm:w-[380px] p-3.5 rounded-2xl bg-card/95 backdrop-blur-xl border border-line shadow-2xl shadow-black/50 select-none overflow-hidden transition-all animate-in fade-in slide-in-from-top-2 duration-300"
      style={{
        backgroundImage: `radial-gradient(circle at 12% 25%, ${glowColor}, transparent 65%)`,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Glow Badge Icon */}
        <div
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${bgBadge}`}
        >
          <Icon className="w-5 h-5 animate-pulse" style={{ animationDuration: "3s" }} />
        </div>

        {/* Text Container: Time zone and region cleanly excluded */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-semibold text-fg tracking-tight truncate">
              {greeting}
            </span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
          </div>
          <p className="text-xs text-muted truncate mt-0.5 font-normal">
            {dateStr} • Welcome back to your workspace
          </p>
        </div>
      </div>

      {/* Clean In-Card Close Button */}
      <button
        type="button"
        onClick={() => toast.dismiss(toastId)}
        className="shrink-0 p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface/80 border border-transparent hover:border-line transition-all cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function showWelcomeToast(userName?: string) {
  toast.custom((id) => <WelcomeToast toastId={id} userName={userName} />, {
    duration: 4500,
  });
}
