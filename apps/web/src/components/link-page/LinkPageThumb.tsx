"use client";

import { useEffect, useRef, useState } from "react";
import { LinkPageRender, type LinkPageRenderData } from "./templates";

// The tree renders at phone width, then scales uniformly to fit the box —
// the whole page stays visible instead of only its top slice.
const DESIGN_WIDTH = 375;

export function LinkPageThumb({
  template,
  data,
  boxW,
  boxH,
  className = "",
}: {
  template: string;
  data: LinkPageRenderData;
  boxW: number;
  boxH: number;
  className?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = useState<number | null>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setContentH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = contentH ? Math.min(boxW / DESIGN_WIDTH, boxH / contentH) : boxW / DESIGN_WIDTH;

  return (
    <div
      aria-hidden
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{ width: boxW, height: boxH }}
    >
      <div
        className="absolute origin-top-left"
        style={{
          width: DESIGN_WIDTH,
          transform: `scale(${scale})`,
          left: (boxW - DESIGN_WIDTH * scale) / 2,
          top: contentH ? (boxH - contentH * scale) / 2 : 0,
        }}
      >
        <div ref={contentRef}>
          <LinkPageRender template={template} inert data={data} />
        </div>
      </div>
    </div>
  );
}
