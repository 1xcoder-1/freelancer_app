import * as React from "react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   GradientText — vended from Cult UI's gradient-heading (MIT),
   https://www.cult-ui.com/r/gradient-heading

   Trimmed to the bg-clip-text span only: the kit's cva size/weight matrix
   duplicates Tailwind utilities we already set on the surrounding
   heading, and its Slot dependency is not installed here.
------------------------------------------------------------------- */

export function GradientText({
  children,
  tone = "brand",
  className,
}: {
  children: React.ReactNode;
  tone?: "brand" | "mono";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-clip-text text-transparent",
        tone === "brand"
          ? "bg-gradient-to-b from-brand-light via-brand to-brand-dark"
          : "bg-gradient-to-b from-fg to-faint",
        className
      )}
    >
      {children}
    </span>
  );
}
