"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { Stagger, StaggerItem } from "@/components/landing/motion";
import {
  MobileClientsScreen,
  MobileInvoicesScreen,
  MobileTimerScreen,
} from "@/components/landing/mobile-app";

/* ========================= MOBILE SHOWCASE =========================
   Fan of three phones: sides tilted ±30° in perspective, center
   straight-on with a double-ring bezel. Each phone now runs the
   purpose-built mobile app UI (large type, bottom tabs) instead of a
   shrunk desktop dashboard.
=================================================================== */

function SidePhone({
  side,
  x,
  children,
}: {
  side: "left" | "right";
  x: MotionValue<number>;
  children: React.ReactNode;
}) {
  const left = side === "left";
  return (
    <motion.div className="relative z-0 shrink-0" style={{ x }}>
      <div
        className="relative mt-3 aspect-[9/19] w-[264px] rounded-[44px] border border-white/[0.025] py-[5px]"
        style={{
          background:
            "radial-gradient(ellipse 12px 65% at " +
            (left ? "right 58%" : "left 32%") +
            ", #34373b 0%, #1c1e21 45%, transparent 100%), #090a0b",
          boxShadow:
            "2px 0 0 #141619, 5px 0 0 #0d0f10, 6px 0 0 #1a1d21, 7px 0 0 #111214, 0 30px 80px -20px rgba(0,0,0,0.8)",
          paddingRight: left ? 5 : 2,
          paddingLeft: left ? 2 : 5,
          transform: `perspective(1000px) rotateY(${left ? -30 : 30}deg) scale(0.88)`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-[44px] top-[44px] w-[7px]"
          style={{
            [left ? "right" : "left"]: -7,
            background:
              "linear-gradient(0deg, #111214 0%, #1a1d21 18%, #131518 38%, #0b0d0e 56%, #191b1f 78%, #111214 100%)",
          }}
        />
        <div className="relative flex h-full flex-col overflow-hidden rounded-l-[42px] rounded-r-[39px] bg-[#0b0b0b] text-white">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

export function PhoneShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  // Side phones slide from the fanned ±292px position to together as the
  // section scrolls in — measured off superset.sh: linear over the section
  // top travelling from 90% to 25% of the viewport height.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.9", "start 0.25"],
  });
  const xLeft = useTransform(scrollYProgress, [0, 1], [292, 0]);
  const xRight = useTransform(scrollYProgress, [0, 1], [-292, 0]);

  return (
    <section
      ref={sectionRef}
      id="mobile"
      aria-labelledby="mobile-heading"
      className="scroll-mt-24 overflow-hidden pb-16 sm:pb-24"
    >
      <div className="mx-auto max-w-6xl px-6 text-center sm:px-8">
        <Stagger className="flex flex-col items-center">
          <StaggerItem>
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="mb-5 size-6 text-muted/40"
            >
              <path
                fillRule="evenodd"
                d="M12 2.25a.75.75 0 0 1 .75.75v16.19l6.22-6.22a.75.75 0 1 1 1.06 1.06l-7.5 7.5a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06l6.22 6.22V3a.75.75 0 0 1 .75-.75Z"
                clipRule="evenodd"
              />
            </svg>
          </StaggerItem>
          <StaggerItem>
            <h2
              id="mobile-heading"
              className="text-2xl font-normal tracking-tight text-fg sm:text-3xl"
            >
              Start work from anywhere
            </h2>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-3 text-base text-muted sm:text-lg">
              Run your whole book from your phone.
            </p>
          </StaggerItem>
        </Stagger>
        <div className="mt-12 sm:mt-20">
          <div
            aria-hidden
            className="@container pointer-events-none relative h-[396px] select-none text-left sm:h-[min(64.8cqw,648px)]"
          >
            <div className="absolute left-1/2 flex w-[880px] origin-top -translate-x-1/2 items-start justify-center gap-7 [transform:scale(0.648)] sm:[transform:scale(min(1.08,calc(90cqw/880px)))]">
              <SidePhone side="left" x={xLeft}>
                <MobileClientsScreen />
              </SidePhone>
              <div
                className="relative z-10 shrink-0"
                style={{
                  boxShadow:
                    "0 0 0 2px #090909, 0 0 0 3px #141517, 0 30px 80px -20px rgba(0,0,0,0.8)",
                  borderRadius: 44,
                }}
              >
                <div className="relative aspect-[9/19] w-[264px] rounded-[44px] border border-white/[0.025] bg-[linear-gradient(115deg,#090a0b_0%,#232529_22%,#0a0b0c_42%,#101113_76%,#282a2e_100%)] p-[5px]">
                  <div className="relative flex h-full flex-col overflow-hidden rounded-[40px] bg-[#0b0b0b] text-white">
                    <MobileTimerScreen />
                  </div>
                </div>
              </div>
              <SidePhone side="right" x={xRight}>
                <MobileInvoicesScreen />
              </SidePhone>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
