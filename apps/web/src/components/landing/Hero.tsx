"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { AppWindow, useAppCycle } from "@/components/landing/app";
import { MkButton, MkIconButton } from "@/components/landing/layout";

/* ------------------------------------------------------------------
   Hero — superset.sh hero grammar (announcement pill, tracking-tight
   headline with corner brackets and block caret, sliding-icon CTA,
   floating window) showing the real Freelance Book dashboard.
------------------------------------------------------------------- */

const chunk = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: "easeOut" as const },
});

function useFitScale(designWidth: number) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.56);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.max(0.25, el.clientWidth / designWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [designWidth]);
  return { ref, scale };
}

function AppShowcase() {
  const view = useAppCycle(5000);
  const { ref, scale } = useFitScale(1280);

  return (
    <div className="relative mt-16 w-full px-2 sm:mt-24 lg:mt-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-[15%] bottom-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 18%, rgba(232,128,74,0.08), rgba(232,128,74,0.02) 55%, transparent 78%)",
        }}
      />
      {/* Agenforce-style 3D-tilted dashboard. The window is deliberately
          narrower than the viewport and centered: at rotateZ 33° the tilted
          bounding box grows ~half a window-height sideways, so a full-bleed
          window pushed its top-right corner off screen. */}
      <div className="mx-auto w-[72%] max-w-[880px] [perspective:4000px]">
        <div
          ref={ref}
          className="relative overflow-hidden rounded-xl border border-line bg-bg shadow-[0_1px_1px_rgba(0,0,0,0.4),0_16px_40px_-12px_rgba(0,0,0,0.6),0_32px_90px_-24px_rgba(0,0,0,0.75)]"
          style={{
            height: 800 * scale,
            transform: "rotateX(41.7deg) rotateY(-15.2deg) rotateZ(33.1deg)",
            transformOrigin: "50% 42%",
            maskImage: "linear-gradient(to bottom, black 40%, transparent 92%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 40%, transparent 92%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 rounded-xl ring-1 ring-inset ring-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[20%] bg-gradient-to-b from-transparent to-bg"
          />
          {/* scaled 1280×800 real dashboard UI */}
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: 1280, height: 800, transform: `scale(${scale})` }}
          >
            <AppWindow view={view.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <div className="relative flex flex-col items-center overflow-hidden pb-16 pt-24 sm:pb-24 sm:pt-32 lg:pt-40">
      {/* backdrop: masked dot grid + brand glow (superset hero canvas stand-in) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 65%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 65%)",
        }}
      >
        <div className="mk-dot-grid absolute inset-0" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 45% 35% at 50% 25%, rgba(232,128,74,0.06), transparent 70%)",
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-6 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <motion.div {...chunk(0)}>
            <Link
              href="/features#ai"
              className="group mb-6 sm:mb-8 inline-flex max-w-full items-center gap-2 rounded-[2px] border border-line bg-bg/80 px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-fg/[0.2] hover:text-fg"
            >
              <Sparkles className="size-3.5 shrink-0 text-fg" strokeWidth={2} />
              <span>Book AI 2.0 is here</span>
              <span
                aria-hidden
                className="shrink-0 transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          </motion.div>

          <div className="space-y-4 sm:space-y-6">
            <motion.h1
              {...chunk(0.1)}
              className="relative mx-auto max-w-6xl text-4xl font-medium leading-[1.1] tracking-tight [word-spacing:0.15em] text-fg sm:text-5xl md:text-6xl lg:text-7xl"
            >
              <span className="sr-only">
                Run your whole freelance business from one calm book.
              </span>
              <span aria-hidden>
                <span className="block">Run your whole business</span>
                <span className="corner-brackets whitespace-nowrap px-[0.2em] py-[0.06em]">
                  from one calm book.
                </span>
                <span className="mk-caret ml-1 inline-block h-[0.72em] w-2.5 translate-y-[0.14em] bg-brand md:w-3" />
              </span>
            </motion.h1>

            <motion.p
              {...chunk(0.2)}
              className="mx-auto max-w-4xl text-base font-light text-muted sm:text-xl"
            >
              One workspace for clients, projects, time and invoices — the operating
              system built for independent freelancers.
            </motion.p>
          </div>

          <motion.div
            {...chunk(0.3)}
            className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-8 sm:gap-4"
          >
            <Link href="/sign-up">
              <MkButton>
                <span className="hidden sm:inline">Start for free</span>
                <span className="sm:hidden">Start free</span>
                <span className="relative size-4 overflow-hidden">
                  <ArrowRight className="absolute inset-0 size-4 transition-transform duration-300 ease-out group-hover:translate-x-full" />
                  <ArrowRight className="absolute inset-0 size-4 -translate-x-full transition-transform duration-300 ease-out group-hover:translate-x-0" />
                </span>
              </MkButton>
            </Link>
            <Link href="/dashboard" aria-label="Open the dashboard">
              <MkIconButton>
                <Play className="size-4 fill-current" />
              </MkIconButton>
            </Link>
          </motion.div>

          <motion.p {...chunk(0.4)} className="mt-6 text-xs text-muted sm:text-sm">
            Free to start · No credit card required
          </motion.p>
        </div>
      </div>

      <AppShowcase />
    </div>
  );
}
