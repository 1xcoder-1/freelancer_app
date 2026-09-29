"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Building2,

  Loader2,
  Trash2,
  Pencil,
  UserPlus,
  CalendarClock,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getLead,
  updateLead,
  deleteLead,
  convertLeadToClient,
  type Lead,
  type LeadStage,
} from "@/lib/api";
import { invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";

const STAGES: Array<{ key: LeadStage; label: string; step: number; tone: string }> = [
  { key: "new", label: "New Lead", step: 1, tone: "bg-surface text-muted" },
  { key: "contacted", label: "Contacted", step: 2, tone: "bg-info/10 text-info" },
  { key: "proposal", label: "Proposal", step: 3, tone: "bg-accent-soft text-accent" },
  { key: "negotiation", label: "Talking Price", step: 4, tone: "bg-warn/10 text-warn" },
  { key: "won", label: "Won", step: 5, tone: "bg-ok/10 text-ok" },
];

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = String(params?.id || "");
  const { getToken } = useAuth();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!leadId) return;
      try {
        const token = (await getToken()) || undefined;
        const leadData = await getLead(leadId, token);
        if (!mounted) return;
        setLead(leadData);
      } catch (err) {
        console.error("Error loading lead:", err);
        toast.error("Could not load lead profile");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [leadId, getToken]);

  const handleConvert = async () => {
    if (!lead || busyAction) return;
    setBusyAction(true);
    try {
      const token = (await getToken()) || undefined;
      const client = await convertLeadToClient(lead.id, token);
      invalidateCache("leads:data");
      invalidateCache("leads:insights");
      invalidateCache("clients:data");
      invalidateCache("dashboard:data");
      toast.success("Lead converted to Client roster!");
      router.push("/dashboard/clients");
    } catch (err: any) {
      console.error("Error converting lead:", err);
      toast.error(err?.response?.data?.detail || "Could not convert lead to client");
      setBusyAction(false);
    }
  };

  const handleDelete = async () => {
    if (!lead) return;
    const ok = await confirmDialog({
      title: "Delete Lead",
      message: `Are you sure you want to delete "${lead.name}"? This cannot be undone.`,
      confirmLabel: "Delete Lead",
      danger: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const token = (await getToken()) || undefined;
      await deleteLead(lead.id, token);
      invalidateCache("leads:data");
      invalidateCache("leads:insights");
      invalidateCache("dashboard:data");
      toast.success("Lead deleted successfully");
      router.push("/dashboard/leads");
    } catch (err) {
      toast.error("Failed to delete lead");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-24 text-center space-y-3">
        <Loader2 className="w-7 h-7 animate-spin text-accent mx-auto" />
        <p className="text-xs text-muted font-medium">Loading lead details...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <h2 className="text-lg font-medium text-fg">Lead Not Found</h2>
        <p className="text-xs text-muted">
          This deal or prospect may have been removed.
        </p>
        <Link href="/dashboard/leads">
          <Button
            className="rounded-xl px-4 text-xs bg-accent hover:bg-accent-hi text-accent-fg font-medium cursor-pointer"
          >
            Back to Leads
          </Button>
        </Link>
      </div>
    );
  }

  // Parse notes, category & currency
  let category = "Featured";
  let currency = "USD";
  let cleanNotes = lead.notes || "";
  if (cleanNotes) {
    const catMatch = cleanNotes.match(/\[category:\s*([^\]]+)\]/i);
    if (catMatch && catMatch[1] && catMatch[1].trim() !== "[object Object]") {
      category = catMatch[1].trim();
    }
    const currMatch = cleanNotes.match(/\[currency:\s*([^\]]+)\]/i);
    if (currMatch && currMatch[1] && currMatch[1].trim() !== "[object Object]") {
      currency = currMatch[1].trim();
    }
    cleanNotes = cleanNotes
      .replace(/\[category:\s*[^\]]+\]/gi, "")
      .replace(/\[currency:\s*[^\]]+\]/gi, "")
      .replace(/\[object Object\]/gi, "")
      .trim();
  }

  const stageObj = STAGES.find((s) => s.key === lead.stage) || STAGES[0];
  const formattedAmount = (lead.estimated_value || 0).toLocaleString("en-US");

  // Style helper for priority pill tag
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25";
      case "medium":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25";
      default:
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25";
    }
  };

  // Style helper for stage pill tag
  const getStageStyle = (stage: LeadStage) => {
    switch (stage) {
      case "won":
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25";
      case "negotiation":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25";
      case "proposal":
        return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25";
      case "contacted":
        return "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25";
      default:
        return "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25";
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6">
      {/* Top Navigation & Header */}
      <div className="space-y-4 pb-4 border-b border-line">
        <Link
          href="/dashboard/leads"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Leads</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            {/* Colorful soft pill tags matching reference image */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-medium tracking-wide text-fg mr-1">
                {lead.name}
              </h1>

              {/* Stage Pill */}
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${getStageStyle(
                  lead.stage
                )}`}
              >
                {stageObj.label}
              </span>

              {/* Category Pill */}
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25">
                {category}
              </span>

              {/* Priority Pill */}
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border capitalize ${getPriorityStyle(
                  lead.priority
                )}`}
              >
                {lead.priority} Priority
              </span>
            </div>

            {lead.company && (
              <p className="text-xs text-muted font-normal flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-accent" />
                <span className="text-fg font-medium">{lead.company}</span>
                <span>•</span>
                <span>Source: {lead.source || "Referral"}</span>
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handleConvert}
              disabled={busyAction}
              className="text-xs rounded-xl h-9 px-4 bg-accent hover:bg-accent-hi text-accent-fg font-medium shadow-xs transition-all"
            >
              {busyAction ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              )}
              {busyAction ? "Converting..." : "Convert to Client"}
            </Button>

            <Link href={`/dashboard/leads/${lead.id}/edit`}>
              <Button
                variant="outline"
                size="sm"
                className="text-xs rounded-xl h-9 px-3.5 border-line cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting || busyAction}
              className="text-xs rounded-xl h-9 px-2.5 text-muted hover:text-danger hover:bg-danger/10"
              title="Delete Lead"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Read-Only Pipeline Stage Progression Bar with compact height & comfortable gap */}
      <Card className="p-3.5 sm:p-4 rounded-2xl border-line bg-card space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-fg">
            Pipeline Stage
          </span>
          <span className="text-xs font-mono font-medium text-accent">
            Step {stageObj.step} of 5
          </span>
        </div>

        {/* Non-editable step indicator with compact sizing & comfortable gap */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
          {STAGES.map((stg) => {
            const active = lead.stage === stg.key;
            const isPast = stg.step < stageObj.step;
            return (
              <div
                key={stg.key}
                className={`text-[11px] sm:text-xs py-1.5 px-2 rounded-xl border text-center font-medium select-none transition-all ${active
                  ? "bg-accent text-accent-fg border-accent shadow-xs"
                  : isPast
                    ? "bg-accent/10 text-fg border-accent/20"
                    : "bg-surface/40 text-muted border-line"
                  }`}
              >
                {stg.label}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Main Details Grid (2 Columns: Main 8 cols, Side 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Notes & Activity */}
        <div className="lg:col-span-8 space-y-5">
          {/* Deal Value Card (Price shown exactly once with selected currency) */}
          <div className="p-5 rounded-2xl bg-card border border-line flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-muted">Estimated Deal Value</span>
              <div className="text-2xl font-mono font-medium text-fg">
                {currency} {formattedAmount}
              </div>
            </div>
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
              Active Deal
            </span>
          </div>

          {/* Scope Notes */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-line">
              <FileText className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-medium text-fg">
                Scope & Discovery Notes
              </h2>
            </div>

            {cleanNotes ? (
              <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap">
                {cleanNotes}
              </p>
            ) : (
              <p className="text-xs text-muted italic">
                No discovery notes added yet. Click &quot;Edit&quot; to add scope requirements.
              </p>
            )}
          </Card>
        </div>

        {/* Right Column: Key Contact & Metadata */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-5 rounded-2xl border-line bg-card space-y-4">
            <h2 className="text-sm font-medium text-fg pb-2 border-b border-line">
              Contact Details
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted block mb-0.5">Email Address</span>
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="text-fg font-medium hover:text-accent transition-colors break-all"
                  >
                    {lead.email}
                  </a>
                ) : (
                  <span className="text-muted">Not specified</span>
                )}
              </div>

              <div>
                <span className="text-muted block mb-0.5">Phone / WhatsApp</span>
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="text-fg font-mono font-medium hover:text-accent transition-colors"
                  >
                    {lead.phone}
                  </a>
                ) : (
                  <span className="text-muted">Not specified</span>
                )}
              </div>

              <div>
                <span className="text-muted block mb-0.5">Acquisition Source</span>
                <span className="text-fg font-medium">{lead.source || "Referral"}</span>
              </div>

              <div>
                <span className="text-muted block mb-0.5">Next Follow-Up</span>
                <span className="text-warn font-medium flex items-center gap-1">
                  <CalendarClock className="w-3.5 h-3.5" />
                  {lead.next_follow_up_at
                    ? new Date(lead.next_follow_up_at).toLocaleDateString()
                    : "Not scheduled"}
                </span>
              </div>

              {lead.last_contact_at && (
                <div>
                  <span className="text-muted block mb-0.5">Last Contact</span>
                  <span className="text-fg font-medium">
                    {new Date(lead.last_contact_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
