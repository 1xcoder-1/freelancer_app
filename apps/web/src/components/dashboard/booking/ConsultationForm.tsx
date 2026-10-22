"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Clock, Loader2, AlertCircle, Video } from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";
import { BookingConsultationPayload } from "@/lib/api";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { logHandledError } from "@/lib/log-error";

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_MASK = "1111100";

const DURATION_OPTIONS = [
  { value: "15", label: "15 Minutes" },
  { value: "30", label: "30 Minutes" },
  { value: "45", label: "45 Minutes" },
  { value: "60", label: "60 Minutes" },
  { value: "90", label: "90 Minutes" },
];

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, i) => ({
  value: String(i),
  label: i === 0 || i === 24 ? `${i}:00` : `${String(i).padStart(2, "0")}:00`,
}));

export interface ConsultationFormState {
  title: string;
  description: string;
  durationMinutes: number;
  weekdayMask: string;
  startHour: number;
  endHour: number;
  minLeadHours: number;
  maxAdvanceDays: number;
  bufferMinutes: number;
  noShowLimit: number;
}

const bookingFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Service title must be at least 2 characters")
    .max(150, "Title cannot exceed 150 characters"),
  description: z.string().trim().max(1000, "Description cannot exceed 1000 characters").optional(),
  durationMinutes: z.number().int().positive().max(1440),
});

export const emptyFormState: ConsultationFormState = {
  title: "",
  description: "",
  durationMinutes: 30,
  weekdayMask: DEFAULT_MASK,
  startHour: 9,
  endHour: 17,
  minLeadHours: 2,
  maxAdvanceDays: 60,
  bufferMinutes: 0,
  noShowLimit: 2,
};

export function formStateFrom(
  c: Partial<ConsultationFormState> & {
    start_minute?: number;
    end_minute?: number;
  }
): ConsultationFormState {
  return {
    ...emptyFormState,
    ...c,
    title: c.title ?? "",
    description: c.description ?? "",
    startHour: c.startHour ?? Math.floor((c.start_minute ?? 540) / 60),
    endHour: c.endHour ?? Math.floor((c.end_minute ?? 1020) / 60),
  };
}

