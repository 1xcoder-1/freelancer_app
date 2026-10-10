"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AppWindow, useAppCycle } from "./app/shell";

/* ------------------------------------------------------------------
   Realistic pure-CSS MacBook for the desktop showcase: dark-metal lid
   with camera dot, 16:10 screen holding the real 1280x800 dashboard,
   aluminum deck rendered in perspective with a full key grid,
   trackpad and thumb notch.
------------------------------------------------------------------- */

const SCREEN_W = 976;
const SCREEN_H = 610;

const keyRows: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1.4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.6],
  [1.7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.3],
  [1.9, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.8],
  [1.3, 1.3, 1.3, 6.6, 1.3, 1.3, 1.3],
];

function Keyboard() {
  return (
    <div className="mx-auto mt-4 w-[86%] space-y-[5px] select-none">
      {keyRows.map((row, r) => (
        <div key={r} className="flex gap-[5px]">
          {row.map((w, i) => (
            <span
              key={i}
              className="flex rounded-[4px] border-t border-white/[0.06] bg-[#1b1c1e] shadow-[inset_0_-1px_1px_rgba(0,0,0,0.5),0_1px_1px_rgba(0,0,0,0.6)]"
              style={{ flexGrow: w, flexBasis: 0, height: r === 0 ? 12 : 20 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* Lid only — used standalone in the download collage. */
export function MacLid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-t-[14px] border border-white/[0.03] bg-[linear-gradient(115deg,#090a0b_0%,#232529_22%,#0a0b0c_42%,#101113_76%,#282a2e_100%)] p-[11px] pb-[13px]",
        className
      )}
    >
      <span
        aria-hidden
        className="absolute left-1/2 top-[5px] size-[5px] -translate-x-1/2 rounded-full bg-[#1f2226] shadow-[inset_0_0_2px_rgba(0,0,0,0.9)]"
      />
      <div className="relative overflow-hidden rounded-[6px] bg-[#0b0b0b]">
        {children}
      </div>
    </div>
  );
}

/* The 1280x800 dashboard scaled onto the lid's 976px screen, cycling views. */
function MacScreen() {
  const view = useAppCycle(4500);
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: SCREEN_W, height: SCREEN_H }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: 1280,
          height: 800,
          transform: `scale(${SCREEN_W / 1280})`,
        }}
      >
        <AppWindow view={view.id} />
      </div>
      {/* glass sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 26%, rgba(255,255,255,0) 74%, rgba(255,255,255,0.02) 100%)",
        }}
      />
    </div>
  );
}

export function MacBookMock({ className }: { className?: string }) {
  return (
    <div className={cn("relative w-[1060px] select-none", className)}>
      {/* lid */}
      <div className="relative mx-auto w-[1000px] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)]">
        <MacLid>
          <MacScreen />
        </MacLid>
      </div>
      {/* hinge */}
      <div
        aria-hidden
        className="relative mx-auto h-[10px] w-[960px] rounded-b-[4px] bg-[linear-gradient(to_bottom,#17181a,#0c0d0e)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      />
      {/* deck, flattened toward the viewer */}
      <div className="[perspective:1400px]">
        <div
          className="relative mx-auto w-[1060px] rounded-b-[18px] border-t border-white/[0.07] bg-[linear-gradient(to_bottom,#3a3d41_0%,#2b2d31_18%,#1d1e21_55%,#101113_100%)] px-6 pb-5 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_36px_90px_-28px_rgba(0,0,0,0.9)]"
          style={{
            transform: "rotateX(52deg)",
            transformOrigin: "top center",
          }}
        >
          <Keyboard />
          <div className="mx-auto mt-4 flex justify-center">
            <span
              aria-hidden
              className="h-[52px] w-[260px] rounded-[8px] border border-black/40 bg-[linear-gradient(to_bottom,#2c2e32,#232529)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_4px_rgba(0,0,0,0.4)]"
            />
          </div>
          {/* front-edge thumb notch */}
          <span
            aria-hidden
            className="absolute bottom-[-10px] left-1/2 h-[14px] w-[190px] -translate-x-1/2 rounded-b-[10px] bg-[linear-gradient(to_bottom,#0c0d0e,#16181b)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]"
          />
        </div>
      </div>
    </div>
  );
}
