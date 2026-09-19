"use client";

import { usePathname } from "next/navigation";
import { motion, useScroll, useSpring } from "framer-motion";

export function ScrollProgress() {
  const pathname = usePathname();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Only render the scroll progress bar on the public landing page ("/")
  if (pathname !== "/") {
    return null;
  }

  return (
    <motion.div
      style={{ scaleX }}
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-500 origin-left z-[100] pointer-events-none"
    />
  );
}
