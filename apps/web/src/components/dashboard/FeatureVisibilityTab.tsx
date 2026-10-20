"use client";

import React from "react";
import {
  ShieldCheck,
  Eye,
  Sparkles,
  CheckCircle2,
} from "@/components/animated-icons";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
      aria-label={`${on ? "Hide" : "Show"} ${title}`}
      onClick={() => onChange(!on)}
      className={`relative w-10 h-6 rounded-full border transition-colors duration-200 shrink-0 cursor-pointer ${
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

function LabelInput({
  id,
  fallback,
  labelFor,
  setFlag,
}: {
  id: string;
  fallback: string;
  labelFor: (id: string, fallback: string) => string;
  setFlag: (key: string, patch: { visible?: boolean; label_override?: string | null }) => Promise<void>;
}) {
  // Uncontrolled: the tab only mounts once flags are loaded, and the current
  // input text should survive the context update that follows the save.
  return (
    <input
      type="text"
      defaultValue={labelFor(id, fallback)}
      placeholder={fallback}
      onBlur={(e) => {
        const next = e.target.value.trim();
        if (next !== labelFor(id, fallback)) {
          void setFlag(id, { label_override: next || null });
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-full max-w-[220px] px-2.5 py-1.5 rounded-lg bg-bg border border-line text-fg text-xs focus:outline-none focus:ring-2 focus:ring-accent"
    />
  );
}

// Settings → Features: owner-only control room for what every other account
// can see. Toggles save instantly (optimistic, with rollback on failure);
// sidebar text saves on blur / Enter. The owner's own account always sees
// everything regardless of these switches.
export function FeatureVisibilityTab() {
  const { isOwner, isVisible, labelFor, setFlag } = useFeatureFlags();

  if (!isOwner) return null;

  return (
    <div className="space-y-6">
      <Card className="bg-card border-line backdrop-blur-md">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-accent-soft border border-accent/20">
            <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-sm font-bold text-fg flex items-center gap-2">
                Owner mode
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-accent bg-card border border-accent/30 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  you see everything
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Switches below control what <span className="text-fg font-semibold">other accounts</span> can
                see — perfect for presenting work-in-progress. Hidden features disappear from the
                sidebar and command menu, and opening their URLs shows a 404 so the pages stay
                completely inaccessible. Your own login is never affected. Changes save instantly
                and apply to everyone on their next page load.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-line backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-fg text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            Feature pages
          </CardTitle>
          <CardDescription className="text-muted text-xs">
            Toggle visibility for everyone else, and rename any sidebar entry. Empty text field =
            default name.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {FEATURES.filter((f) => !f.locked).map((feature) => {
            const visible = isVisible(feature.key);
            const Icon = feature.icon;
            return (
              <div
                key={feature.key}
                className={`rounded-xl border p-4 transition-opacity ${
                  visible ? "border-line bg-bg/50" : "border-dashed border-line bg-bg/30 opacity-70"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      visible ? "bg-accent-soft border-accent/30 text-accent" : "bg-surface border-line text-faint"
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-fg truncate">
                      {labelFor(feature.key, feature.title)}
                      {!visible && (
                        <span className="ml-2 text-[10px] font-mono font-semibold text-warn uppercase tracking-wide">
                          hidden
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted truncate">{feature.description}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {visible && <Eye className="w-3.5 h-3.5 text-muted" />}
                    <VisibilityToggle
                      on={visible}
                      title={feature.title}
                      onChange={(next) => void setFlag(feature.key, { visible: next })}
                    />
                  </div>
                </div>

                <div className="mt-3 pl-12 space-y-2">
                  <div className="text-[10px] font-semibold text-faint uppercase tracking-wider">
                    Sidebar text
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <LabelInput
                      id={feature.key}
                      fallback={feature.title}
                      labelFor={labelFor}
                      setFlag={setFlag}
                    />
                    {feature.subItems?.map((sub) => (
                      <LabelInput
                        key={sub.id}
                        id={sub.id}
                        fallback={sub.title}
                        labelFor={labelFor}
                        setFlag={setFlag}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