/* ------------------------------------------------------------------
   The consultation editor shared by /booking/new and /booking/[id]/edit:
   validation, unsaved-draft guard, Project-Roster-style cards and the
   sticky live preview. The page owns only the header actions, submit
   call and anything bolted under the form (e.g. the days-off editor).
------------------------------------------------------------------- */
export function ConsultationForm({
  initial,
  isActive,
  draftKey,
  headline,
  backHref,
  backLabel,
  submitLabel,
  doneHref,
  onSubmit,
  children,
}: {
  initial: ConsultationFormState;
  isActive?: boolean;
  draftKey: string;
  headline: string;
  backHref: string;
  backLabel?: string;
  submitLabel: string;
  doneHref: string;
  onSubmit: (payload: BookingConsultationPayload) => Promise<void>;
  children?: React.ReactNode;
}) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [durationMinutes, setDurationMinutes] = useState(initial.durationMinutes);
  const [weekdayMask, setWeekdayMask] = useState(initial.weekdayMask);
  const [startHour, setStartHour] = useState(initial.startHour);
  const [endHour, setEndHour] = useState(initial.endHour);
  const [minLeadHours, setMinLeadHours] = useState(initial.minLeadHours);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(initial.maxAdvanceDays);
  const [bufferMinutes, setBufferMinutes] = useState(initial.bufferMinutes);
  const [noShowLimit, setNoShowLimit] = useState(initial.noShowLimit);

  const formValues = useMemo(
    () => ({
      title, description, durationMinutes, weekdayMask,
      startHour, endHour, minLeadHours, maxAdvanceDays, bufferMinutes, noShowLimit,
    }),
    [title, description, durationMinutes, weekdayMask, startHour, endHour, minLeadHours, maxAdvanceDays, bufferMinutes, noShowLimit]
  );

  const applyDraft = useCallback((saved: Record<string, unknown>) => {
    const str = (k: string, d = "") => (typeof saved[k] === "string" ? (saved[k] as string) : d);
    const num = (k: string, d: number) => (typeof saved[k] === "number" ? (saved[k] as number) : d);
    setTitle(str("title"));
    setDescription(str("description"));
    setDurationMinutes(num("durationMinutes", initial.durationMinutes));
    const mask = str("weekdayMask");
    if (/^[01]{7}$/.test(mask)) setWeekdayMask(mask);
    setStartHour(num("startHour", initial.startHour));
    setEndHour(num("endHour", initial.endHour));
    setMinLeadHours(num("minLeadHours", initial.minLeadHours));
    setMaxAdvanceDays(num("maxAdvanceDays", initial.maxAdvanceDays));
    setBufferMinutes(num("bufferMinutes", initial.bufferMinutes));
    setNoShowLimit(num("noShowLimit", initial.noShowLimit));
  }, [initial]);

  const guard = useUnsavedChangesGuard({
    values: formValues,
    draftKey,
    onRestoreDraft: applyDraft,
  });

  const toggleDay = (idx: number) => {
    setWeekdayMask((prev) => {
      const arr = prev.split("");
      arr[idx] = arr[idx] === "1" ? "0" : "1";
      return arr.join("");
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = bookingFormSchema.safeParse({
      title,
      description,
      durationMinutes: Number(durationMinutes),
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
      });
      setErrors(fieldErrors);
      toast.error(result.error.issues[0]?.message || "Please check required fields");
      return;
    }
    if (weekdayMask === "0000000") {
      toast.error("Pick at least one booking day.");
      return;
    }
    if (endHour <= startHour) {
      toast.error("The closing hour must be after the opening hour.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        duration_minutes: Number(durationMinutes),
        meeting_provider: "google_meet",
        is_active: isActive ?? true,
        weekday_mask: weekdayMask,
        start_minute: startHour * 60,
        end_minute: endHour * 60,
        min_lead_hours: Number(minLeadHours),
        max_advance_days: Number(maxAdvanceDays),
        buffer_minutes: Number(bufferMinutes),
        no_show_limit: Number(noShowLimit),
      });
      guard.markSaved();
      router.push(doneHref);
    } catch (err) {
      logHandledError("Failed to save consultation:", err);
      toast.error(err instanceof Error ? err.message : "Could not save service");
    } finally {
      setSaving(false);
    }
  };

  const openDays =
    weekdayMask === "1111100"
      ? "Mon – Fri"
      : weekdayMask === "1111111"
        ? "Everyday"
        : DAY_LABELS.filter((_, i) => weekdayMask[i] === "1").join(", ") || "None";

  const setPresetDays = (preset: "weekdays" | "everyday") => {
    setWeekdayMask(preset === "weekdays" ? "1111100" : "1111111");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6 enter-stagger">
      {/* Top Breadcrumb & Quick Nav */}
      <div className="flex items-center justify-between pb-1">
        <Link
          href={backHref}
          className="group inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-fg transition-colors cursor-pointer"
        >
          <span className="w-6 h-6 rounded-lg bg-surface border border-line/70 flex items-center justify-center transition-all group-hover:bg-surface-elevated group-hover:border-line-strong group-hover:-translate-x-0.5">
            <ArrowLeft className="w-3.5 h-3.5 text-muted group-hover:text-fg" />
          </span>
          <span className="text-muted/80">Services</span>
          <span className="text-faint">/</span>
          <span className="text-fg font-medium capitalize">{headline}</span>
        </Link>
      </div>

      {/* Main Header Card: Title & Actions */}
      <div className="relative overflow-hidden rounded-2xl border border-line/70 bg-gradient-to-b from-card to-card/90 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-fg capitalize">
            {headline}
          </h1>
          <p className="text-xs text-muted/80 mt-1">Configure service settings, duration, and availability rules</p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => guard.guardedPush(doneHref)}
            disabled={saving}
            className="h-9 px-3.5 rounded-xl border border-line bg-surface/50 hover:bg-surface-elevated hover:border-line-strong text-muted hover:text-fg font-medium text-xs transition-all active:scale-[0.97] cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="booking-form"
            disabled={saving || !title.trim()}
            className="h-9 px-4 rounded-xl border border-accent/40 bg-accent/15 hover:bg-accent hover:text-white text-accent font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-[0.96] shadow-[0_0_16px_rgba(212,107,40,0.12)] cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{submitLabel}</span>
            )}
          </Button>
        </div>
      </div>

      <form id="booking-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: form fields */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Service details */}
          <div className="rounded-2xl border border-line/70 bg-card p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-4">
            <h2 className="font-display text-base font-medium tracking-wide text-fg pb-2.5 border-b border-line/60">
              Service Details
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg block">
                Title <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
                }}
                placeholder="e.g. 1:1 Consultation"
                className={`w-full h-10 px-3.5 rounded-xl border bg-surface/50 text-fg text-sm placeholder:text-muted/60 focus:border-accent/60 focus:bg-card focus:outline-none focus:ring-1 focus:ring-accent/30 transition-all ${
                  errors.title ? "border-danger" : "border-line"
                }`}
              />
              {errors.title && (
                <p className="text-[11px] text-danger flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.title}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg block">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of what this session covers."
                className="w-full p-3 rounded-xl border border-line bg-surface/50 text-fg placeholder:text-muted/60 text-xs sm:text-sm focus:border-accent/60 focus:bg-card focus:outline-none focus:ring-1 focus:ring-accent/30 transition-all resize-y"
              />
            </div>

            <div className="space-y-1.5 sm:max-w-[50%]">
              <label className="text-xs font-medium text-fg block">Duration</label>
              <CustomSelect
                value={String(durationMinutes)}
                onChange={(v) => setDurationMinutes(Number(v))}
                options={DURATION_OPTIONS}
              />
            </div>
          </div>

          {/* 2. Opening hours & availability */}
          <div className="rounded-2xl border border-line/70 bg-card p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-4">
            <h2 className="font-display text-base font-medium tracking-wide text-fg pb-2.5 border-b border-line/60">
              Schedule & Rules
            </h2>

            {/* Available Days section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-fg">Available Days</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPresetDays("weekdays")}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                      weekdayMask === "1111100"
                        ? "bg-accent/15 text-accent border-accent/30 font-semibold"
                        : "bg-surface/50 text-muted border-line hover:text-fg hover:border-line-strong"
                    }`}
                  >
                    Mon – Fri
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDays("everyday")}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                      weekdayMask === "1111111"
                        ? "bg-accent/15 text-accent border-accent/30 font-semibold"
                        : "bg-surface/50 text-muted border-line hover:text-fg hover:border-line-strong"
                    }`}
                  >
                    All Days
                  </button>
                </div>
              </div>

              {/* 7-Day Pill Strip */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {DAY_LABELS.map((d, i) => {
                  const active = weekdayMask[i] === "1";
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`text-xs py-2 rounded-xl border font-mono transition-all cursor-pointer select-none text-center ${
                        active
                          ? "bg-accent/15 text-accent border-accent/30 font-semibold shadow-2xs"
                          : "bg-surface/40 text-faint border-line/40 hover:border-line-strong hover:text-muted hover:bg-surface/70"
                      }`}
                    >
                      {d.slice(0, 2)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hours & Rules in a clean grid */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-line/60">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Opens</label>
                <CustomSelect value={String(startHour)} onChange={(v) => setStartHour(Number(v))} options={HOUR_OPTIONS} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Closes</label>
                <CustomSelect value={String(endHour)} onChange={(v) => setEndHour(Number(v))} options={HOUR_OPTIONS} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Buffer Padding</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={240}
                    value={bufferMinutes}
                    onChange={(e) => setBufferMinutes(Number(e.target.value))}
                    className="w-full h-10 px-3.5 pr-8 rounded-xl border border-line bg-surface/50 text-fg text-sm font-mono focus:border-accent/60 focus:bg-card focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted font-mono">min</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Min Notice</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={336}
                    value={minLeadHours}
                    onChange={(e) => setMinLeadHours(Number(e.target.value))}
                    className="w-full h-10 px-3.5 pr-8 rounded-xl border border-line bg-surface/50 text-fg text-sm font-mono focus:border-accent/60 focus:bg-card focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted font-mono">hrs</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Advance Booking</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={maxAdvanceDays}
                    onChange={(e) => setMaxAdvanceDays(Number(e.target.value))}
                    className="w-full h-10 px-3.5 pr-10 rounded-xl border border-line bg-surface/50 text-fg text-sm font-mono focus:border-accent/60 focus:bg-card focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted font-mono">days</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">No-Show Limit</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={noShowLimit}
                    onChange={(e) => setNoShowLimit(Number(e.target.value))}
                    className="w-full h-10 px-3.5 pr-10 rounded-xl border border-line bg-surface/50 text-fg text-sm font-mono focus:border-accent/60 focus:bg-card focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted font-mono">calls</span>
                </div>
              </div>
            </div>
          </div>

          {/* Extra blocks the page needs — e.g. days off on the edit page */}
          {children}
        </div>

        {/* Right column: live preview */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">Card Preview</span>
            <span className="text-[11px] font-mono text-accent">Live Preview</span>
          </div>

          {/* Real CategoryVisualCard matching the Services Roster */}
          <CategoryVisualCard
            title={title.trim() || "Service Title"}
            subtitle={`${durationMinutes} min online consultation`}
            hidePrefix
            className="w-full shadow-sm min-h-[200px]"
            topRightContent={
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.12)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            }
            tags={
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-muted bg-surface px-2.5 py-0.5 rounded-full border border-line flex items-center gap-1">
                  <Clock className="w-3 h-3 text-accent" />
                  {durationMinutes}m
                </span>
              </div>
            }
            icon={
              <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent shadow-2xs">
                <Video className="w-4 h-4" />
              </div>
            }
          />

          {/* Clean Schedule Summary */}
          <div className="rounded-2xl border border-line/70 bg-card p-5 text-xs space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="flex items-center justify-between text-muted border-b border-line/40 pb-2">
              <span>Days</span>
              <span className="font-medium text-fg">{openDays}</span>
            </div>
            <div className="flex items-center justify-between text-muted border-b border-line/40 pb-2">
              <span>Hours</span>
              <span className="font-mono text-fg font-medium">
                {String(startHour).padStart(2, "0")}:00 – {String(endHour).padStart(2, "0")}:00
              </span>
            </div>
            <div className="flex items-center justify-between text-muted pt-0.5">
              <span>Meeting Platform</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface border border-line text-fg">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Google Meet
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
