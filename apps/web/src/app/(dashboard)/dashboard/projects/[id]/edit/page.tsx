"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { getProject, updateProject, getClients, type Project, type Client } from "@/lib/api";
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

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params?.id || "");
  const { getToken } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [category, setCategory] = useState("Featured");
  const [customCategory, setCustomCategory] = useState("");
  const [budgetStr, setBudgetStr] = useState("5,000");
  const [hourlyRateStr, setHourlyRateStr] = useState("100");
  const [currency, setCurrency] = useState("USD");
  const [status, setStatus] = useState("in_progress");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Unsaved-changes guard — the loaded project is the baseline, so leaving with
  // typed edits asks first and a saved draft can be restored on return.
  const [initialValues, setInitialValues] = useState<Record<string, string> | null>(null);

  const formValues = useMemo(
    () => ({
      title,
      clientId,
      category,
      customCategory,
      budgetStr,
      hourlyRateStr,
      currency,
      status,
      priority,
      deadline,
      description,
    }),
    [title, clientId, category, customCategory, budgetStr, hourlyRateStr, currency, status, priority, deadline, description]
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
    if (s(draft.status)) setStatus(s(draft.status)!);
    if (s(draft.priority)) setPriority(s(draft.priority) as "low" | "medium" | "high");
    if (s(draft.deadline) != null) setDeadline(s(draft.deadline)!);
    if (s(draft.description) != null) setDescription(s(draft.description)!);
  }, []);

  const guard = useUnsavedChangesGuard({
    values: formValues,
    initial: initialValues ?? undefined,
    enabled: !loading,
    draftKey: `project-edit-${projectId}`,
    onRestoreDraft: applyDraft,
  });

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!projectId) return;
      try {
        const token = (await getToken()) || undefined;
        const [projData, clientList] = await Promise.all([
          getProject(projectId, token),
          getClients(token).catch(() => [] as Client[]),
        ]);

        if (!mounted) return;
        setProject(projData);
        setClients(clientList || []);

        setTitle(projData.title || "");
        setClientId(projData.client_id || "");
        setStatus(projData.status || "in_progress");
        setBudgetStr((projData.budget || 0).toLocaleString("en-US"));
        setHourlyRateStr(String(projData.hourly_rate || 100));

        let parsedCat = "Featured";
        let rawDesc = projData.description || "";
        if (rawDesc) {
          const catMatch = rawDesc.match(/\[category:\s*([^\]]+)\]/i);
          if (catMatch && catMatch[1] && catMatch[1].trim() !== "[object Object]") {
            parsedCat = catMatch[1].trim();
          }
          const currMatch = rawDesc.match(/\[currency:\s*([^\]]+)\]/i);
          if (currMatch && currMatch[1]) setCurrency(currMatch[1].trim());
          const prioMatch = rawDesc.match(/\[priority:\s*([^\]]+)\]/i);
          if (prioMatch && prioMatch[1]) setPriority(prioMatch[1].trim() as any);
          const deadMatch = rawDesc.match(/\[deadline:\s*([^\]]+)\]/i);
          // P1/P2: the real due_date column wins over the legacy note tag.
          if (projData.due_date) setDeadline(String(projData.due_date).slice(0, 10));
          else if (deadMatch && deadMatch[1]) setDeadline(deadMatch[1].trim());

          rawDesc = rawDesc
            .replace(/\[category:\s*[^\]]+\]/gi, "")
            .replace(/\[currency:\s*[^\]]+\]/gi, "")
            .replace(/\[priority:\s*[^\]]+\]/gi, "")
            .replace(/\[deadline:\s*[^\]]+\]/gi, "")
            .replace(/\[object Object\]/gi, "")
            .trim();
        }

        setDescription(rawDesc);
        if (DEFAULT_CATEGORIES.includes(parsedCat)) {
          setCategory(parsedCat);
          setCustomCategory("");
        } else {
          setCategory("Featured");
          setCustomCategory(parsedCat);
        }
      } catch (err) {
        console.error("Error loading project for edit:", err);
        toast.error("Could not load project details");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [projectId, getToken]);

  // Snapshot the loaded form as the guard's baseline once (state fills in above).
  useEffect(() => {
    if (!loading && !initialValues) {
      setInitialValues({
        title,
        clientId,
        category,
        customCategory,
        budgetStr,
        hourlyRateStr,
        currency,
        status,
        priority,
        deadline,
        description,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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
      toast.error(result.error.issues[0]?.message || "Please fix validation errors");
      return;
    }

    setSaving(true);
    try {
      const token = (await getToken()) || undefined;

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

      await updateProject(
        projectId,
        {
          title: title.trim(),
          client_id: clientId || undefined,
          budget: numericBudget,
          hourly_rate: numericRate,
          status,
          description: finalDescription,
          // P1/P2: persist the real schedule column, not just the note tag.
          due_date: deadline || undefined,
        },
        token
      );

      invalidateCache("projects:data");
      invalidateCache("dashboard:data");
      guard.markSaved();
      toast.success("Project updated successfully!");
      router.push(`/dashboard/projects/${projectId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.detail || "Failed to update project");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-24 text-center space-y-3">
        <Loader2 className="w-7 h-7 animate-spin text-accent mx-auto" />
        <p className="text-xs text-muted font-medium">Loading project editor...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <h2 className="text-lg font-medium text-fg">Project Not Found</h2>
        <p className="text-xs text-muted">
          This project may have been removed.
        </p>
        <Link href="/dashboard/projects">
          <Button className="rounded-xl px-4 text-xs bg-accent hover:bg-accent-hi text-accent-fg font-medium cursor-pointer">
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="space-y-1">
          <Link
            href={`/dashboard/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Project</span>
          </Link>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            Edit Project Details
          </h1>
          <p className="text-xs text-muted">
            Update budget, client organization, priority, and scope requirements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => guard.guardedPush(`/dashboard/projects/${projectId}`)}
            className="text-xs rounded-xl h-9 px-4 border-line"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            form="edit-project-form"
            disabled={saving}
            className="text-xs rounded-xl h-9 px-5 bg-accent hover:bg-accent-hi text-accent-fg font-medium shadow-xs"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </Button>
        </div>
      </div>

      {/* Main Form Layout */}
      <form id="edit-project-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
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
                  Project Status
                </label>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full h-10 appearance-none px-3.5 pr-8 rounded-xl border border-line bg-surface/50 text-fg text-xs font-medium focus:border-accent focus:bg-card focus:outline-none cursor-pointer transition-all capitalize"
                  >
                    <option value="in_progress">In Progress</option>
                    <option value="planning">Planning Phase</option>
                    <option value="completed">Completed / Finished</option>
                    <option value="paused">Paused</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
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

          {/* 3. Scope Notes */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <h2 className="text-sm font-medium text-fg">
              Scope & Deliverable Notes
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg block">
                Deliverable Scope & Brief
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Scope breakdown, technical requirements, deliverables to hand over..."
                className="w-full p-3 rounded-xl border border-line bg-surface/50 text-fg placeholder:text-muted/60 text-xs sm:text-sm focus:border-accent focus:bg-card focus:outline-none transition-all resize-y"
              />
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
            currentCount={project.milestones?.filter((m) => m.is_completed).length || 0}
            totalCount={project.milestones?.length || 3}
            subtitle={selectedClient?.name || "Direct Client"}
            category={effectiveCategory}
            tags={
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-sky-500/15 text-sky-400 border-sky-500/25 capitalize">
                  {status === "in_progress" ? "In Progress" : status}
                </span>
                <span className="text-[11px] font-mono font-medium text-orange-400 bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/25">
                  {currency} {budgetStr || "0"}
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-accent/15 text-accent border-accent/25">
                  {project.milestones?.length || 3} Phases
                </span>
              </div>
            }
          />
        </div>
      </form>
    </div>
  );
}
