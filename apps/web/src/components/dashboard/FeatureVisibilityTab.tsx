"use client";

import { Fragment } from "react";
import { FEATURES } from "@/lib/features";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

function VisibilityToggle({
  on,
  title,
  onChange,
}: {
  on: boolean;
  title: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${on ? "Hide" : "Show"} ${title} for other accounts`}
      onClick={() => onChange(!on)}
      className={`relative w-10 h-6 rounded-full border transition-colors duration-200 shrink-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        on ? "bg-accent border-accent" : "bg-surface border-line-strong"
      }`}
    >
      <span
        className={`absolute top-[1px] left-[1px] w-[20px] h-[20px] rounded-full bg-card shadow-sm transition-transform duration-200 ${
          on ? "translate-x-[16px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// Settings → Workspace: owner-only control list for what every other account
// can see. Toggles save instantly (optimistic, with rollback on failure).
// The owner's own account always keeps access regardless of these switches.
export function FeatureVisibilityTab() {
  const { ready, isOwner, isVisible, labelFor, setVisible } = useFeatureFlags();

  if (!isOwner) return null;

  const features = FEATURES.filter((feature) => !feature.locked);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold text-fg">Page access</h3>
        <p className="text-[11px] text-muted mt-0.5">
          Hidden pages stay available to your account and disappear for everyone else.
        </p>
      </div>

      {!ready ? (
        <div className="rounded-xl border border-line bg-bg/40 p-2 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-surface animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-bg/40 divide-y divide-line/70">
          {features.map((feature) => {
            const visible = isVisible(feature.key);
            const Icon = feature.icon;
            // Sub-items with their own flagKey (Planner → Task Management)
            // get their own row under the parent; the rest follow the
            // feature's toggle and need no row of their own.
            const gatedSubs = feature.subItems?.filter((s) => s.flagKey) ?? [];
            return (
              <Fragment key={feature.key}>
                <div className="flex items-center gap-3 px-3.5 py-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${visible ? "text-accent" : "text-faint"}`}
                  />
                  <span
                    className={`flex-1 min-w-0 truncate text-sm ${
                      visible ? "text-fg" : "text-muted"
                    }`}
                  >
                    {labelFor(feature.key, feature.title)}
                  </span>
                  {!visible && (
                    <span className="text-[10px] font-mono uppercase tracking-wide text-warn">
                      Hidden
                    </span>
                  )}
                  <VisibilityToggle
                    on={visible}
                    title={feature.title}
                    onChange={(next) => void setVisible(feature.key, next)}
                  />
                </div>
                {gatedSubs.map((sub) => {
                  const subFlagKey = sub.flagKey;
                  if (!subFlagKey) return null;
                  const subVisible = isVisible(subFlagKey);
                  const SubIcon = sub.icon;
                  return (
                    <div
                      key={sub.id}
                      className="flex items-center gap-3 py-2.5 pl-9 pr-3.5"
                    >
                      <SubIcon
                        className={`w-4 h-4 shrink-0 ${subVisible ? "text-accent" : "text-faint"}`}
                      />
                      <span
                        className={`flex-1 min-w-0 truncate text-sm ${
                          subVisible ? "text-fg" : "text-muted"
                        }`}
                      >
                        {labelFor(sub.id, sub.title)}
                      </span>
                      {!subVisible && (
                        <span className="text-[10px] font-mono uppercase tracking-wide text-warn">
                          Hidden
                        </span>
                      )}
                      <VisibilityToggle
                        on={subVisible}
                        title={sub.title}
                        onChange={(next) => void setVisible(subFlagKey, next)}
                      />
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
}
