"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { motion, MotionConfig } from "framer-motion";

/**
 * App-wide page-load transition (better-ui enter recipe: opacity + 12px
 * translateY + 4px blur over 300ms ease-out). Keyed on the pathname so every
 * dashboard route mounts with the same staged entrance; movement/scale/blur
 * are gated by MotionConfig's reduced-motion handling, which keeps the
 * opacity fade for users who prefer reduced motion.
 *
 * Deliberately NO exit animation: AnimatePresence mode="wait" blocked every
 * navigation until the old page finished exiting (~450ms of dead time per
 * click on a full-page blur layer). The new page now mounts immediately.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={pathname}
        className="flex-1 min-h-0"
        initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
        animate={{
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
        }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
