"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getIntakeForm, updateIntakeForm, type IntakeForm } from "@/lib/api";
import { invalidateCache } from "@/hooks/use-api-data";
import { z } from "zod";
import { toast } from "sonner";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";

const DEFAULT_CATEGORIES = [
  "Featured",
  "Client Onboarding",
  "Project Discovery",
  "Feedback & Reviews",
  "Design Sprints",
];

const intakeFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Form title must be at least 2 characters")
    .max(150, "Form title cannot exceed 150 characters"),
  description: z.string().trim().max(1000).optional(),
});

interface QuestionItem {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

export default function EditIntakeFormPage() {
  const router = useRouter();
  const params = useParams();
  const formId = String(params?.id || "");
  const { getToken } = useAuth();

  const [form, setForm] = useState<IntakeForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Featured");
  const [customCategory, setCustomCategory] = useState("");
  const [status, setStatus] = useState("active");
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [submissionsCount, setSubmissionsCount] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!formId) return;
      try {
        const token = (await getToken()) || undefined;
        const data = await getIntakeForm(formId, token);
        if (!mounted) return;

        setForm(data);
        setTitle(data.title || "");
        setStatus(data.status || "active");
        setSubmissionsCount(data.submissions_count || 0);

        let parsedCat = "Featured";
        let rawDesc = data.description || "";
        if (rawDesc) {
          const match = rawDesc.match(/\[category:\s*([^\]]+)\]/i);
          if (match && match[1] && match[1].trim() !== "[object Object]") {
            parsedCat = match[1].trim();
          }
          rawDesc = rawDesc
            .replace(/\[category:\s*[^\]]+\]/gi, "")
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

