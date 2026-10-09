"use client";

import * as React from "react";
import { MotionConfig } from "framer-motion";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Marketing layout system — matched 1:1 to superset.sh.

   Scope: LandingShell mounts .mk, which remaps the design tokens to
   the superset palette (always dark) so marketing routes share one
   visual language without touching the dashboard's own theme.

   Language:
   · sharp 2px corners (rounded-[2px]) — squares everywhere
   · mono uppercase brand eyebrows (text-sm font-mono tracking-widest)
   · floating "mac window" mockups with layered black shadows and an
     inset white ring highlight
   · radial orange glows behind visuals
   · sections py-24 sm:py-32, container max-w-7xl px-6 sm:px-8
------------------------------------------------------------------- */

/** Global page width for everything marketing. */
export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-7xl mx-auto px-6 sm:px-8", className)}>
      {children}
    </div>
  );
}

/** Standard content section: superset vertical rhythm. */
export function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("relative py-24 sm:py-32", className)}>
      {children}
    </section>
  );
}

/** Mono eyebrow label in brand orange (superset section opener). */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block text-sm font-mono uppercase tracking-widest text-brand",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Centered page hero: eyebrow → big tracking-tight headline → lead. */
export function PageHero({
  eyebrow,
  title,
  accent,
  suffix,
  desc,
  children,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  suffix?: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center pt-24 sm:pt-32 lg:pt-40 pb-16 sm:pb-24 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          maskImage:
            "linear-gradient(to bottom, black 0%, black 40%, transparent 70%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 40%, transparent 70%)",
        }}
      >
        <div className="absolute inset-0 mk-dot-grid" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 42% at 50% 28%, rgba(232,128,74,0.07), transparent 70%)",
          }}
        />
      </div>
      <Container className="relative z-10">
        <div className="flex flex-col items-center text-center">
          <Eyebrow className="mb-4">{eyebrow}</Eyebrow>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight leading-[1.1] text-fg max-w-4xl mx-auto">
            {title}
            {accent ? (
              <>
                {" "}
                <span className="corner-brackets px-[0.2em] py-[0.06em] whitespace-nowrap">
                  {accent}
                </span>
              </>
            ) : null}
            {suffix ? <span> {suffix}</span> : null}
          </h1>
          <p className="mt-6 text-base sm:text-xl font-light text-muted max-w-3xl mx-auto">
            {desc}
          </p>
          {children && <div className="mt-10">{children}</div>}
        </div>
      </Container>
    </div>
  );
}

/* ------------------------------------------------------------------
   Buttons — superset square grammar. Primary is foreground-on-dark
   flipping to brand on hover; header CTA is the compact mono variant.
------------------------------------------------------------------- */

export function MkButton({
  variant = "primary",
  size = "default",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline";
  size?: "default" | "header";
}) {
  return (
    <button
      className={cn(
        "group inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150",
        variant === "primary"
          ? "bg-fg text-bg hover:bg-brand hover:text-white"
          : "border border-line bg-bg text-fg hover:bg-surface",
        size === "header"
          ? "px-3 py-2 font-mono text-xs uppercase tracking-wider"
          : "px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-normal",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Square outline icon button (hero secondary action). */
export function MkIconButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "flex size-11 shrink-0 items-center justify-center border border-line bg-bg text-fg transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------
   Floating mac-window shell used by every mockup visual. Layered
   shadow + inset white ring are lifted from superset's windows.
------------------------------------------------------------------- */

export function WindowFrame({
  title,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-line bg-bg shadow-[0_1px_1px_rgba(0,0,0,0.4),0_24px_70px_-16px_rgba(0,0,0,0.75)]",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-lg ring-1 ring-inset ring-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      />
      {title && (
        <div className="relative flex h-8 items-center border-b border-line/60 bg-card px-3">
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-[#ff5f57]/85" />
            <div className="size-2 rounded-full bg-[#febc2e]/85" />
            <div className="size-2 rounded-full bg-[#28c840]/85" />
          </div>
          {title && (
            <span className="pointer-events-none absolute inset-x-0 text-center font-mono text-[10px] tracking-tight text-muted/60">
              {title}
            </span>
          )}
        </div>
      )}
      <div className={cn("relative", contentClassName)}>{children}</div>
    </div>
  );
}

/** Soft brand radial glow placed behind a mockup visual. */
export function RadialGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse 55% 45% at 50% 40%, rgba(232,128,74,0.05), transparent 75%)",
      }}
    />
  );
}

/** Page shell for every marketing route: always-dark superset scope +
    MotionConfig so entrances degrade under prefers-reduced-motion. */
export function LandingShell({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="mk min-h-screen bg-bg text-fg flex flex-col selection:bg-brand selection:text-white">
        {children}
      </div>
    </MotionConfig>
  );
}
