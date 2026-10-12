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
import { BookingConsultationPayload } from "@/lib/api";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

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
  price: number;
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
  price: z.number().min(0, "Price cannot be negative"),
});

export const emptyFormState: ConsultationFormState = {
  title: "",
  description: "",
  durationMinutes: 30,
  price: 100,
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
  const [price, setPrice] = useState(initial.price);
  const [weekdayMask, setWeekdayMask] = useState(initial.weekdayMask);
  const [startHour, setStartHour] = useState(initial.startHour);
  const [endHour, setEndHour] = useState(initial.endHour);
  const [minLeadHours, setMinLeadHours] = useState(initial.minLeadHours);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(initial.maxAdvanceDays);
  const [bufferMinutes, setBufferMinutes] = useState(initial.bufferMinutes);
  const [noShowLimit, setNoShowLimit] = useState(initial.noShowLimit);

  const formValues = useMemo(
    () => ({
      title, description, durationMinutes, price, weekdayMask,
      startHour, endHour, minLeadHours, maxAdvanceDays, bufferMinutes, noShowLimit,
    }),
    [title, description, durationMinutes, price, weekdayMask, startHour, endHour, minLeadHours, maxAdvanceDays, bufferMinutes, noShowLimit]
  );

  const applyDraft = useCallback((saved: Record<string, unknown>) => {
    const str = (k: string, d = "") => (typeof saved[k] === "string" ? (saved[k] as string) : d);
    const num = (k: string, d: number) => (typeof saved[k] === "number" ? (saved[k] as number) : d);
    setTitle(str("title"));
    setDescription(str("description"));
    setDurationMinutes(num("durationMinutes", initial.durationMinutes));
    setPrice(num("price", initial.price));
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
      price: Number(price),
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
        price: Number(price),
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
      console.error("Failed to save consultation:", err);
      toast.error(err instanceof Error ? err.message : "Could not save service");
    } finally {
      setSaving(false);
    }
  };

  const openDays = DAY_LABELS.filter((_, i) => weekdayMask[i] === "1").join(" ") || "—";

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Services</span>
          </Link>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            {headline}
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => guard.guardedPush(doneHref)}
            disabled={saving}
            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg border border-line bg-card hover:bg-surface text-fg font-medium text-xs sm:text-sm transition-all duration-150 cursor-pointer disabled:opacity-50 h-9"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="booking-form"
            disabled={saving || !title.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none h-9"
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
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <h2 className="text-sm font-medium text-fg">Service & Pricing</h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg block">
                Session Title <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
                }}
                placeholder="e.g. 30-Minute Architecture Review"
                className={`w-full h-10 px-3.5 rounded-xl border bg-surface/50 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all ${errors.title ? "border-danger" : "border-line"}`}
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
                placeholder="What the session covers."
                className="w-full p-3 rounded-xl border border-line bg-surface/50 text-fg placeholder:text-muted/60 text-xs sm:text-sm focus:border-accent focus:bg-card focus:outline-none transition-all resize-y"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Duration</label>
                <CustomSelect
                  value={String(durationMinutes)}
                  onChange={(v) => setDurationMinutes(Number(v))}
                  options={DURATION_OPTIONS}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Price ($ USD)</label>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className={`w-full h-10 px-3.5 rounded-xl border bg-surface/50 text-fg text-sm font-mono focus:border-accent focus:bg-card focus:outline-none transition-all ${errors.price ? "border-danger" : "border-line"}`}
                />
                {errors.price && (
                  <p className="text-[11px] text-danger flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.price}
                  </p>
                )}
              </div>
            </div>

            {price > 0 && (
              <p className="text-[11px] text-warn">Paid — the booking is confirmed only after payment lands.</p>
            )}
          </Card>

          {/* 2. Opening hours */}
          <Card className="p-5 sm:p-6 rounded-2xl border border-line bg-card space-y-5 shadow-xs">
            <div className="flex items-center justify-between pb-1 border-b border-line/50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <h2 className="text-sm font-medium text-fg">Opening Hours</h2>
              </div>
              <span className="text-[11px] font-mono text-muted tracking-wider">Slots & Rules</span>
            </div>

            <div className="space-y-2.5">
              <label className="text-xs font-medium text-fg">Booking days</label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((d, i) => {
                  const active = weekdayMask[i] === "1";
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`text-xs px-3.5 py-1.5 rounded-xl border font-medium transition-all cursor-pointer ${
                        active
                          ? "bg-accent text-accent-fg border-accent shadow-xs"
                          : "bg-surface/60 text-muted border-line hover:border-line-strong hover:text-fg"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

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
                <label className="text-xs font-medium text-fg block">Buffer between calls (min)</label>
                <input
                  type="number"
                  min={0}
                  max={240}
                  value={bufferMinutes}
                  onChange={(e) => setBufferMinutes(Number(e.target.value))}
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm font-mono focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Minimum lead time (hrs)</label>
                <input
                  type="number"
                  min={0}
                  max={336}
                  value={minLeadHours}
                  onChange={(e) => setMinLeadHours(Number(e.target.value))}
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm font-mono focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Max advance (days)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={maxAdvanceDays}
                  onChange={(e) => setMaxAdvanceDays(Number(e.target.value))}
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm font-mono focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">No-show strike limit</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={noShowLimit}
                  onChange={(e) => setNoShowLimit(Number(e.target.value))}
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm font-mono focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>
            </div>
          </Card>

          {/* Extra blocks the page needs — e.g. days off on the edit page */}
          {children}
        </div>

        {/* Right column: live preview */}
        <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-6">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted">Card Preview</span>
            <span className="text-[11px] font-mono text-muted">{durationMinutes} min</span>
          </div>

          <Card className="rounded-2xl border-line bg-card p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-fg break-words">{title.trim() || "Service Title"}</h3>
              <span className="font-mono text-accent font-bold shrink-0">
                {Number.isFinite(price) && price > 0 ? `$${Number(price).toFixed(2)}` : "Free"}
              </span>
            </div>
            <p className="text-xs text-muted">
              {description.trim() || "Client 1-on-1 consultation session."}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-mono pt-1">
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-info" />{durationMinutes} min</span>
              <span>•</span>
              <span>{openDays}</span>
              <span>•</span>
              <span>{String(startHour).padStart(2, "0")}:00–{String(endHour).padStart(2, "0")}:00</span>
            </div>
            <div className="flex items-center gap-2 border-t border-line pt-4">
              <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-surface text-fg border border-line">
                <Video className="w-3 h-3 text-info" /> Google Meet link on booking
              </span>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
