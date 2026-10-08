"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

/* ------------------------------------------------------------------
   CountUp — animates an integer from 0 to `value` once on mount with
   an ease-out ramp (700ms). Used by StatCard headline numbers so the
   dashboard stats "arrive" instead of snapping. Under reduced motion
   the final value renders immediately. Tabular-nums prevents the
   layout jittering while digits change.
------------------------------------------------------------------- */

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUp({
  value,
  durationMs = 700,
  format,
}: {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
}) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = React.useState(reduceMotion ? value : 0);
  // Starts at 0 so the first mount counts up; afterwards each change
  // tweens from whatever number is currently on screen.
  const prevValue = React.useRef(0);

  React.useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      prevValue.current = value;
      return;
    }
    // Count from whatever is on screen so later refreshes (polling) tween
    // between numbers instead of restarting from zero every time.
    const from = prevValue.current;
    prevValue.current = value;
    if (from === value) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setDisplay(Math.round(from + (value - from) * easeOutCubic(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs, reduceMotion]);

  return (
    <span className="tabular-nums">
      {format ? format(display) : display.toLocaleString("en-US")}
    </span>
  );
}
