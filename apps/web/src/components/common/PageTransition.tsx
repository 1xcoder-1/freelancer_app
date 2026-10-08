"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";

/**
 * App-wide page-load transition (better-ui enter recipe: opacity + 12px
 * translateY + 4px blur over 300ms ease-out; exits are shorter at 150ms).
 * Keyed on the pathname so every dashboard route mounts with the same
 * staged entrance; Movement/scale/blur are gated by MotionConfig's
 * reduced-motion handling, which keeps the opacity cross-fade for users
 * who prefer reduced motion.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial>
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
          exit={{
            opacity: 0,
            y: -12,
            filter: "blur(4px)",
            transition: { duration: 0.15, ease: "easeOut" },
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}
