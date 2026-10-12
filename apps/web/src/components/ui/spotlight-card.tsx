"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* Vendored from ui.aceternity.com (CardSpotlight), reimplemented against this
   repo's tokens. The glow is a negative-z layer inside an isolated stacking
   context, so it sits above the card background and below the content without
   an extra wrapper div. Pointer position is written as CSS custom properties
   on the element — one rAF-budget style write per frame, no React state, so a
   grid of these cards never re-renders while the pointer moves. */
export function SpotlightCard({
  children,
  className,
  onClick,
  radius = 320,
  glow = "rgba(255,255,255,0.055)",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  radius?: number;
  glow?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const handleEnter = () => {
    rectRef.current = cardRef.current?.getBoundingClientRect() ?? null;
  };

  const handleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    const rect = rectRef.current;
    if (!el || !rect) return;
    if (frameRef.current !== null) return;
    const { clientX, clientY } = e;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      el.style.setProperty("--spot-x", `${clientX - rect.left}px`);
      el.style.setProperty("--spot-y", `${clientY - rect.top}px`);
    });
  };

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onPointerEnter={handleEnter}
      onPointerMove={handleMove}
      className={cn("group relative isolate overflow-hidden", className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(${radius}px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${glow}, transparent 75%)`,
        }}
      />
      {children}
    </div>
  );
}
