"use client";

import * as React from "react";
import { motion } from "framer-motion";

/* ------------------------------------------------------------------
   Landing motion kit (superset.sh grammar): whole blocks rise 20px
   into view once. Values match superset's actual SSR initial states:
   opacity + 20px rise, no blur — animating blur on large blocks is a
   scroll-jank source. MotionConfig and the global reduced-motion
   handling keep it calm when needed.
------------------------------------------------------------------- */

/** Scroll-triggered one-shot rise (superset's opacity:0 translateY(20px)). */
export function Rise({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
