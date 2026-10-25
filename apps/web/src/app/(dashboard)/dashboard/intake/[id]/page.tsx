"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Pencil,
  Copy,
  CheckCircle2,
  ExternalLink,
  ClipboardList,
  UserPlus,
  FileText,
  Users,
  Target,
  ArrowUpRight,
  Sparkles,
  Calendar,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getIntakeForm,
  deleteIntakeForm,
  getIntakeSubmissions,
  convertIntakeSubmissionToLead,
  type IntakeForm,
  type IntakeSubmission,
} from "@/lib/api";
import { invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { logHandledError } from "@/lib/log-error";

export default function IntakeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const formId = String(params?.id || "");
  const { getToken } = useAuth();

  const [form, setForm] = useState<IntakeForm | null>(null);
  const [submissions, setSubmissions] = useState<IntakeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!formId) return;
      try {
        const token = (await getToken()) || undefined;
        const [formData, subsData] = await Promise.all([
          getIntakeForm(formId, token),
          getIntakeSubmissions(formId, token).catch(() => [] as IntakeSubmission[]),
        ]);

        if (!mounted) return;
        setForm(formData);
        setSubmissions(subsData || []);
      } catch (err) {
        logHandledError("Error loading intake form:", err);
        toast.error("Could not load intake questionnaire");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [formId, getToken]);

  const handleCopyLink = () => {
    if (!form) return;
    const shareToken = form.token || form.id;
    const url = `${window.location.origin}/intake/${shareToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Public link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleConvertToLead = async (sub: IntakeSubmission) => {
    setConvertingId(sub.id);
    try {
      const token = (await getToken()) || undefined;
      await convertIntakeSubmissionToLead(sub.id, token);
      invalidateCache("leads:data");
      invalidateCache("leads:insights");
      invalidateCache("dashboard:data");
      toast.success("Client response converted to Pipeline Lead!");
    } catch (err: any) {
      logHandledError("Failed to convert submission:", err);
      toast.error(err?.response?.data?.detail || "Could not convert submission to lead");
    } finally {
      setConvertingId(null);
    }
  };

  const handleDelete = async () => {
    if (!form) return;
    const ok = await confirmDialog({
      title: "Delete Questionnaire",
      message: `Are you sure you want to delete "${form.title}" and all received answers? This cannot be undone.`,
      confirmLabel: "Delete Form",
      danger: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const token = (await getToken()) || undefined;
      await deleteIntakeForm(form.id, token);
      invalidateCache("intake:forms");
      invalidateCache("dashboard:data");
      toast.success("Intake form deleted");
      router.push("/dashboard/intake");
    } catch (err) {
      logHandledError(err);
      toast.error("Failed to delete intake form");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6">
        <Skeleton className="h-6 w-36 rounded-lg" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="max-w-5xl mx-auto pt-6 px-3 sm:px-6">
        <Card className="bg-card border-dashed border-line rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mx-auto">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h3 className="font-display text-xl font-medium text-fg">Questionnaire not found</h3>
          <p className="text-muted text-sm max-w-sm mx-auto">
            This intake questionnaire may have been removed or does not exist.
          </p>
          <Link
            href="/dashboard/intake"
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Intake Forms
          </Link>
        </Card>
      </div>
    );
  }

  // Parse category & clean description
  let category = "Featured";
  let cleanDescription = form.description || "";
  if (cleanDescription) {
    const catMatch = cleanDescription.match(/\[category:\s*([^\]]+)\]/i);
    if (catMatch && catMatch[1] && catMatch[1].trim() !== "[object Object]") {
      category = catMatch[1].trim();
    }
    cleanDescription = cleanDescription
      .replace(/\[category:\s*[^\]]+\]/gi, "")
      .replace(/\[object Object\]/gi, "")
      .trim();
  }

  const questionsList = Array.isArray(form.questions) ? form.questions : [];
  const shareToken = form.token || form.id;
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/intake/${shareToken}` : `/intake/${shareToken}`;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6 enter-stagger">
      {/* Top Breadcrumb & Quick Nav */}
      <div className="flex items-center justify-between pb-1">
        <Link
          href="/dashboard/intake"
          className="group inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-fg transition-colors cursor-pointer"
        >
          <span className="w-6 h-6 rounded-lg bg-surface border border-line/70 flex items-center justify-center transition-all group-hover:bg-surface-elevated group-hover:border-line-strong group-hover:-translate-x-0.5">
            <ArrowLeft className="w-3.5 h-3.5 text-muted group-hover:text-fg" />
          </span>
          <span className="text-muted/80">Intake Forms</span>
          <span className="text-faint">/</span>
          <span className="text-fg font-medium capitalize">{form.title}</span>
        </Link>
      </div>

      {/* Main Header Card: Title, Status & Actions */}
      <div className="relative overflow-hidden rounded-2xl border border-line/70 bg-gradient-to-b from-card to-card/90 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-fg capitalize">
              {form.title}
            </h1>

            {/* Status Pill */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.12)] capitalize">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{form.status || "Active Questionnaire"}</span>
            </span>

            {/* Category Pill */}
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border bg-sky-500/10 text-sky-400 border-sky-500/20 capitalize">
              {category}
            </span>

            {/* Submissions Pill */}
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-mono font-medium border bg-amber-500/10 text-amber-400 border-amber-500/20">
              {submissions.length} Response{submissions.length === 1 ? "" : "s"}
            </span>
          </div>

          {cleanDescription && (
            <p className="text-xs text-muted font-normal max-w-2xl">
              {cleanDescription}
            </p>
          )}
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
          <Link href={`/dashboard/intake/${form.id}/edit`}>
            <Button
              variant="outline"
              size="sm"
              className="border-line text-fg bg-card hover:bg-surface text-xs rounded-xl h-9 px-3.5 cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Form</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="border-line text-muted hover:text-danger hover:bg-danger/10 text-xs rounded-xl h-9 w-9 p-0 flex items-center justify-center cursor-pointer transition-colors"
            title="Delete Form"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Details Grid (2 Columns: Main 8 cols, Side 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Public Link, Fields & Answers (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Share Box Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-card to-card/90 border border-line/70 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted">Public Client Share Link</span>
              <div className="text-xs sm:text-sm font-mono text-fg break-all select-all">
                {publicUrl}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="border-line text-fg bg-card hover:bg-surface text-xs rounded-xl h-9 px-3.5 cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {copied ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-accent" />
                )}
                <span>{copied ? "Copied" : "Copy Link"}</span>
              </Button>

              <a
                href={`/intake/${shareToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gradient-to-b from-[#ff7a29] to-[#ea580c] hover:from-[#ff883d] hover:to-[#f97316] text-white shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.25),0_0_12px_rgba(234,88,12,0.3)] hover:shadow-[0_2px_5px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35),0_0_16px_rgba(234,88,12,0.45)] border border-orange-400/40 font-medium text-xs rounded-xl h-9 px-3.5 inline-flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer"
              >
                <span>Live View</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Questionnaire Questions List */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line/70 bg-gradient-to-b from-card to-card/90 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-accent" />
                <h2 className="font-display text-base font-medium tracking-wide text-fg">
                  Questionnaire Fields ({questionsList.length})
                </h2>
              </div>
              <span className="text-xs font-mono text-muted">
                {questionsList.filter((q: any) => q.required).length} Required
              </span>
            </div>

            <div className="space-y-2.5">
              {questionsList.map((q: any, i: number) => (
                <div
                  key={q.id || i}
                  className="p-3.5 rounded-xl bg-surface/40 border border-line flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="font-mono text-accent font-bold px-2 py-0.5 rounded-md bg-accent-soft shrink-0 text-xs">
                      #{i + 1}
                    </span>
                    <span className="text-fg font-medium truncate sm:text-xs text-[11px]">
                      {q.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-muted font-mono text-[11px] px-2 py-0.5 rounded bg-surface border border-line/60 capitalize">
                      {q.type}
                    </span>
                    {q.required && (
                      <span className="text-[10px] text-danger font-medium px-1.5 py-0.5 rounded bg-danger/10 border border-danger/20">
                        Required
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Submissions Section */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line/70 bg-gradient-to-b from-card to-card/90 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                <h2 className="font-display text-base font-medium tracking-wide text-fg">
                  Received Client Answers ({submissions.length})
                </h2>
              </div>
            </div>

            {submissions.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs text-muted italic">
                  No responses received yet. Send the shareable link to your client to collect their requirements.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-4 sm:p-5 rounded-2xl bg-surface/30 border border-line space-y-3.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/60 pb-3">
                      <div>
                        <h4 className="text-sm font-medium text-fg">{sub.client_name || "Anonymous Prospect"}</h4>
                        <p className="text-xs text-accent font-mono">{sub.client_email || "No email"}</p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-[11px] text-muted font-mono">
                          {new Date(sub.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConvertToLead(sub)}
                          disabled={convertingId === sub.id}
                          className="text-xs rounded-xl h-8 px-3 border-line cursor-pointer"
                        >
                          {convertingId === sub.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Target className="w-3.5 h-3.5 mr-1.5 text-accent" />
                          )}
                          Convert to Lead
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      {Object.entries(sub.answers || {}).map(([key, val]) => {
                        const matchedQuestion = questionsList.find((q: any) => q.id === key);
                        const questionLabel = matchedQuestion?.label || `Question (${key})`;
                        return (
                          <div key={key} className="bg-card/70 p-3 rounded-xl border border-line/50 space-y-1">
                            <span className="text-muted block text-[11px] font-medium">{questionLabel}</span>
                            <p className="text-fg font-medium leading-relaxed whitespace-pre-wrap">{String(val)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Questionnaire Details & Quick Actions (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-5 rounded-2xl border-line bg-card space-y-4">
            <h2 className="font-display text-base font-medium tracking-wide text-fg pb-2 border-b border-line">
              Questionnaire Details
            </h2>

            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-0.5">
                  Status
                </span>
                <span className="text-[13px] sm:text-sm text-emerald-500 font-medium capitalize block">
                  {form.status || "Active"}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-0.5">
                  Category
                </span>
                <span className="text-[13px] sm:text-sm text-fg font-medium block">
                  {category}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-0.5">
                  Fields Count
                </span>
                <span className="text-[13px] sm:text-sm text-fg font-mono font-medium block">
                  {questionsList.length} Questions
                </span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-0.5">
                  Submissions
                </span>
                <span className="text-[13px] sm:text-sm text-fg font-mono font-medium block">
                  {submissions.length} Responses Received
                </span>
              </div>

              {form.created_at && (
                <div>
                  <span className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-0.5">
                    Created On
                  </span>
                  <span className="text-[13px] sm:text-sm text-fg font-medium block">
                    {new Date(form.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Quick Shortcuts matching Client & Lead pages */}
          <div className="space-y-2">
            <a
              href={`/intake/${shareToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between h-10 px-3.5 text-xs sm:text-[13px] font-medium rounded-xl border-line bg-card hover:bg-surface/60 group transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2.5 text-fg font-medium">
                  <ExternalLink className="w-4 h-4 text-accent" />
                  Preview Live Form
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors" />
              </Button>
            </a>

            <Link href={`/dashboard/intake/${form.id}/edit`} className="block">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between h-10 px-3.5 text-xs sm:text-[13px] font-medium rounded-xl border-line bg-card hover:bg-surface/60 group transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2.5 text-fg font-medium">
                  <Pencil className="w-4 h-4 text-accent" />
                  Edit Questionnaire
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
