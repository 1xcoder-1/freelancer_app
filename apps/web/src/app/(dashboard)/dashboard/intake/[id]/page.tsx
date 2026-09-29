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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
        console.error("Error loading intake form:", err);
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
      console.error("Failed to convert submission:", err);
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
      console.error(err);
      toast.error("Failed to delete intake form");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-24 text-center space-y-3">
        <Loader2 className="w-7 h-7 animate-spin text-accent mx-auto" />
        <p className="text-xs text-muted font-medium">Loading intake questionnaire...</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <h2 className="text-lg font-medium text-fg">Questionnaire Not Found</h2>
        <p className="text-xs text-muted">
          This intake questionnaire may have been removed or does not exist.
        </p>
        <Link href="/dashboard/intake">
          <Button className="rounded-xl px-4 text-xs bg-accent hover:bg-accent-hi text-accent-fg font-medium cursor-pointer">
            Back to Intake Forms
          </Button>
        </Link>
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
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6">
      {/* Top Navigation & Header */}
      <div className="space-y-4 pb-4 border-b border-line">
        <Link
          href="/dashboard/intake"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Intake Forms</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            {/* Colorful soft pill tags matching reference image */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-medium tracking-wide text-fg mr-1 capitalize">
                {form.title}
              </h1>

              {/* Status Pill */}
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 capitalize">
                {form.status || "Active Form"}
              </span>

              {/* Category Pill */}
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25 capitalize">
                {category}
              </span>

              {/* Submissions Pill */}
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-mono font-medium border bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25">
                {submissions.length} Response{submissions.length === 1 ? "" : "s"}
              </span>
            </div>

            {cleanDescription && (
              <p className="text-xs text-muted font-normal">
                {cleanDescription}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/dashboard/intake/${form.id}/edit`}>
              <Button
                variant="outline"
                size="sm"
                className="text-xs rounded-xl h-9 px-3.5 border-line cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit Form
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs rounded-xl h-9 px-2.5 text-muted hover:text-danger hover:bg-danger/10"
              title="Delete Form"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Details Grid (2 Columns: Main 8 cols, Side 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Public Link, Questions & Responses (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Share Box Card */}
          <div className="p-5 rounded-2xl bg-card border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted">Public Client Share Link</span>
              <div className="text-sm font-mono text-fg break-all select-all">
                {publicUrl}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="text-xs rounded-xl h-9 px-3.5 border-line cursor-pointer"
              >
                {copied ? (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-accent" />
                ) : (
                  <Copy className="w-3.5 h-3.5 mr-1.5 text-accent" />
                )}
                {copied ? "Copied" : "Copy Link"}
              </Button>

              <a
                href={`/intake/${shareToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center text-xs rounded-xl h-9 px-3.5 bg-accent hover:bg-accent-hi text-accent-fg font-medium transition-colors"
              >
                <span>Live View</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </a>
            </div>
          </div>

          {/* Questionnaire Questions List */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-medium text-fg">
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
                    <span className="font-mono text-accent font-bold px-2 py-0.5 rounded-md bg-accent-soft shrink-0">
                      #{i + 1}
                    </span>
                    <span className="text-fg font-medium truncate">
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
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-medium text-fg">
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
                    className="p-4 rounded-2xl bg-surface/30 border border-line space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/60 pb-2.5">
                      <div>
                        <h4 className="text-sm font-medium text-fg">{sub.client_name || "Anonymous Prospect"}</h4>
                        <p className="text-xs text-accent font-mono">{sub.client_email || "No email"}</p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-[11px] text-muted font-mono">
                          {new Date(sub.created_at).toLocaleDateString()}
                        </span>

                        {sub.client_email && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConvertToLead(sub)}
                            disabled={convertingId === sub.id}
                            className="text-xs rounded-xl h-8 px-3 border-accent/30 text-accent hover:bg-accent-soft"
                          >
                            <UserPlus className="w-3.5 h-3.5 mr-1" />
                            {convertingId === sub.id ? "Converting..." : "Add to Leads"}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      {Object.entries(sub.answers || {}).map(([key, val]) => (
                        <div key={key} className="p-2.5 rounded-xl bg-card border border-line">
                          <span className="text-muted font-medium block mb-0.5">{key}:</span>
                          <span className="text-fg whitespace-pre-wrap">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Metadata & Quick Links (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-5 rounded-2xl border-line bg-card space-y-4">
            <h2 className="text-sm font-medium text-fg pb-2 border-b border-line">
              Form Overview
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted block mb-0.5">Assigned Category</span>
                <span className="text-fg font-medium capitalize">{category}</span>
              </div>

              <div>
                <span className="text-muted block mb-0.5">Total Questions</span>
                <span className="text-fg font-mono font-medium">{questionsList.length}</span>
              </div>

              <div>
                <span className="text-muted block mb-0.5">Responses Received</span>
                <span className="text-fg font-mono font-medium">{submissions.length}</span>
              </div>

              <div>
                <span className="text-muted block mb-0.5">Form Status</span>
                <span className="text-fg font-medium capitalize">{form.status || "Active"}</span>
              </div>

              <div>
                <span className="text-muted block mb-0.5">Created Date</span>
                <span className="text-fg font-mono">
                  {new Date(form.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Card>

          {/* Quick Module Links */}
          <div className="space-y-2">
            <Link href="/dashboard/leads" className="block">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between text-xs font-medium rounded-xl border-line bg-card hover:bg-surface/60 group transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2 text-fg">
                  <Target className="w-3.5 h-3.5 text-accent" />
                  Pipeline Leads
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors" />
              </Button>
            </Link>

            <Link href="/dashboard/clients" className="block">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between text-xs font-medium rounded-xl border-line bg-card hover:bg-surface/60 group transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2 text-fg">
                  <Users className="w-3.5 h-3.5 text-accent" />
                  Clients Roster
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
