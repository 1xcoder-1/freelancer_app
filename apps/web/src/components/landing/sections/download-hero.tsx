"use client";

import { RadialGlow } from "@/components/landing/layout";
import { Rise } from "@/components/landing/motion";
import {
  MobileClientsScreen,
  MobileInvoicesScreen,
} from "@/components/landing/mobile-app";

/* ========================= DOWNLOAD HERO ==========================
   The /download page's opening visual: two large phones leaning
   toward each other in perspective over a brand glow — the app
   screens are the real native UIs, tilted like the reference shot.
=================================================================== */

function LeaningPhone({
  lean,
  z,
  children,
}: {
  lean: "left" | "right";
  z: number;
  children: React.ReactNode;
}) {
  const left = lean === "left";
  return (
    <div
      className="relative aspect-[9/19] w-[280px] shrink-0 rounded-[46px] border border-white/[0.025] p-[6px]"
      style={{
        zIndex: z,
        background:
          "linear-gradient(115deg,#090a0b 0%,#232529 22%,#0a0b0c 42%,#101113 76%,#282a2e 100%)",
        boxShadow:
          "0 0 0 2px #090909, 0 0 0 3px #141517, 0 40px 90px -24px rgba(0,0,0,0.85)",
        transform: `perspective(1400px) rotateY(${left ? 22 : -18}deg) rotateZ(${
          left ? -7 : 5
        }deg) translateY(${left ? 18 : -10}px)`,
        marginRight: left ? -56 : 0,
      }}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[41px] bg-[#0b0b0b] text-white">
        {children}
      </div>
    </div>
  );
}

export function DownloadHeroVisual() {
  return (
    <Rise className="relative -mt-6 overflow-x-clip pb-10 sm:pb-16">
      <RadialGlow />
      <div className="relative z-10 flex justify-center">
        <div className="flex scale-[0.68] items-center sm:scale-90 lg:scale-100">
          <LeaningPhone lean="left" z={2}>
            <MobileClientsScreen />
          </LeaningPhone>
          <LeaningPhone lean="right" z={1}>
            <MobileInvoicesScreen />
          </LeaningPhone>
        </div>
      </div>
    </Rise>
  );
}
