import * as React from "react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   TextureCard — vended from Cult UI's texture-card (MIT),
   https://www.cult-ui.com/r/texture-card

   The kit's trick is four stacked 1px hairlines that read as a machined
   bevel instead of one flat border. Retargeted to the marketing scope's
   sharp 2px corner grammar and our line tokens, and trimmed to the frame
   only — the kit's Header/Title/Body/Footer subcomponents were dropped
   because every section already owns its typography.
------------------------------------------------------------------- */

export function TextureCard({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative rounded-[2px] border border-line bg-gradient-to-b from-card to-surface/30",
        className
      )}
      {...props}
    >
      <div className="rounded-[2px] border border-white/[0.07]">
        <div className="rounded-[1px] border border-black/50">
          <div className="rounded-[1px] border border-white/[0.04]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
