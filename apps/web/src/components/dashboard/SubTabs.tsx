"use client";

import { motion } from "framer-motion";

export interface SubTab {
  value: string;
  label: string;
  count?: number;
}

export function SubTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly SubTab[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center p-1 rounded-xl bg-surface/70 border border-line max-w-full overflow-x-auto no-scrollbar scrollbar-none gap-1">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer select-none shrink-0 ${
              active ? "text-accent-fg font-semibold" : "text-muted hover:text-fg hover:bg-surface/50"
            }`}
          >
            {active && (
              <motion.div
                layoutId="activeSubTabPill"
                className="absolute inset-0 bg-accent rounded-lg shadow-xs"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10">{t.label}</span>
            {typeof t.count === "number" && (
              <span
                className={`relative z-10 min-w-4 px-1.5 py-0.2 rounded-full text-[10px] font-mono text-center transition-colors ${
                  active ? "bg-accent-hi text-accent-fg" : "bg-surface text-muted border border-line"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
