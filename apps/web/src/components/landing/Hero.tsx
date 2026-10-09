"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MkButton, MkIconButton } from "@/components/landing/layout";
import {
  AppSidebar,
  AppTopbar,
  ClientsView,
  HomeView,
  MoneyView,
  T,
  TimeView,
  views,
  type AppViewId,
} from "@/components/landing/app-mock";

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

/* ---------------- auto-cycling showcase ---------------- */

function AppWindow({ view }: { view: AppViewId }) {
  const nav = views.find((v) => v.id === view)!.nav;
  return (
    <div className="flex h-full" style={{ background: T.bg }}>
      <AppSidebar active={nav} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="absolute inset-0 overflow-hidden px-8 py-6"
            >
              {view === "clients" && <ClientsView />}
              {view === "time" && <TimeView />}
              {view === "money" && <MoneyView />}
              {view === "home" && <HomeView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function useFitScale(designWidth: number) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.56);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.max(0.28, el.clientWidth / designWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [designWidth]);
  return { ref, scale };
}

function AppShowcase() {
  const [active, setActive] = React.useState(0);
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const { ref, scale } = useFitScale(1280);

  const startCycle = React.useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setActive((a) => (a + 1) % views.length);
    }, 5000);
  }, []);

  const stopCycle = React.useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  // Pause the auto-cycle in hidden tabs: requestAnimationFrame is suspended
  // there, so a pending AnimatePresence exit would otherwise pin the old view.
  React.useEffect(() => {
    const onVisibility = () => (document.hidden ? stopCycle() : startCycle());
    if (!document.hidden) startCycle();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopCycle();
    };
  }, [startCycle, stopCycle]);

  const pick = (i: number) => {
    setActive(i);
    if (!document.hidden) startCycle();
  };

  const view = views[active];

  return (
    <div className="relative w-full mt-20 sm:mt-32 lg:mt-40">
      <div className="relative w-full max-w-full flex flex-col gap-4 lg:flex-row lg:gap-0">
        {/* Mobile tab strip */}
        <div className="flex items-center gap-2 px-4 overflow-x-auto scrollbar-hide sm:px-0 lg:hidden">
          {views.map((v, i) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={i === active}
              onClick={() => pick(i)}
              className={cn(
                "group relative flex items-center shrink-0 px-4 py-2 text-left text-xs sm:text-sm whitespace-nowrap cursor-pointer transition-colors duration-200",
                i === active ? "text-fg" : "text-muted hover:text-fg/80"
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 w-[2px] bg-brand/80 transition-all duration-200 ease-out",
                  i === active ? "h-2/5 opacity-100" : "h-0 opacity-0"
                )}
              />
              {v.rail}
            </button>
          ))}
        </div>

        {/* Desktop rail */}
        <div className="hidden lg:flex flex-col justify-center shrink-0 overflow-hidden">
          <div className="w-60 pr-6 flex flex-col gap-1">
            {views.map((v, i) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={i === active}
                onClick={() => pick(i)}
                className={cn(
                  "group relative flex items-center shrink-0 lg:w-full px-4 py-2 lg:py-2.5 text-left text-xs sm:text-sm whitespace-nowrap cursor-pointer transition-colors duration-200",
                  i === active ? "text-fg" : "text-muted hover:text-fg/80"
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 w-[2px] bg-brand/80 transition-all duration-200 ease-out",
                    i === active ? "h-2/5 opacity-100" : "h-0 opacity-0"
                  )}
                />
                {v.rail}
              </button>
            ))}
          </div>
        </div>

        {/* Window */}
        <div className="relative flex-1 min-w-0">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-[25%] -top-[30%] bottom-0"
            style={{
              background:
                "radial-gradient(ellipse 42% 38% at 50% 22%, rgba(232,128,74,0.06), rgba(232,128,74,0.02) 55%, transparent 78%)",
            }}
          />
          <div className="relative overflow-x-auto scrollbar-hide max-md:[mask-image:linear-gradient(to_right,black_88%,transparent)]">
            <div
              ref={ref}
              className="relative w-full min-w-[700px] overflow-hidden rounded-xl border border-line bg-bg shadow-[0_1px_1px_rgba(0,0,0,0.4),0_16px_40px_-12px_rgba(0,0,0,0.6),0_32px_90px_-24px_rgba(0,0,0,0.75)]"
              style={{ height: 800 * scale }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-20 rounded-xl ring-1 ring-inset ring-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[10%] bg-gradient-to-b from-transparent to-bg"
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
      </div>
    </div>
  );
}

/* ---------------- hero ---------------- */

export function Hero() {
  return (
    <div className="relative flex flex-col items-center pt-24 sm:pt-32 lg:pt-40 pb-16 sm:pb-24 overflow-hidden">
      {/* backdrop: masked dot grid + brand glow (superset hero canvas stand-in) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 65%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 40%, transparent 65%)",
        }}
      >
        <div className="absolute inset-0 mk-dot-grid" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 45% 35% at 50% 25%, rgba(232,128,74,0.06), transparent 70%)",
          }}
        />
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-6 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <motion.div {...chunk(0)}>
            <Link
              href="/features#ai"
              className="group mb-6 sm:mb-8 inline-flex max-w-full items-center gap-2 rounded-[2px] border border-line bg-bg/80 px-3 py-1.5 text-xs font-mono text-muted transition-colors hover:text-fg hover:border-fg/[0.2]"
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
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium tracking-tight leading-[1.1] [word-spacing:0.15em] text-fg relative max-w-6xl mx-auto"
            >
              <span className="sr-only">
                Run your whole freelance business from one calm book.
              </span>
              <span aria-hidden>
                <span className="block">Run your whole business</span>
                <span className="corner-brackets px-[0.2em] py-[0.06em] whitespace-nowrap">
                  from one calm book.
                </span>
                <span className="ml-1 inline-block h-[0.72em] w-2.5 md:w-3 translate-y-[0.14em] bg-brand mk-caret" />
              </span>
            </motion.h1>

            <motion.p
              {...chunk(0.2)}
              className="text-base sm:text-xl font-light text-muted max-w-4xl mx-auto"
            >
              One workspace for clients, projects, time and invoices — the
              operating system built for independent freelancers.
            </motion.p>
          </div>

          <motion.div
            {...chunk(0.3)}
            className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mt-6 sm:mt-8"
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
            <Link href="/dashboard" aria-label="Open the live demo">
              <MkIconButton>
                <Play className="size-4 fill-current" />
              </MkIconButton>
            </Link>
          </motion.div>

          <motion.p
            {...chunk(0.4)}
            className="mt-6 text-xs sm:text-sm text-muted"
          >
            Free to start · No credit card required
          </motion.p>
        </div>

        <AppShowcase />
      </div>
    </div>
  );
}
