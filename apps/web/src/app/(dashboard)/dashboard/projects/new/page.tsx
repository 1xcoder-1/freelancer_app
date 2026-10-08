"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Loader2,
  ChevronDown,
  Plus,
  Trash2,
  AlertCircle,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createProject, getClients, type Client } from "@/lib/api";
import { invalidateCache } from "@/hooks/use-api-data";
import { z } from "zod";
import { toast } from "sonner";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

const DEFAULT_CATEGORIES = [
  "Featured",
  "Client Engagements",
  "Design & Branding",
  "Fullstack Web Apps",
  "Mobile & AI Systems",
  "Ongoing Retainers",
];

const projectFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Project title must be at least 2 characters")
    .max(120, "Project title cannot exceed 120 characters"),
  budget: z.number().min(0, "Budget cannot be negative"),
  hourlyRate: z.number().min(0, "Hourly rate cannot be negative").optional(),
  description: z.string().trim().max(4000).optional(),
});

interface MilestoneDraft {
  id: string;
  title: string;
  amount: number;
  deliverableNote: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Form states
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [category, setCategory] = useState("Featured");
  const [customCategory, setCustomCategory] = useState("");
  const [budgetStr, setBudgetStr] = useState("5,000");
  const [hourlyRateStr, setHourlyRateStr] = useState("100");
  const [currency, setCurrency] = useState("USD");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");

  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { id: "m1", title: "Phase 1: Discovery, Architecture & Wireframes", amount: 1500, deliverableNote: "Tech stack architecture & UX approved" },
    { id: "m2", title: "Phase 2: Core Development & Integrations", amount: 2000, deliverableNote: "MVP build & staging server deployment" },
    { id: "m3", title: "Phase 3: QA, Final Delivery & Production Launch", amount: 1500, deliverableNote: "Final release, assets & source code transfer" },
  ]);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Unsaved-changes guard — an accidental click away asks before the typed
  // project is lost, and the autosaved draft can be restored on return.
  // Milestones ride along as JSON since the guard compares strings.
  const formValues = useMemo(
    () => ({
      title,
      clientId,
      category,
      customCategory,
      budgetStr,
      hourlyRateStr,
      currency,
      priority,
      deadline,
      description,
      milestonesJson: JSON.stringify(milestones),
    }),
    [title, clientId, category, customCategory, budgetStr, hourlyRateStr, currency, priority, deadline, description, milestones]
  );

  const applyDraft = useCallback((draft: Record<string, unknown>) => {
    const s = (v: unknown) => (v == null ? null : String(v));
    if (s(draft.title) != null) setTitle(s(draft.title)!);
    if (s(draft.clientId) != null) setClientId(s(draft.clientId)!);
    if (s(draft.category)) setCategory(s(draft.category)!);
    if (s(draft.customCategory) != null) setCustomCategory(s(draft.customCategory)!);
    if (s(draft.budgetStr) != null) setBudgetStr(s(draft.budgetStr)!);
    if (s(draft.hourlyRateStr) != null) setHourlyRateStr(s(draft.hourlyRateStr)!);
    if (s(draft.currency)) setCurrency(s(draft.currency)!);
    if (s(draft.priority)) setPriority(s(draft.priority) as "low" | "medium" | "high");
    if (s(draft.deadline) != null) setDeadline(s(draft.deadline)!);
    if (s(draft.description) != null) setDescription(s(draft.description)!);
    try {
      const ms = JSON.parse(s(draft.milestonesJson) || "[]");
      if (Array.isArray(ms) && ms.length && ms.every((m: any) => m && typeof m.id === "string")) {
        setMilestones(ms.map((m: any) => ({
          id: m.id,
          title: String(m.title ?? ""),
          amount: Number(m.amount) || 0,
          deliverableNote: String(m.deliverableNote ?? ""),
        })));
      }
    } catch {
      /* junk draft — keep defaults */
    }
  }, []);

  const guard = useUnsavedChangesGuard({
    values: formValues,
    draftKey: "project-new",
    onRestoreDraft: applyDraft,
  });

  useEffect(() => {
    async function loadClientList() {
      try {
        const token = (await getToken()) || undefined;
        const list = await getClients(token);
        setClients(list || []);
        if (list && list.length > 0 && !clientId) {
          setClientId(list[0].id);
        }
      } catch (err) {
        console.error("Failed to load clients:", err);
      } finally {
        setLoadingClients(false);
      }
    }
    loadClientList();
  }, [getToken]);

  // The auto-selected first client lands asynchronously — re-seed the guard's
  // baseline once loading finishes so that pre-fill never counts as an edit.
  useEffect(() => {
    if (!loadingClients) guard.seedBaseline();
  }, [loadingClients, guard]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const effectiveCategory = customCategory.trim() || category || "Featured";

  const cleanNumeric = (val: string): number => {
    const clean = val.replace(/,/g, "").replace(/[^\d.]/g, "");
    return Number(clean) || 0;
  };

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, "").replace(/[^\d.]/g, "");
    if (!raw) {
      setBudgetStr("");
      return;
    }
    const parts = raw.split(".");
    const formatted = Number(parts[0] || "0").toLocaleString("en-US");
    setBudgetStr(parts.length > 1 ? `${formatted}.${parts[1]}` : formatted);
  };

  const handleAddMilestone = () => {
    setMilestones([
      ...milestones,
      {
        id: `m_${Date.now()}`,
        title: "",
        amount: 500,
        deliverableNote: "",
      },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleMilestoneChange = (index: number, field: keyof MilestoneDraft, value: any) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numericBudget = cleanNumeric(budgetStr);
    const numericRate = cleanNumeric(hourlyRateStr);

    const result = projectFormSchema.safeParse({
      title,
      budget: numericBudget,
      hourlyRate: numericRate,
      description,
    });

    if (!result.success) {
      const errMap: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) errMap[issue.path[0].toString()] = issue.message;
      });
      setErrors(errMap);
      toast.error(result.error.issues[0]?.message || "Please fix form validation errors");
      return;
    }

    setSaving(true);
    try {
      const token = (await getToken()) || undefined;

      // Construct description with metadata tags
      let finalDescription = description.trim();
      const metaTags = [
        `[category: ${effectiveCategory}]`,
        currency ? `[currency: ${currency}]` : "",
        priority ? `[priority: ${priority}]` : "",
        deadline ? `[deadline: ${deadline}]` : "",
      ]
        .filter(Boolean)
        .join("\n");

      finalDescription = metaTags ? `${metaTags}\n${finalDescription}` : finalDescription;

      const created = await createProject(
        {
          title: title.trim(),
          client_id: clientId || undefined,
          budget: numericBudget,
          hourly_rate: numericRate,
          description: finalDescription,
          status: "in_progress",
          // P1/P2: persist the real schedule column, not just the note tag.
          due_date: deadline || undefined,
        },
        token
      );

      invalidateCache("projects:data");
      invalidateCache("dashboard:data");
      guard.markSaved();
      toast.success("Project created successfully!");
      router.push(`/dashboard/projects/${created.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.detail || "Failed to create project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="space-y-1">
          <Link
            href="/dashboard/projects"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Projects</span>
          </Link>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            New Client Project
          </h1>
          <p className="text-xs text-muted">
            Configure deliverables, budget allocation, milestones, and client details.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => guard.guardedPush("/dashboard/projects")}
            className="text-xs rounded-xl h-9 px-4 border-line"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            form="project-form"
            disabled={saving}
            className="text-xs rounded-xl h-9 px-5 bg-accent hover:bg-accent-hi text-accent-fg font-medium shadow-xs"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Creating...
              </>
            ) : (
              <span>Create Project</span>
            )}
          </Button>
        </div>
      </div>

      {/* Main Form Layout */}
      <form id="project-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Fields (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. General & Client Info */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <h2 className="text-sm font-medium text-fg">
              Project & Client Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Project Title <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
                  }}
                  placeholder="e.g. Next.js SaaS Platform & Stripe Checkout"
                  className={`w-full h-10 px-3.5 rounded-xl border bg-surface/50 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all ${
                    errors.title ? "border-danger" : "border-line"
                  }`}
                />
                {errors.title && (
                  <p className="text-[11px] text-danger flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.title}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Client Organization
                </label>
                <div className="relative">
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full h-10 appearance-none px-3.5 pr-8 rounded-xl border border-line bg-surface/50 text-fg text-xs font-medium focus:border-accent focus:bg-card focus:outline-none cursor-pointer transition-all"
                  >
                    <option value="">Internal / Direct Client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company_name ? `(${c.company_name})` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Target Launch / Deadline
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-xs focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>
            </div>
          </Card>

          {/* 2. Budget & Category */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-5">
            <h2 className="text-sm font-medium text-fg">
              Budget & Category
            </h2>

            {/* Category Pills */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-fg block">
                Project Category
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
                      className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all ${
                        active
                          ? "bg-accent text-accent-fg border-accent shadow-xs font-semibold"
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
                className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-xs placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all mt-1"
              />
            </div>

            {/* Budget & Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-line/60">
              <div className="space-y-1.5 min-w-0">
                <label className="text-xs font-medium text-fg block">
                  Total Project Budget
                </label>
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="text"
                    value={budgetStr}
                    onChange={handleBudgetChange}
                    placeholder="5,000"
                    className="flex-1 min-w-0 w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm font-mono focus:border-accent focus:bg-card focus:outline-none transition-all"
                  />
                  <div className="relative w-24 sm:w-28 shrink-0">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full h-10 appearance-none px-2.5 sm:px-3 pr-7 rounded-xl border border-line bg-surface/50 text-fg text-xs font-medium focus:border-accent focus:bg-card focus:outline-none cursor-pointer transition-all"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="PKR">PKR (₨)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="AED">AED (د.إ)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="AUD">AUD ($)</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-muted pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 min-w-0">
                <label className="text-xs font-medium text-fg block">
                  Billable Hourly Rate
                </label>
                <input
                  type="text"
                  value={hourlyRateStr}
                  onChange={(e) => setHourlyRateStr(e.target.value)}
                  placeholder="100"
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm font-mono focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-fg block">
                  Project Priority
                </label>
                <div className="relative">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full h-10 appearance-none px-3.5 pr-8 rounded-xl border border-line bg-surface/50 text-fg text-xs font-medium focus:border-accent focus:bg-card focus:outline-none cursor-pointer transition-all capitalize"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </Card>

          {/* 3. Scope & Milestones */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <h2 className="text-sm font-medium text-fg">
              Scope & Phased Milestones
            </h2>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Deliverable Scope & Brief
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Scope breakdown, technical requirements, deliverables to hand over..."
                  className="w-full p-3 rounded-xl border border-line bg-surface/50 text-fg placeholder:text-muted/60 text-xs sm:text-sm focus:border-accent focus:bg-card focus:outline-none transition-all resize-y"
                />
              </div>

              <div className="space-y-2.5 pt-2 border-t border-line/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-fg">
                    Milestone Phases ({milestones.length})
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddMilestone}
                    className="text-xs rounded-xl h-7 px-2.5 border-accent/30 text-accent hover:bg-accent-soft"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Phase
                  </Button>
                </div>

                <div className="space-y-2">
                  {milestones.map((m, idx) => (
                    <div
                      key={m.id || idx}
                      className="p-3 rounded-xl bg-surface/40 border border-line space-y-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-accent font-bold px-2 py-0.5 rounded bg-accent-soft">
                          Phase {idx + 1}
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="Phase title..."
                          value={m.title}
                          onChange={(e) => handleMilestoneChange(idx, "title", e.target.value)}
                          className="flex-1 h-8 px-2.5 rounded-lg bg-card border border-line text-fg text-xs focus:outline-none focus:border-accent"
                        />
                        <input
                          type="number"
                          placeholder="Amount"
                          value={m.amount}
                          onChange={(e) => handleMilestoneChange(idx, "amount", Number(e.target.value) || 0)}
                          className="w-24 h-8 px-2 rounded-lg bg-card border border-line text-fg text-xs font-mono focus:outline-none focus:border-accent text-right"
                        />
                        {milestones.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveMilestone(idx)}
                            className="text-muted hover:text-danger p-1 h-7 w-7"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Deliverable note (e.g. Staging deployment ready)..."
                        value={m.deliverableNote}
                        onChange={(e) => handleMilestoneChange(idx, "deliverableNote", e.target.value)}
                        className="w-full h-7 px-2.5 rounded-lg bg-card/60 border border-line text-fg text-[11px] placeholder:text-muted/60 focus:outline-none focus:border-accent"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Live Sticky Card Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-6">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted">Live Card Preview</span>
            <span className="text-[11px] font-mono text-muted">{effectiveCategory}</span>
          </div>

          <CategoryVisualCard
            title={title.trim() || "Next.js SaaS Platform"}
            currentCount={0}
            totalCount={milestones.length || 3}
            subtitle={selectedClient?.name || "Direct Client"}
            category={effectiveCategory}
            tags={
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-sky-500/15 text-sky-400 border-sky-500/25">
                  In Progress
                </span>
                <span className="text-[11px] font-mono font-medium text-orange-400 bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/25">
                  {currency} {budgetStr || "0"}
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-accent/15 text-accent border-accent/25">
                  {milestones.length} Milestone{milestones.length === 1 ? "" : "s"}
                </span>
              </div>
            }
          />
        </div>
      </form>
    </div>
  );
}