        const qList = Array.isArray(data.questions) ? data.questions : [];
        setQuestions(
          qList.map((q: any, i: number) => ({
            id: q.id || `q_${i + 1}`,
            label: q.label || "",
            type: q.type || "text",
            required: q.required ?? true,
          }))
        );
      } catch (err) {
        console.error("Error loading intake form:", err);
        toast.error("Could not load questionnaire for editing");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [formId, getToken]);

  const effectiveCategory = customCategory.trim() || category || "Featured";

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `q_${Date.now()}`,
        label: "",
        type: "text",
        required: false,
      },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) {
      toast.error("An intake form must have at least one question");
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, field: keyof QuestionItem, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = intakeFormSchema.safeParse({ title, description });
    if (!result.success) {
      const errMap: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) errMap[issue.path[0].toString()] = issue.message;
      });
      setErrors(errMap);
      toast.error(result.error.issues[0]?.message || "Please check required fields");
      return;
    }

    const emptyQ = questions.some((q) => !q.label.trim());
    if (emptyQ) {
      toast.error("Please enter a question prompt for all question items");
      return;
    }

    setSaving(true);
    try {
      const token = (await getToken()) || undefined;
      const formattedDesc = description
        ? `[category: ${effectiveCategory}]\n${description}`
        : `[category: ${effectiveCategory}]`;

      const formattedQuestions = questions.map((q, idx) => ({
        id: q.id || `q_${idx + 1}`,
        label: q.label.trim(),
        type: q.type as "text" | "textarea" | "select" | "file",
        required: q.required,
      }));

      await updateIntakeForm(
        formId,
        {
          title: title.trim(),
          description: formattedDesc,
          status,
          questions: formattedQuestions as any,
        },
        token
      );

      invalidateCache("intake:forms");
      invalidateCache("dashboard:data");
      toast.success("Intake form updated successfully!");
      router.push(`/dashboard/intake/${formId}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.detail || "Failed to update intake form");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-24 text-center space-y-3">
        <Loader2 className="w-7 h-7 animate-spin text-accent mx-auto" />
        <p className="text-xs text-muted font-medium">Loading form editor...</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <h2 className="text-lg font-medium text-fg">Questionnaire Not Found</h2>
        <p className="text-xs text-muted">
          This questionnaire may have been removed.
        </p>
        <Link href="/dashboard/intake">
          <Button className="rounded-xl px-4 text-xs bg-accent hover:bg-accent-hi text-accent-fg font-medium cursor-pointer">
            Back to Intake Forms
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="space-y-1">
          <Link
            href={`/dashboard/intake/${formId}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Questionnaire</span>
          </Link>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            Edit Questionnaire
          </h1>
          <p className="text-xs text-muted">
            Update questions, category, or welcome message.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/dashboard/intake/${formId}`}>
            <Button variant="outline" size="sm" className="text-xs rounded-xl h-9 px-4 border-line">
              Cancel
            </Button>
          </Link>
          <Button
            size="sm"
            type="submit"
            form="edit-intake-form"
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

      {/* Main Form Grid */}
      <form id="edit-intake-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Fields (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. General & Category */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <h2 className="text-sm font-medium text-fg">
              Form Details & Category
            </h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Questionnaire Title <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
                  }}
                  placeholder="e.g. Website Discovery & Scope Questionnaire"
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
                  Welcome Message / Overview
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="e.g. Please fill out this brief questionnaire so we can prepare your quote and timeline."
                  className="w-full p-3 rounded-xl border border-line bg-surface/50 text-fg placeholder:text-muted/60 text-xs sm:text-sm focus:border-accent focus:bg-card focus:outline-none transition-all resize-y"
                />
              </div>

              {/* Category Pills */}
              <div className="space-y-2 pt-2 border-t border-line/60">
                <label className="text-xs font-medium text-fg block">
                  Questionnaire Category
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
            </div>
          </Card>

          {/* 2. Questions Builder */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-fg">
                Questionnaire Fields ({questions.length})
              </h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddQuestion}
                className="text-xs rounded-xl h-8 px-3 border-accent/30 text-accent hover:bg-accent-soft"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Field
              </Button>
            </div>

            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="p-3.5 rounded-2xl bg-surface/40 border border-line space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-accent px-2 py-0.5 rounded-md bg-accent-soft">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Enter question prompt..."
                      value={q.label}
                      onChange={(e) => handleQuestionChange(idx, "label", e.target.value)}
                      className="flex-1 h-9 px-3 rounded-xl bg-card border border-line text-fg text-xs sm:text-sm focus:outline-none focus:border-accent"
                    />
                    {questions.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveQuestion(idx)}
                        className="text-muted hover:text-danger hover:bg-danger/10 p-1.5 h-8 w-8 rounded-lg"
                        title="Remove Question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4 text-xs pt-1 border-t border-line/40">
                    <div className="flex items-center gap-2">
                      <span className="text-muted">Response Type:</span>
                      <select
                        value={q.type}
                        onChange={(e) => handleQuestionChange(idx, "type", e.target.value)}
                        className="h-8 px-2.5 rounded-lg bg-card border border-line text-fg text-xs focus:outline-none cursor-pointer"
                      >
                        <option value="text">Short Text</option>
                        <option value="textarea">Long Paragraph</option>
                        <option value="number">Numeric</option>
                        <option value="file">File Upload / Link</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-1.5 text-muted cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => handleQuestionChange(idx, "required", e.target.checked)}
                        className="rounded border-line text-accent focus:ring-0"
                      />
                      <span>Required</span>
                    </label>
                  </div>
                </div>
              ))}
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
            title={title.trim() || "Website Discovery & Scope"}
            currentCount={submissionsCount}
            totalCount={questions.length}
            subtitle={`By ${effectiveCategory}`}
            category={effectiveCategory}
            tags={
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-sky-500/15 text-sky-400 border-sky-500/25">
                  {effectiveCategory}
                </span>
                <span className="text-[11px] font-mono font-medium text-orange-400 bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/25">
                  {questions.length} Question{questions.length === 1 ? "" : "s"}
                </span>
              </div>
            }
          />
        </div>
      </form>
    </div>
  );
}
