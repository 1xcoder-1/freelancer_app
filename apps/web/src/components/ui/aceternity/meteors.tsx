"use client";
import React from "react";
import { cn } from "@/lib/utils";

export const Meteors = ({
  number = 20,
  className,
}: {
  number?: number;
  className?: string;
}) => {
  const meteors = React.useMemo(() => {
    return Array.from({ length: number }, (_, idx) => {
      const seed = ((idx * 47) % 800) - 400;
      const delay = (((idx * 19) % 60) / 100 + 0.2).toFixed(2);
      const duration = (idx * 23) % 8 + 2;
      return {
        top: "0px",
        left: `${seed}px`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      };
    });
  }, [number]);

  return (
    <>
      {meteors.map((el, idx) => (
        <span
          key={"meteor" + idx}
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 h-0.5 w-0.5 rotate-[215deg] animate-meteor rounded-[9999px] bg-slate-500 shadow-[0_0_0_1px_#ffffff10]",
            "before:absolute before:top-1/2 before:h-[1px] before:w-[50px] before:-translate-y-[50%] before:bg-gradient-to-r before:from-[#64748b] before:to-transparent before:content-['']",
            className
          )}
          style={{
            top: el.top,
            left: el.left,
            animationDelay: el.animationDelay,
            animationDuration: el.animationDuration,
          }}
        />
      ))}
    </>
  );
};
