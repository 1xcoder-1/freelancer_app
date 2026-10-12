import * as React from "react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   BeamButton — vended from Cult UI's bg-animate-button (MIT),
   https://www.cult-ui.com/r/bg-animate-button

   Same idea (a conic gradient spinning behind a 1px gap so the border
   itself animates), rebuilt for this codebase: no @radix-ui/react-slot
   and no class-variance-authority to install, sharp 2px corners to match
   the marketing grammar, and the spin done by animating an @property
   angle instead of the kit's inset-[-1000%] rotating layer — that layer
   is ~20x the button's box and forces the browser to rasterise it.
------------------------------------------------------------------- */

export function BeamButton({
  children,
  className,
  surfaceClassName,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Background behind the label; defaults to the page background. */
  surfaceClassName?: string;
}) {
  return (
    <button
      className={cn(
        "group relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[2px] p-px",
        className
      )}
      {...props}
    >
      <span aria-hidden className="mk-beam-ring absolute inset-0 rounded-[2px]" />
      <span
        className={cn(
          "relative flex items-center justify-center gap-2 rounded-[1px] bg-bg px-6 py-3 text-sm text-fg transition-colors duration-150 group-hover:bg-[#1a1a1a] sm:px-8 sm:py-3.5 sm:text-base",
          surfaceClassName
        )}
      >
        {children}
      </span>
    </button>
  );
}
