"use client";

/**
 * One shared sub-page tab bar for the big sections (Money, Expenses,
 * Invoices, Projects, Contracts). Big pill buttons with an optional count —
 * a child can understand "tap the word, see that thing" and every section
 * gets the same look for its sub-pages.
 */
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
    <div className="flex items-center gap-2 flex-wrap border-b border-line pb-2">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              active
                ? "bg-accent-soft text-info border border-accent/30"
                : "text-muted hover:text-fg hover:bg-surface"
            }`}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span
                className={`min-w-5 px-1.5 py-0.5 rounded-full text-[10px] font-mono text-center ${
                  active ? "bg-accent text-accent-fg" : "bg-surface text-muted"
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
