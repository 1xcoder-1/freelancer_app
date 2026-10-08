"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Loader2,
  ChevronDown,
  AlertCircle,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { getLead, getDuplicateConflict, updateLead, closeLead, type Lead, type LeadStage } from "@/lib/api";
import { resolveDuplicateConflict } from "@/lib/duplicate-conflict";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { invalidateCache } from "@/hooks/use-api-data";
import { z } from "zod";
import { toast } from "sonner";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";

const leadFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Contact name must be at least 2 characters")
    .max(100, "Contact name cannot exceed 100 characters"),
  company: z
    .string()
    .trim()
    .max(100, "Company name cannot exceed 100 characters")
    .optional(),
  email: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .email("Please enter a valid email address"),
  ]),
  phone: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .min(6, "Phone number must be at least 6 digits")
      .max(25, "Phone number cannot exceed 25 characters"),
  ]),
  estimatedValue: z.string().optional(),
});

const DEFAULT_CATEGORIES = [
  "Featured",
  "High Value Deals",
  "In Discussion",
  "Referrals & Inbound",
  "Design & Dev Sprints",
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD ($)" },
  { value: "PKR", label: "PKR (₨)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "AED", label: "AED (د.إ)" },
  { value: "CAD", label: "CAD ($)" },
  { value: "AUD", label: "AUD ($)" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low Priority" },
  { value: "medium", label: "Medium Priority" },
  { value: "high", label: "High Priority" },
  { value: "urgent", label: "Urgent Priority" },
];

const SOURCE_OPTIONS = [
  { value: "Referral", label: "Referral" },
  { value: "Platform / Upwork", label: "Platform / Upwork" },
  { value: "Outreach & Cold Email", label: "Outreach & Cold Email" },
  { value: "Website Inbound", label: "Website Inbound" },
  { value: "Social Media", label: "Social Media" },
  { value: "Past Client", label: "Past Client" },
  { value: "Other", label: "Other" },
];

const STAGES: Array<{ key: LeadStage; label: string; step: number; tone: string }> = [
  { key: "new", label: "New", step: 1, tone: "bg-surface text-muted" },
  { key: "contacted", label: "Contacted", step: 2, tone: "bg-info/10 text-info" },
  { key: "proposal", label: "Proposal", step: 3, tone: "bg-accent-soft text-accent" },
  { key: "negotiation", label: "Negotiating", step: 4, tone: "bg-warn/10 text-warn" },
  { key: "won", label: "Won", step: 5, tone: "bg-ok/10 text-ok" },
];

const formatAmountWithCommas = (val: string): string => {
  if (!val) return "";
  const suffixMatch = val.match(/\s*(\/.*|[a-zA-Z]+)$/);
  const suffix = suffixMatch ? suffixMatch[0] : "";
  const numericOnly = suffixMatch ? val.slice(0, suffixMatch.index) : val;

  const clean = numericOnly.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!clean) return suffix.trim();

  const parts = clean.split(".");
  const intStr = parts[0];
  const formattedInt = intStr ? Number(intStr).toLocaleString("en-US") : "0";

  if (parts.length > 1) {
    const decStr = parts[1].slice(0, 2);
    return `${formattedInt}.${decStr}${suffix}`;
  }

  return `${formattedInt}${suffix}`;
};

export default function EditLeadPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = String(params?.id || "");
  const { getToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form State
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("Referral");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [priority, setPriority] = useState<Lead["priority"]>("medium");
  const [stage, setStage] = useState<LeadStage>("new");
  const [followUpDays, setFollowUpDays] = useState("3");
  const [category, setCategory] = useState("Featured");
  const [customCategory, setCustomCategory] = useState("");
  const [notes, setNotes] = useState("");

  const effectiveCategory = customCategory.trim() || category || "Featured";

  // Unsaved-changes guard. The baseline is captured once after the record
  // loads, so the empty form shell never counts as dirty, and a restored
  // draft (still differing from the record) does.
  const formValues = useMemo(
    () => ({
      name, company, email, phone, source, estimatedValue, currency,
      priority, stage, followUpDays, category, customCategory, notes,
    }),
    [name, company, email, phone, source, estimatedValue, currency, priority, stage, followUpDays, category, customCategory, notes]
  );
  const [initialValues, setInitialValues] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!loading && !initialValues) setInitialValues({ ...formValues });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const applyDraft = useCallback((saved: Record<string, unknown>) => {
    const str = (k: string, d = "") => (typeof saved[k] === "string" && (saved[k] as string) !== "[object Object]" ? (saved[k] as string) : d);
    setName(str("name"));
    setCompany(str("company"));
    setEmail(str("email"));
    setPhone(str("phone"));
    setSource(str("source", "Referral"));
    setEstimatedValue(str("estimatedValue"));
    setCurrency(str("currency", "USD"));
    const pr = str("priority", "medium");
    setPriority(["low", "medium", "high", "urgent"].includes(pr) ? (pr as Lead["priority"]) : "medium");
    const st = str("stage", "new");
    setStage(STAGES.some((s) => s.key === st) ? (st as LeadStage) : "new");
    setFollowUpDays(str("followUpDays", "3"));
    setCategory(str("category", "Featured"));
    setCustomCategory(str("customCategory"));
    setNotes(str("notes"));
  }, []);

  const guard = useUnsavedChangesGuard({
    values: formValues,
    initial: initialValues ?? undefined,
    enabled: !loading && !!initialValues,
    draftKey: `lead-edit-${leadId}`,
    onRestoreDraft: applyDraft,
  });

  // Load existing lead details
  useEffect(() => {
    let mounted = true;

    async function loadLeadData() {
      if (!leadId) return;
      try {
        const token = (await getToken()) || undefined;
        const l: Lead = await getLead(leadId, token);

        if (!mounted || !l) return;

        setName(l.name || "");
        setCompany(l.company || "");
        setEmail(l.email || "");
        setPhone(l.phone || "");
        setSource(l.source || "Referral");
        setStage(l.stage || "new");
        setPriority(l.priority || "medium");
        setEstimatedValue(formatAmountWithCommas(String(l.estimated_value || 0)));

        if (l.notes) {
          const catMatch = l.notes.match(/\[category:\s*([^\]]+)\]/i);
          if (catMatch && catMatch[1]) {
            const rawCat = catMatch[1].trim();
            if (DEFAULT_CATEGORIES.includes(rawCat)) {
              setCategory(rawCat);
              setCustomCategory("");
            } else if (rawCat !== "[object Object]") {
              setCategory("Featured");
              setCustomCategory(rawCat);
            }
          }

          const currMatch = l.notes.match(/\[currency:\s*([^\]]+)\]/i);
          if (currMatch && currMatch[1] && currMatch[1].trim() !== "[object Object]") {
            setCurrency(currMatch[1].trim());
          }

          const cleanNotes = l.notes
            .replace(/\[category:\s*[^\]]+\]/gi, "")
            .replace(/\[currency:\s*[^\]]+\]/gi, "")
            .replace(/\[object Object\]/gi, "")
            .trim();
          setNotes(cleanNotes);
        }
      } catch (err) {
        console.error("Error loading lead:", err);
        toast.error("Failed to load lead details");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadLeadData();
    return () => {
      mounted = false;
    };
  }, [leadId, getToken]);

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAmountWithCommas(e.target.value);
    setEstimatedValue(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = leadFormSchema.safeParse({
      name,
      company,
      email,
      phone,
      estimatedValue,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[String(err.path[0])] = err.message;
        }
      });
      setErrors(fieldErrors);
      toast.error(result.error.issues[0]?.message || "Please check required fields");
      return;
    }

    setSaving(true);
    const chosenCategory = customCategory.trim() || category;
    const cleanUserNotes = notes.trim();
    const finalNotes = cleanUserNotes
      ? `[category: ${chosenCategory}][currency: ${currency}]\n${cleanUserNotes}`
      : `[category: ${chosenCategory}][currency: ${currency}]`;

    const numericVal = parseFloat(estimatedValue.replace(/,/g, "") || "0") || 0;
    const days = Math.min(90, Math.max(0, parseInt(followUpDays || "3", 10) || 3));
    const nextFollowUp = new Date(Date.now() + days * 86_400_000).toISOString();

    try {
      const token = (await getToken()) || undefined;
      const basePayload: Partial<Lead> = {
        name: name.trim(),
        company: company.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        source,
        priority,
        estimated_value: numericVal,
        next_follow_up_at: nextFollowUp,
        notes: finalNotes,
      };
      if (stage === "won" || stage === "lost") {
        // SE8: a terminal stage is a decision, not a field edit — the generic
        // PATCH rejects it, so save the details then close through /close.
        await updateLead(leadId, basePayload, token);
        await closeLead(leadId, { outcome: stage }, token);
      } else {
        await updateLead(leadId, { ...basePayload, stage }, token);
      }

      invalidateCache("leads:data");
      invalidateCache("leads:insights");
      invalidateCache("dashboard:data");

      toast.success("Lead updated successfully");
      // Saved: drop the draft + clear dirty so the redirect is never blocked.
      guard.markSaved();
      router.push(`/dashboard/leads/${leadId}`);
    } catch (err) {
      const conflict = getDuplicateConflict(err);
      if (conflict) {
        // PATCH conflicts are always strict email hits: one email, one
        // person — offer the existing record instead of a second row.
        const res = await resolveDuplicateConflict(conflict);
        if (res.action === "open") guard.forcePush(res.path);
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not update lead");
    } finally {
      setSaving(false);
    }
  };

  const stageObj = STAGES.find((s) => s.key === stage) || STAGES[0];

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-7 h-7 animate-spin text-accent" />
        <p className="text-xs text-muted font-medium">Loading lead details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6 enter-stagger">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <Link
            href={`/dashboard/leads/${leadId}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Lead</span>
          </Link>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            Edit Lead
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => guard.guardedPush(`/dashboard/leads/${leadId}`)}
            disabled={saving}
            className="text-xs rounded-xl h-9 px-4 border-line"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="edit-lead-form"
            disabled={saving || !name.trim()}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-medium text-xs rounded-xl h-9 px-5 shadow-xs"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </Button>
        </div>
      </div>

      {/* Main Form Layout */}
      <form id="edit-lead-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Fields (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Contact Information */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <h2 className="text-sm font-medium text-fg">
              Contact & Company
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Lead Name <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  placeholder="e.g. Alex Morgan"
                  className={`w-full h-10 px-3.5 rounded-xl border bg-surface/50 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all ${errors.name ? "border-danger" : "border-line"
                    }`}
                />
                {errors.name && (
                  <p className="text-[11px] text-danger flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Company / Organization
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Acme Studio"
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  placeholder="alex@acme.com"
                  className={`w-full h-10 px-3.5 rounded-xl border bg-surface/50 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all ${errors.email ? "border-danger" : "border-line"
                    }`}
                />
                {errors.email && (
                  <p className="text-[11px] text-danger flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.email}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Phone / WhatsApp
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>
            </div>
          </Card>

          {/* 2. Pipeline & Deal Setup */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-5">
            <h2 className="text-sm font-medium text-fg">
              Deal Details & Stage
            </h2>

            {/* Category Pills */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-fg block">
                Pipeline Category
              </label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_CATEGORIES.map((c) => {
                  const active = category === c && !customCategory;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCategory(c);
                        setCustomCategory("");
                      }}
                      className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all ${active
                          ? "bg-accent text-accent-fg border-accent shadow-xs"
                          : "bg-surface/50 text-muted border-line hover:border-accent/40 hover:text-fg"
                        }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Or enter custom category name..."
                className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-xs placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all mt-2"
              />
            </div>

            {/* Stage Selector */}
            <div className="space-y-2 pt-3 border-t border-line/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-fg block">
                  Pipeline Stage
                </label>
                <span className="text-xs font-mono font-medium text-accent">
                  Step {stageObj.step} of 5
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {STAGES.map((s) => {
                  const active = stage === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setStage(s.key)}
                      className={`h-10 rounded-xl border text-center text-xs font-medium transition-all flex items-center justify-center ${active
                          ? "bg-accent text-accent-fg border-accent shadow-xs font-semibold"
                          : "bg-surface/50 text-muted border-line hover:border-accent/40 hover:text-fg"
                        }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Value, Strategy & Follow-Up */}
            <div className="space-y-4 pt-3 border-t border-line/60">
              {/* Estimated Deal Value - Wide Row */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Estimated Deal Value
                </label>
                <div className="flex items-center gap-2.5">
                  <div className="w-32 sm:w-36 shrink-0">
                    <CustomSelect
                      value={currency}
                      onChange={setCurrency}
                      options={CURRENCY_OPTIONS}
                    />
                  </div>
                  <input
                    type="text"
                    value={estimatedValue}
                    onChange={handleRateChange}
                    placeholder="2,500"
                    className="flex-1 min-w-0 w-full h-11 px-4 rounded-xl border border-line bg-surface/60 text-fg text-sm font-mono focus:border-accent focus:bg-card focus:outline-none transition-all placeholder:text-muted/50"
                  />
                </div>
              </div>

              {/* Priority & Source in clean 2-column grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 min-w-0">
                  <label className="text-xs font-medium text-fg block">
                    Priority Level
                  </label>
                  <CustomSelect
                    value={priority}
                    onChange={(val) => setPriority(val as Lead["priority"])}
                    options={PRIORITY_OPTIONS}
                  />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <label className="text-xs font-medium text-fg block">
                    Source Channel
                  </label>
                  <CustomSelect
                    value={source}
                    onChange={setSource}
                    options={SOURCE_OPTIONS}
                  />
                </div>
              </div>

              {/* Follow-Up Schedule Row */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-fg block">
                    Follow Up Schedule
                  </label>
                  <span className="text-[11px] text-muted">
                    {followUpDays ? `Reminder in ${followUpDays} day${Number(followUpDays) === 1 ? "" : "s"}` : "No reminder"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {["1", "3", "7", "14", "30"].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setFollowUpDays(d)}
                        className={`text-xs px-3 py-2 rounded-xl border font-medium transition-all cursor-pointer ${
                          followUpDays === d
                            ? "bg-accent text-accent-fg border-accent shadow-xs"
                            : "bg-surface/60 text-muted border-line hover:border-line-strong hover:text-fg"
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1 min-w-[110px]">
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={followUpDays}
                      onChange={(e) => setFollowUpDays(e.target.value)}
                      placeholder="Custom"
                      className="w-full h-11 px-3.5 pr-12 rounded-xl border border-line bg-surface/60 text-fg text-sm focus:border-accent focus:bg-card focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">
                      days
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* 3. Notes */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <h2 className="text-sm font-medium text-fg">
              Notes & Instructions
            </h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={7}
                  placeholder="Scope details, discussion summary, or follow-up reminders..."
                  className="w-full p-3.5 rounded-xl border border-line bg-surface/50 text-fg placeholder:text-muted/60 text-xs sm:text-sm focus:border-accent focus:bg-card focus:outline-none transition-all resize-y"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Clean Sticky Card Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-6">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted">Card Preview</span>
            <span className="text-[11px] font-mono text-muted">{effectiveCategory}</span>
          </div>

          <CategoryVisualCard
            title={name.trim() || "Lead Contact"}
            subtitle={company.trim() || source || "Referral"}
            currentCount={stageObj.step}
            totalCount={5}
            category={effectiveCategory}
            tags={
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${stageObj.tone}`}>
                  {stageObj.label}
                </span>
                {estimatedValue && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-orange-500/15 text-white border border-orange-500/25 font-mono">
                    {currency} {formatAmountWithCommas(estimatedValue)}
                  </span>
                )}
              </div>
            }
          />
        </div>
      </form>
    </div>
  );
}
