"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Landing motion kit (reference-site section language: inspora /
   refero / vibrant / kage galleries all show the same grammar —
   headlines that arrive word by word, panels that rise in as you
   scroll, cards that lift on hover). Values follow the better-ui
   skill: enter = opacity + 12px rise + 4px blur, 300ms ease-out;
   headline words stagger 80ms; MotionConfig/PageTransition and the
   global reduced-motion handling keep it calm when needed.
------------------------------------------------------------------- */

export const revealVariants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/** Scroll-triggered one-shot reveal for a block (panel, row of cards…). */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** seconds after the block enters the viewport */
  delay?: number;
  as?: "div" | "section";
}) {
  const M = as === "section" ? motion.section : motion.div;
  return (
    <M
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={{
        hidden: revealVariants.hidden,
        visible: {
          ...revealVariants.visible,
          transition: { ...revealVariants.visible.transition, delay },
        },
      }}
      className={className}
    >
      {children}
    </M>
  );
}

/**
 * Display headline split into words, each entering 80ms apart so the
 * line reads word by word. Words in `accent` get the italic accent
 * color; `suffix` keeps a sentence readable when the accent sits
 * mid-line. Static text stays in the DOM for SSR/SEO as the same spans.
 */
export function SplitHeading({
  text,
  accent = "",
  suffix = "",
  className,
  wordClassName,
  as = "h1",
}: {
  text: string;
  accent?: string;
  suffix?: string;
  className?: string;
  wordClassName?: string;
  as?: "h1" | "h2";
}) {
  const words = [
    ...text.split(" ").filter(Boolean).map((w) => ({ w, accent: false })),
    ...accent.split(" ").filter(Boolean).map((w) => ({ w, accent: true })),
    ...suffix.split(" ").filter(Boolean).map((w) => ({ w, accent: false })),
  ];
  const M = as === "h2" ? motion.h2 : motion.h1;

  return (
    <M
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      className={cn(className)}
    >
      {words.map(({ w, accent: isAccent }, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <motion.span
            variants={{
              hidden: { opacity: 0, y: "0.7em", filter: "blur(4px)" },
              visible: {
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
                transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
              },
            }}
            className={cn(
              "inline-block",
              isAccent ? "italic font-medium text-accent" : wordClassName
            )}
          >
            {w}
          </motion.span>
          {i < words.length - 1 && <span>&nbsp;</span>}
        </span>
      ))}
    </M>
  );
}

/** Card lift on hover for marketing grids — transitions, not keyframes,
    so the pointer can reverse mid-flight. Touch devices get nothing. */
export const hoverLift =
  "transition-[transform,box-shadow,border-color] duration-150 ease-out motion-safe:hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 hover:border-line-strong";
