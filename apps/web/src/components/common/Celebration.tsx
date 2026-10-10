"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PartyPopper } from "lucide-react";

/* ------------------------------------------------------------------
   celebrate() — the app-wide "you just made a thing" micro-moment.
   A short confetti pop + message pill (never the only feedback channel:
   callers still fire a toast). Module-level host pattern matches
   ConfirmDialog so any page can just call celebrate().
   Under prefers-reduced-motion the confetti is skipped and only a
   calm pill cross-fade shows.
------------------------------------------------------------------- */

type PendingCelebration = { id: number; message: string };

let requestCelebrate: ((c: PendingCelebration) => void) | null = null;
let nextId = 0;

const MESSAGES = ["Added", "Created", "Nice one"];

export function celebrate(options?: string) {
  const message = options && options.length > 0 ? options : MESSAGES[0];
  if (!requestCelebrate) return;
  requestCelebrate({ id: ++nextId, message });
}

/* Brand-palette confetti chips (no neon, solid accents only). */
const COLORS = ["#c85a17", "#d46b28", "#15803d", "#3563a8", "#a16207", "#7c53c3"];

type Piece = {
  x: number; // horizontal spread, px
  rise: number; // launch height above origin, px
  drift: number; // sideways drift by the end, px
  rot: number; // total rotation, deg
  delay: number; // ms stagger so the burst "pops" open
  color: string;
  wide: boolean;
};

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 320,
    rise: 60 + Math.random() * 110,
    drift: (Math.random() - 0.5) * 90,
    rot: (Math.random() - 0.5) * 540,
    delay: Math.random() * 90,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    wide: Math.random() > 0.5,
  }));
}

export function CelebrationHost() {
  const [current, setCurrent] = React.useState<PendingCelebration | null>(null);
  const reduceMotion = useReducedMotion();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    requestCelebrate = (c) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCurrent(c);
      timerRef.current = setTimeout(() => setCurrent(null), 1400);
    };
    return () => {
      requestCelebrate = null;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Re-stamp the pieces per celebration so repeats never look canned.
  const [pieces, setPieces] = React.useState<Piece[]>(() => makePieces(18));
  React.useEffect(() => {
    if (current) setPieces(makePieces(18));
  }, [current]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex items-start justify-center pt-[18vh]">
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, transition: { duration: 0.15, ease: "easeOut" } }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
            className="relative flex items-center gap-2.5 rounded-full bg-card border border-accent/30 px-5 py-2.5 shadow-2xl"
          >
            {/* Confetti burst — transform/opacity only, compositor-friendly */}
            {!reduceMotion && (
              <div className="absolute left-1/2 top-1/2 -z-10">
                {pieces.map((p, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
                    animate={{
                      opacity: [1, 1, 0],
                      x: [0, p.x * 0.6, p.x + p.drift],
                      y: [0, -p.rise, 90],
                      rotate: p.rot,
                      scale: 0.9,
                    }}
                    transition={{ duration: 1.05, delay: p.delay / 1000, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute rounded-[2px]"
                    style={{
                      width: p.wide ? 8 : 5,
                      height: p.wide ? 5 : 8,
                      backgroundColor: p.color,
                    }}
                  />
                ))}
              </div>
            )}
            <PartyPopper className="w-4.5 h-4.5 text-accent shrink-0" />
            <span className="text-sm font-semibold text-fg tracking-tight">
              {current.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
