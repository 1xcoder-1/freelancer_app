"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   TextAnimate — vended from Cult UI's text-animate (MIT),
   https://www.cult-ui.com/r/text-animate

   Retargeted: the kit hard-codes `text-4xl font-black text-black
   dark:text-neutral-100` and only ever renders an h2, so it is reduced
   here to the reveal itself — the caller keeps full control of the tag
   and the type scale. Two of the kit's eight variants survive because
   those are the two the marketing pages use; `LandingShell` already
   mounts MotionConfig reducedMotion="user", so the rise collapses to a
   plain fade for anyone who asks for reduced motion.
------------------------------------------------------------------- */

const motionTags = {
  div: motion.div,
  span: motion.span,
  p: motion.p,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
} as const;

type Tag = keyof typeof motionTags;

type Variant = "rise" | "roll";

const animations: Record<Variant, { container: Variants; child: Variants }> = {
  // Words slide up out of a masked line — the editorial hero reveal.
  rise: {
    container: {
      hidden: {},
      visible: (delay: number = 0) => ({
        transition: { staggerChildren: 0.03, delayChildren: 0.2 + delay },
      }),
    },
    child: {
      hidden: {
        y: "110%",
        transition: { ease: [0.455, 0.03, 0.515, 0.955], duration: 0.7 },
      },
      visible: {
        y: 0,
        transition: { ease: [0.125, 0.92, 0.69, 0.975], duration: 0.7 },
      },
    },
  },
  // Smaller, quicker hop — reads well on section titles.
  roll: {
    container: {
      hidden: {},
      visible: (delay: number = 0) => ({
        transition: { staggerChildren: 0.025, delayChildren: 0.1 + delay },
      }),
    },
    child: {
      hidden: { opacity: 0, y: "0.3em" },
      visible: {
        opacity: 1,
        y: 0,
        transition: { ease: [0.65, 0, 0.75, 1], duration: 0.55 },
      },
    },
  },
};

export function TextAnimate({
  text,
  variant = "rise",
  delay = 0,
  as: tag = "div",
  whileInView = false,
  wordClassName,
  className,
}: {
  text: string;
  variant?: Variant;
  /** Seconds added to the container's start delay. */
  delay?: number;
  as?: Tag;
  /** For below-the-fold titles: reveal when the line scrolls in, not on page load. */
  whileInView?: boolean;
  /** Per-word styling, e.g. to brand-tint one phrase in a headline. */
  wordClassName?: (word: string, index: number) => string | undefined;
  className?: string;
}) {
  const Tag = motionTags[tag];
  const { container, child } = animations[variant];
  const words = text.split(" ");

  return (
    <>
      <span className="sr-only">{text}</span>
      <Tag
        aria-hidden
        className={cn("flex flex-wrap", className)}
        variants={container}
        custom={delay}
        initial="hidden"
        {...(whileInView
          ? {
              whileInView: "visible",
              viewport: { once: true, margin: "-60px" },
            }
          : { animate: "visible" })}
      >
        {words.map((word, i) => (
          <span key={i} className="inline-block overflow-hidden whitespace-nowrap">
            <motion.span
              className={cn("mr-[0.25em] inline-block", wordClassName?.(word, i))}
              variants={child}
              // The last word must not carry trailing space width, or the
              // centred hero sits visibly off its own axis.
              style={i === words.length - 1 ? { marginRight: 0 } : undefined}
            >
              {word}
            </motion.span>
          </span>
        ))}
      </Tag>
    </>
  );
}
