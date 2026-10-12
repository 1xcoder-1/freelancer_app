import * as React from "react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   TextureOverlay — vended from Cult UI's texture-overlay (MIT),
   https://www.cult-ui.com/r/texture-overlay

   Retargeted: the kit ships black-ink patterns for light themes, so the
   ink is a parameter here and every pattern is an inline CSS gradient —
   no arbitrary-value Tailwind classes to keep the scanner happy, and no
   JS at paint time.
------------------------------------------------------------------- */

export type TextureType =
  | "dots"
  | "grid"
  | "noise"
  | "crosshatch"
  | "diagonal"
  | "scatteredDots"
  | "halftone"
  | "chevron"
  | "paperGrain"
  | "horizontalLines"
  | "verticalLines";

type Ink = "light" | "dark";

const rgb = (ink: Ink, a: number) =>
  ink === "light" ? `rgb(255 255 255 / ${a})` : `rgb(0 0 0 / ${a})`;

const pattern = (texture: TextureType, ink: Ink): React.CSSProperties => {
  const i = (a: number) => rgb(ink, a);
  switch (texture) {
    case "dots":
      return {
        backgroundImage: `radial-gradient(circle at 1px 1px, ${i(0.4)} 1px, transparent 0)`,
        backgroundSize: "8px 8px",
      };
    case "grid":
      return {
        backgroundImage: `linear-gradient(${i(0.3)} 1px, transparent 1px), linear-gradient(90deg, ${i(0.3)} 1px, transparent 1px)`,
        backgroundSize: "12px 12px",
      };
    case "noise":
      return {
        backgroundImage: `radial-gradient(circle at 2px 2px, ${i(0.25)} 1px, transparent 0)`,
        backgroundSize: "6px 6px",
      };
    case "crosshatch":
      return {
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${i(0.3)} 2px, ${i(0.3)} 4px), repeating-linear-gradient(-45deg, transparent, transparent 2px, ${i(0.3)} 2px, ${i(0.3)} 4px)`,
      };
    case "diagonal":
      return {
        backgroundImage: `repeating-linear-gradient(-45deg, ${i(0.2)}, ${i(0.2)} 1px, transparent 1px, transparent 6px)`,
      };
    case "scatteredDots":
      return {
        backgroundImage: `radial-gradient(circle at 3px 7px, ${i(0.3)} 1px, transparent 0), radial-gradient(circle at 11px 2px, ${i(0.3)} 1px, transparent 0), radial-gradient(circle at 7px 12px, ${i(0.3)} 1px, transparent 0)`,
        backgroundSize: "16px 16px",
      };
    case "halftone":
      return {
        backgroundImage: `radial-gradient(circle, ${i(0.4)} 25%, transparent 25%)`,
        backgroundSize: "10px 10px",
        backgroundPosition: "0 0, 5px 5px",
      };
    case "chevron":
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${i(0.2)} 0px, ${i(0.2)} 2px, transparent 2px, transparent 8px), repeating-linear-gradient(-45deg, ${i(0.2)} 0px, ${i(0.2)} 2px, transparent 2px, transparent 8px)`,
      };
    case "paperGrain":
      return {
        backgroundImage: `repeating-linear-gradient(0deg, ${i(0.1)} 0px, transparent 1px, transparent 3px), repeating-linear-gradient(90deg, ${i(0.1)} 0px, transparent 1px, transparent 4px), repeating-linear-gradient(45deg, ${i(0.05)} 0px, transparent 1px, transparent 5px)`,
      };
    case "horizontalLines":
      return {
        backgroundImage: `repeating-linear-gradient(0deg, ${i(0.25)} 0px, ${i(0.25)} 1px, transparent 1px, transparent 4px)`,
      };
    case "verticalLines":
      return {
        backgroundImage: `repeating-linear-gradient(90deg, ${i(0.25)} 0px, ${i(0.25)} 1px, transparent 1px, transparent 4px)`,
      };
  }
};

export function TextureOverlay({
  texture,
  opacity = 1,
  tone = "light",
  className,
  style,
}: {
  texture: TextureType;
  opacity?: number;
  /** Which background the texture sits on: "light" ink for dark surfaces. */
  tone?: Ink;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{ opacity, ...pattern(texture, tone), ...style }}
    />
  );
}
