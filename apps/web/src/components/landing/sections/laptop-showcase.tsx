"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Eyebrow, RadialGlow } from "@/components/landing/layout";
import { MacBookMock } from "@/components/landing/laptop";
import { Stagger, StaggerItem } from "@/components/landing/motion";

/* ========================= DESKTOP SHOWCASE ========================
   The full MacBook — lid, keyboard deck and trackpad — rendered at
   1060px design width and measured-scaled to the container, so the
   whole machine is always visible. The lid eases from a tilted-back
   rest position toward flat as the section scrolls in.
=================================================================== */

const DESIGN_W = 1060;
const DESIGN_H = 880;

export function LaptopShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.9", "start 0.25"],
  });
  const rotateX = useTransform(scrollYProgress, [0, 1], [6, 1]);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / DESIGN_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="desktop"
      aria-labelledby="desktop-heading"
      className="scroll-mt-24 overflow-hidden pt-24 pb-16 sm:pt-32 sm:pb-24"
    >
      <div className="relative mx-auto max-w-6xl px-6 text-center sm:px-8">
        <Stagger className="flex flex-col items-center">
          <StaggerItem>
            <Eyebrow>Desktop</Eyebrow>
          </StaggerItem>
          <StaggerItem>
            <h2
              id="desktop-heading"
              className="mt-3 text-2xl font-normal tracking-tight text-fg sm:text-3xl"
            >
              Full power on your desk.
            </h2>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-3 text-base text-muted sm:text-lg">
              The whole book, on the screen it was built for.
            </p>
          </StaggerItem>
        </Stagger>
        <div className="relative mt-12 sm:mt-16">
          <RadialGlow />
          <div
            ref={stripRef}
            aria-hidden
            className="pointer-events-none relative mx-auto w-full max-w-[920px] select-none text-left"
            style={{ height: DESIGN_H * scale }}
          >
            <div
              className="absolute left-1/2 top-0 w-[1060px] origin-top"
              style={{ transform: `translateX(-50%) scale(${scale})` }}
            >
              <div className="[perspective:2400px]">
                <motion.div style={{ rotateX, transformOrigin: "50% 100%" }}>
                  <MacBookMock />
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
