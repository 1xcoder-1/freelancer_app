"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  CalendarClock,
  FileText,
  Rocket,
  XCircle,
  Pencil,
  Trash2,
  UserPlus,
  Loader2,
  ArrowUpRight,
  ExternalLink,
  DollarSign,
  TrendingUp,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getLead,
  deleteLead,
  convertLeadToClient,
  getLeadConvertPreview,
  closeLead,
  startWork,
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

const LOST_REASONS: Array<{ value: string; label: string }> = [
  { value: "price", label: "Price" },
  { value: "no-budget", label: "No budget" },
  { value: "went-competitor", label: "Went with competitor" },
  { value: "ghosted", label: "Ghosted" },
  { value: "timing", label: "Timing" },
  { value: "scope-mismatch", label: "Scope mismatch" },
  { value: "other", label: "Other" },
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

  // Start-Work cascade + structured loss
  const [startBusy, setStartBusy] = useState(false);
  const [lostBusy, setLostBusy] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [swProjectTitle, setSwProjectTitle] = useState("");
  const [swCreateContract, setSwCreateContract] = useState(false);
  const [swCreateInvoice, setSwCreateInvoice] = useState(false);
  const [swInvoiceAmount, setSwInvoiceAmount] = useState(0);
  const [lostReason, setLostReason] = useState("");
  const [lostNote, setLostNote] = useState("");

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

      // Pre-flight: tell the user what will happen BEFORE committing, so
      // "Make this client" never hides a duplicate or surprises with a reuse.
      const preview = await getLeadConvertPreview(lead.id, token).catch(() => null);
      let mergeInto: string | undefined;
      if (preview && preview.match !== "none" && preview.client_id) {
        if (preview.match === "email") {
          const go = await confirmDialog({
            title: "Already on your roster",
            message: `${preview.client_name}${preview.client_email ? ` (${preview.client_email})` : ""} is already a client with this email. Converting marks the lead won and updates that existing client — no duplicate is created. Continue?`,
            confirmLabel: "Update existing client",
            cancelLabel: "Cancel",
          });
          if (!go) {
            setBusyAction(false);
            return;
          }
        } else {
          const same = await confirmDialog({
            title: "Is this the same person?",
            message: `A client named "${preview.client_name}"${preview.client_email ? ` (${preview.client_email})` : ""} already exists with a different email. Converting can update that client instead of adding a second row for the same person.`,
            confirmLabel: "Same person — merge",
            cancelLabel: "Different person",
          });
          if (same) {
            mergeInto = preview.client_id;
          } else {
            const create = await confirmDialog({
              title: "Create a new client?",
              message: `"${lead.name}" will be added to the roster as a NEW client alongside the existing one.`,
              confirmLabel: "Create new client",
              cancelLabel: "Cancel",
            });
            if (!create) {
              setBusyAction(false);
              return;
            }
          }
        }
      }

      const client = await convertLeadToClient(lead.id, token, mergeInto);
      invalidateCache("leads:data");
      invalidateCache("leads:insights");
      invalidateCache("clients:data");
      invalidateCache("dashboard:data");
      toast.success(mergeInto ? "Lead merged into the existing client!" : "Lead converted to Client roster!");
      router.push(`/dashboard/clients/${client.id}`);
    } catch (err) {
      console.error("Error converting lead:", err);
      toast.error((err as Error)?.message || "Could not convert lead to client");
      setBusyAction(false);
    }
  };

  const openStartForm = () => {
    setSwProjectTitle("");
    setSwCreateContract(false);
    setSwCreateInvoice(false);
    setSwInvoiceAmount(lead?.estimated_value || 0);
    setShowLost(false);
    setShowStart(true);
  };

  const handleStartWork = async () => {
    if (!lead || startBusy) return;
    setStartBusy(true);
    try {
      const token = (await getToken()) || undefined;
      const res = await startWork(
        lead.id,
        {
          project_title: swProjectTitle.trim() || undefined,
          create_contract: swCreateContract,
          create_invoice: swCreateInvoice,
          invoice_amount: swCreateInvoice ? swInvoiceAmount : undefined,
        },
        token
      );
      invalidateCache("leads:data");
      invalidateCache("leads:insights");
      invalidateCache("clients:data");
      invalidateCache("dashboard:data");
      toast.success(res.reused_client ? "Existing client reused · project ready" : "Client + project created");
      router.push(`/dashboard/projects/${res.project_id}`);
    } catch (err) {
      toast.error((err as Error)?.message || "Could not start work");
      setStartBusy(false);
    }
  };

  const handleMarkLost = async () => {
    if (!lead || lostBusy) return;
    if (!lostReason) {
      toast.error("Pick a loss reason first");
      return;
    }
    setLostBusy(true);
    try {
      const token = (await getToken()) || undefined;
      const updated = await closeLead(
        lead.id,
        { outcome: "lost", reason: lostReason, note: lostNote.trim() || undefined },
        token
      );
      invalidateCache("leads:data");
      invalidateCache("leads:insights");
      setLead(updated);
      setShowLost(false);
      toast.success("Deal marked lost — reason logged");
    } catch (err) {
      toast.error((err as Error)?.message || "Could not close lead");
    } finally {
      setLostBusy(false);
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
    } catch {
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
      case "lost":
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25";
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

  const isWon = lead.stage === "won";
  const isLost = lead.stage === "lost";

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6 enter-stagger">
      {/* Top Navigation & Header */}
      <div className="space-y-4 pb-4 border-b border-line">
        <Link
          href="/dashboard/leads"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Leads</span>
        </Link>

        <div className="space-y-4">
          <div className="space-y-1.5">
            {/* Name + stage on one line; everything else sits in a quiet meta line */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg mr-1">
                {lead.name}
              </h1>

              {/* Stage Pill */}
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border capitalize ${getStageStyle(
                  lead.stage
                )}`}
              >
                {lead.stage === "won" ? "★ Won Deal" : lead.stage === "lost" ? "Closed Lost" : stageObj.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              {lead.company && (
                <span className="inline-flex items-center gap-1.5 mr-1">
                  <Building2 className="w-3.5 h-3.5 text-accent" />
                  <span className="text-fg font-medium">{lead.company}</span>
                  <span>•</span>
                  <span>Source: {lead.source || "Referral"}</span>
                </span>
              )}

              {/* Category Pill */}
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium border bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25">
                {category}
              </span>

              {/* Priority Pill */}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium border capitalize ${getPriorityStyle(
                  lead.priority
                )}`}
              >
                {lead.priority} Priority
              </span>
            </div>
          </div>

          {/* Action Buttons — own row so they never crowd the identity block */}
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {!isWon && !isLost && (
              <Button
                size="sm"
                onClick={() => (showStart ? setShowStart(false) : openStartForm())}
                className="text-xs rounded-xl h-9 px-4 bg-accent hover:bg-accent-hi text-accent-fg font-medium shadow-xs transition-all cursor-pointer"
              >
                <Rocket className="w-3.5 h-3.5 mr-1.5" />
                Start Work
              </Button>
            )}

            {!isWon && !isLost && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleConvert}
                disabled={busyAction}
                className="text-xs rounded-xl h-9 px-3.5 border-line cursor-pointer"
              >
                {busyAction ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5 mr-1.5 text-accent" />
                )}
                {busyAction ? "Converting..." : "Convert to Client"}
              </Button>
            )}

            {!isWon && !isLost && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowLost((v) => !v)}
                className="text-xs rounded-xl h-9 px-3 text-muted hover:text-danger hover:bg-danger/10 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Mark Lost
              </Button>
            )}

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
              className="text-xs rounded-xl h-9 px-2.5 text-muted hover:text-danger hover:bg-danger/10 cursor-pointer"
              title="Delete Lead"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Start-Work inline modal/form */}
      {showStart && (
        <Card className="p-5 rounded-2xl border-line bg-card space-y-4 enter">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-medium text-fg">Start Work</h2>
          </div>

          <input
            value={swProjectTitle}
            onChange={(e) => setSwProjectTitle(e.target.value)}
            placeholder={`${lead.name} — project title`}
            className="w-full h-11 px-4 rounded-xl border border-line bg-surface/50 text-sm text-fg placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-xs text-fg cursor-pointer select-none">
              <input type="checkbox" checked={swCreateContract} onChange={(e) => setSwCreateContract(e.target.checked)} className="accent-accent" />
              Add contract draft
            </label>
            <label className="flex items-center gap-2 text-xs text-fg cursor-pointer select-none">
              <input type="checkbox" checked={swCreateInvoice} onChange={(e) => setSwCreateInvoice(e.target.checked)} className="accent-accent" />
              Add first invoice (deposit)
            </label>
          </div>

          {swCreateInvoice && (
            <input
              type="number"
              min={0}
              value={swInvoiceAmount}
              onChange={(e) => setSwInvoiceAmount(Number(e.target.value))}
              placeholder={`Invoice amount (${currency})`}
              className="w-full sm:w-56 h-11 px-4 rounded-xl border border-line bg-surface/50 text-sm text-fg font-mono placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none"
            />
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleStartWork}
              disabled={startBusy}
              className="text-xs rounded-xl h-9 px-4 bg-accent hover:bg-accent-hi text-accent-fg font-medium cursor-pointer"
            >
              {startBusy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5 mr-1.5" />}
              {startBusy ? "Creating..." : "Create & Open Project"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowStart(false)} disabled={startBusy} className="text-xs rounded-xl h-9 px-3 text-muted">
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Mark-Lost inline form */}
      {showLost && lead.stage !== "lost" && (
        <Card className="p-5 rounded-2xl border-line bg-card space-y-4 enter">
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-danger" />
              <h2 className="text-sm font-medium text-fg">Mark Deal as Lost</h2>
            </div>
            <button
              onClick={() => setShowLost(false)}
              className="text-xs text-muted hover:text-fg p-1"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-muted">Select the primary reason for losing this opportunity:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {LOST_REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setLostReason(r.value)}
                className={`text-xs rounded-xl px-3 py-2 border transition-all text-center ${
                  lostReason === r.value
                    ? "bg-danger/15 text-danger border-danger/40 font-medium"
                    : "bg-surface/40 text-muted border-line hover:text-fg"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted uppercase tracking-wider">Note (optional)</label>
            <textarea
              value={lostNote}
              onChange={(e) => setLostNote(e.target.value)}
              rows={2}
              placeholder="What happened, and what can we learn?"
              className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-surface/50 text-fg text-xs focus:border-accent focus:bg-card focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-line">
            <Button
              size="sm"
              onClick={handleMarkLost}
              disabled={lostBusy || !lostReason}
              className="text-xs rounded-xl h-9 px-4 bg-danger/90 hover:bg-danger text-white font-medium cursor-pointer"
            >
              {lostBusy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
              Log Loss &amp; Close
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowLost(false)} disabled={lostBusy} className="text-xs rounded-xl h-9 px-3 text-muted">
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Main Details Grid (2 Columns: Main 8 cols, Side 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Deal Value, Pipeline Progress & Notes (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Deal Value Hero Card matching Client Billing Rate card */}
          <div className="p-5 rounded-2xl bg-card border border-line flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-muted">Estimated Deal Value</span>
              <div className="text-2xl sm:text-3xl font-mono font-medium text-fg">
                {currency} {formattedAmount}
              </div>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
                isWon
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                  : isLost
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
              }`}
            >
              {isWon ? "★ Won Opportunity" : isLost ? "Closed Lost" : "Active Deal"}
            </span>
          </div>

          {/* Pipeline Stage Progression Bar */}
          <Card className="p-4 sm:p-5 rounded-2xl border-line bg-card space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="text-xs font-medium text-fg">
                Pipeline Stage Progression
              </span>
              <span className="text-xs font-mono font-medium text-accent">
                {isWon ? "Completed · Deal Won" : isLost ? "Closed Lost" : `Step ${stageObj.step} of 5`}
              </span>
            </div>

            {/* Non-editable step indicator with comfortable layout */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
              {STAGES.map((stg) => {
                const active = lead.stage === stg.key;
                const isPast = stg.step < stageObj.step;
                return (
                  <div
                    key={stg.key}
                    className={`text-[11px] sm:text-xs py-2 px-2.5 rounded-xl border text-center font-medium select-none transition-all ${
                      active
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

          {/* Scope & Discovery Notes matching Client special instructions card */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-3.5">
            <div className="flex items-center gap-2 pb-2.5 border-b border-line">
              <FileText className="w-4 h-4 text-accent" />
              <h2 className="font-display text-base sm:text-lg font-medium tracking-wide text-fg">
                Scope &amp; Discovery Notes
              </h2>
            </div>

            {cleanNotes ? (
              <p className="text-sm sm:text-[15px] text-fg leading-relaxed whitespace-pre-wrap">
                {cleanNotes}
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-muted italic">
                No discovery notes added yet. Click &quot;Edit&quot; to add scope requirements and proposal details.
              </p>
            )}
          </Card>
        </div>

        {/* Right Column: Key Contact & Metadata (4 cols) matching Client Details */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-5 rounded-2xl border-line bg-card space-y-4">
            <h2 className="font-display text-base font-medium tracking-wide text-fg pb-2 border-b border-line">
              Contact Details
            </h2>

            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-0.5">
                  Email Address
                </span>
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="text-[13px] sm:text-sm text-fg font-medium hover:text-accent transition-colors break-all block"
                  >
                    {lead.email}
                  </a>
                ) : (
                  <span className="text-[13px] text-muted">Not specified</span>
                )}
              </div>

              <div>
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-0.5">
                  Phone / WhatsApp
                </span>
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="text-[13px] sm:text-sm text-fg font-mono font-medium hover:text-accent transition-colors block"
                  >
                    {lead.phone}
                  </a>
                ) : (
                  <span className="text-[13px] text-muted">Not specified</span>
                )}
              </div>

              <div>
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-0.5">
                  Acquisition Source
                </span>
                <span className="text-[13px] sm:text-sm text-fg font-medium block">
                  {lead.source || "Referral"}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-0.5">
                  Next Follow-Up
                </span>
                <span className="text-[13px] sm:text-sm text-warn font-medium flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" />
                  {lead.next_follow_up_at
                    ? new Date(lead.next_follow_up_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Not scheduled"}
                </span>
              </div>

              {lead.last_contact_at && (
                <div>
                  <span className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-0.5">
                    Last Contact
                  </span>
                  <span className="text-[13px] sm:text-sm text-fg font-medium block">
                    {new Date(lead.last_contact_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Quick Shortcuts matching Client view */}
          <div className="space-y-2">
            {!isWon && !isLost && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleConvert}
                disabled={busyAction}
                className="w-full justify-between h-10 px-3.5 text-xs sm:text-[13px] font-medium rounded-xl border-line bg-card hover:bg-surface/60 group transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2.5 text-fg font-medium">
                  <UserPlus className="w-4 h-4 text-accent" />
                  Convert to Client Roster
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors" />
              </Button>
            )}

            {!isWon && !isLost && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => (showStart ? setShowStart(false) : openStartForm())}
                className="w-full justify-between h-10 px-3.5 text-xs sm:text-[13px] font-medium rounded-xl border-line bg-card hover:bg-surface/60 group transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2.5 text-fg font-medium">
                  <Rocket className="w-4 h-4 text-accent" />
                  Start Project &amp; Billing
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
