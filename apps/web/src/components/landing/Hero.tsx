"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { AppWindow, ScaledMock, useAppCycle } from "@/components/landing/app";
import {
  Eyebrow,
  MkIconButton,
  RadialGlow,
  WindowFrame,
} from "@/components/landing/layout";
import { Stagger, StaggerItem } from "@/components/landing/motion";
import { BeamButton } from "@/components/ui/beam-button";

/* ------------------------------------------------------------------
   Hero — the features-page hero grammar (brand eyebrow, clean
   tracking-tight headline, lead line) over the same tilted live
   dashboard the features page uses: identical mk-tilt angle, width
   and window chrome. First open: the text rises in as one staggered
   group and the dashboard rises with the features Rise values — but
   on mount, not whileInView (the dashboard sits below the -60px
   intersection margin on short viewports, which would leave it
   invisible until the user scrolls). One-shot; reduced-motion aware
   via LandingShell's MotionConfig.
------------------------------------------------------------------- */

function AppShowcase() {
  const view = useAppCycle(5000);

  return (
    <div className="relative mx-auto mt-16 w-full max-w-7xl px-6 sm:mt-24 sm:px-8 lg:mt-32">
      <div className="relative mx-auto w-full max-w-6xl">
        <RadialGlow />
        {/* Rise values on mount (not whileInView — see file comment) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 w-full [perspective:2800px]"
        >
          <div
            className="mk-tilt w-full"
            style={{
              transformOrigin: "50% 42%",
              maskImage: "linear-gradient(to bottom, black 78%, transparent 99%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 78%, transparent 99%)",
            }}
          >
            <WindowFrame title="freelance book" className="w-full">
              <ScaledMock designWidth={1280} designHeight={800}>
                <AppWindow view={view.id} />
              </ScaledMock>
            </WindowFrame>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <div className="relative flex flex-col items-center overflow-hidden pb-16 pt-24 sm:pb-24 sm:pt-32 lg:pt-40">
      {/* backdrop: a single soft brand glow — no dot texture, the hero
          stays clean and the dashboard carries the visual weight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 45% 35% at 50% 22%, rgba(232,128,74,0.07), transparent 70%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-7xl px-6 sm:px-8">
        <Stagger className="flex flex-col items-center text-center">
          <StaggerItem>
            <Eyebrow className="mb-4">For independent freelancers</Eyebrow>
          </StaggerItem>

          <StaggerItem>
            <h1 className="mx-auto max-w-6xl text-4xl font-medium leading-[1.1] tracking-tight text-fg sm:text-5xl md:text-6xl lg:text-7xl">
              <span className="block">Run your whole business</span>
              <span className="block">from one calm book.</span>
            </h1>
          </StaggerItem>

          <StaggerItem>
            <p className="mt-6 max-w-4xl text-base font-light text-muted sm:text-xl">
              One workspace for clients, projects, time and invoices — the operating
              system built for independent freelancers.
            </p>
          </StaggerItem>

          <StaggerItem>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
              <Link href="/sign-up">
                <BeamButton
                  surfaceClassName="bg-fg text-bg group-hover:bg-brand group-hover:text-white"
                >
                  <span className="hidden sm:inline">Start for free</span>
                  <span className="sm:hidden">Start free</span>
                  <span className="relative size-4 overflow-hidden">
                    <ArrowRight className="absolute inset-0 size-4 transition-transform duration-300 ease-out group-hover:translate-x-full" />
                    <ArrowRight className="absolute inset-0 size-4 -translate-x-full transition-transform duration-300 ease-out group-hover:translate-x-0" />
                  </span>
                </BeamButton>
              </Link>
              <Link href="/dashboard" aria-label="Open the dashboard">
                <MkIconButton>
                  <Play className="size-4 fill-current" />
                </MkIconButton>
              </Link>
            </div>
          </StaggerItem>

          <StaggerItem>
            <p className="mt-6 text-xs text-muted sm:text-sm">
              Free to start · No credit card required
            </p>
          </StaggerItem>
        </Stagger>
      </div>

      <AppShowcase />
    </div>
  );
}
