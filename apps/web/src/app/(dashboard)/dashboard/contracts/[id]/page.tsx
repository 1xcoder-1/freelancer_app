"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  FileSignature,
  Copy,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Trash2,
  Calendar,
  User,
  Mail,
  Clock,
  Eye,
  CheckCheck,
  FileText,
  Building2,
  Sparkles,
  PenLine,
  RotateCw,
  KeyRound,
  BookmarkPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getContract,
  deleteContract,
  listContractEvents,
  signSenderContract,
  resendContract,
  saveContractAsTemplate,
  rotateContractToken,
  type Contract,
  type ContractEvent,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";

// Human labels for the N1 audit events the backend appends.
const EVENT_LABELS: Record<string, string> = {
  sent: "Contract dispatched",
  opened: "Client opened document",
  signed: "Client signed",
  counter_signed: "You counter-signed",
  fully_executed: "Fully executed (both parties)",
  declined: "Client declined",
  expired: "Sign link expired",
  superseded: "Replaced by a newer version",
};

function eventTone(event: string): "ok" | "warn" | "danger" | "info" {
  if (event === "signed" || event === "counter_signed" || event === "fully_executed") return "ok";
  if (event === "declined" || event === "expired" || event === "superseded") return "danger";
  if (event === "opened") return "warn";
  return "info";
}

export default function ContractDetailPage() {
  const params = useParams();
  const contractId = params?.id as string;
  const router = useRouter();
  const { getToken } = useAuth();
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  const { data: contract, loading, refresh: loadContract } = useApiData<Contract>(
    `contract:${contractId}`,
    async (token) => {
      if (!contractId) throw new Error("Missing contract ID");
      return await getContract(contractId, token);
    },
    { reportContext: `contract-${contractId}`, pollMs: 15_000 }
  );

  // N1: the real audit timeline, refreshed alongside the contract.
  const { data: eventsData, refresh: loadEvents } = useApiData<ContractEvent[]>(
    `contract:${contractId}:events`,
    async (token) => {
      if (!contractId) return [];
      return await listContractEvents(contractId, token);
    },
    { reportContext: `contract-events-${contractId}`, pollMs: 15_000 }
  );
  const events = eventsData ?? [];

  const [signing, setSigning] = useState(false);
  const [showSignForm, setShowSignForm] = useState(false);
  const [signName, setSignName] = useState("");

  const refreshAll = () => {
    invalidateCache("contracts:data");
    loadContract(true);
    loadEvents(true);
  };

  const handleCounterSign = async () => {
    if (!contract) return;
    const name = (signName || contract.sender_signature || "").trim();
    if (!name) {
      toast.error("Type your name or role to counter-sign");
      return;
    }
    try {
      setSigning(true);
      const token = (await getToken()) || undefined;
      // SE5-safe: send as a typed signature (server allow-lists typed:/png/webp).
      await signSenderContract(contract.id, `typed:${name}`, token);
      toast.success("You've counter-signed this agreement");
      setShowSignForm(false);
      refreshAll();
    } catch (err) {
      console.error("Error counter-signing:", err);
      toast.error("Could not record your counter-signature");
    } finally {
      setSigning(false);
    }
  };

  const handleResend = async () => {
    if (!contract) return;
    const confirmed = await confirmDialog({
      title: "Re-send as new version",
      message: "This creates version " + ((contract.version || 1) + 1) + " and marks the current link superseded — the old link will no longer be signable.",
      confirmLabel: "Re-send",
    });
    if (!confirmed) return;
    try {
      const token = (await getToken()) || undefined;
      await resendContract(contract.id, {
        project_id: contract.project_id,
        client_id: contract.client_id || undefined,
        title: contract.title,
        content: contract.content,
        recipient_name: contract.recipient_name || undefined,
        recipient_email: contract.recipient_email || undefined,
      }, token);
      toast.success("Re-sent as a new version");
      refreshAll();
    } catch (err) {
      console.error("Error re-sending:", err);
      toast.error("Could not re-send this contract");
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!contract) return;
    try {
      const token = (await getToken()) || undefined;
      await saveContractAsTemplate(contract.id, {
        title: contract.title,
        content: contract.content,
        category: "general",
      }, token);
      invalidateCache("contracts:templates");
      toast.success("Saved as a reusable template");
    } catch (err) {
      console.error("Error saving template:", err);
      toast.error("Could not save as template");
    }
  };

  const handleCopyLink = () => {
    if (!contract) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/sign-contract/${contract.token || contract.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Public e-signing link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  // SE10: rotate the anonymous sign token so a leaked link can be revoked.
  const handleRotateLink = async () => {
    if (!contract) return;
    const confirmed = await confirmDialog({
      title: "Rotate signing link",
      message: "This invalidates the current signing link and issues a fresh one. Anyone using the old link will no longer be able to open it.",
      confirmLabel: "Rotate link",
      danger: true,
    });
    if (!confirmed) return;
    try {
      setRotating(true);
      const token = (await getToken()) || undefined;
      await rotateContractToken(contract.id, token);
      toast.success("Signing link rotated — copy the new link");
      refreshAll();
    } catch (err) {
      console.error("Error rotating signing link:", err);
      toast.error("Could not rotate the signing link");
    } finally {
      setRotating(false);
    }
  };

  const handleDelete = async () => {
    if (!contract) return;
    const confirmed = await confirmDialog({
      title: "Delete Contract",
      message: "Are you sure you want to delete this agreement? The signing link will stop working.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const token = (await getToken()) || undefined;
      await deleteContract(contract.id, token);
      invalidateCache("contracts:data");
      toast.success("Contract deleted");
      router.push("/dashboard/contracts");
    } catch (err) {
      console.error("Error deleting contract:", err);
      toast.error("Could not delete contract");
    }
  };

  if (loading && !contract) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 animate-pulse">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-8 h-96 rounded-2xl" />
          <Skeleton className="lg:col-span-4 h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-20 space-y-4 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-fg">Agreement Not Found</h2>
        <p className="text-sm text-muted">The requested contract does not exist or has been removed.</p>
        <Link href="/dashboard/contracts">
          <Button variant="outline" className="rounded-xl border-line">
            Back to Contracts
          </Button>
        </Link>
      </div>
    );
  }

  const status = contract.status;
  const isExecuted = status === "fully_executed" || status === "signed";
  const isFullyExecuted = status === "fully_executed";
  const isViewed = status === "viewed";
  const isSent = status === "sent";
  const isDead = status === "expired" || status === "superseded" || status === "declined";
  const isOpen = isSent || isViewed;
  const needsCounterSign = !!contract.client_signed_at && !contract.sender_signed_at;

  // Status pill tone + copy (token colours only).
  const pill = isFullyExecuted
    ? { cls: "bg-ok/15 text-ok border-ok/25", label: "★ Fully Executed" }
    : status === "signed"
    ? { cls: "bg-warn/15 text-warn border-warn/25", label: "Client signed — awaiting your counter-sign" }
    : isViewed
    ? { cls: "bg-warn/15 text-warn border-warn/25", label: "Viewed by Client" }
    : isSent
    ? { cls: "bg-info/15 text-info border-info/25", label: "Sent / Pending Signature" }
    : status === "declined"
    ? { cls: "bg-danger/15 text-danger border-danger/25", label: "Declined" }
    : status === "expired"
    ? { cls: "bg-danger/15 text-danger border-danger/25", label: "Expired" }
    : status === "superseded"
    ? { cls: "bg-danger/15 text-danger border-danger/25", label: "Superseded" }
    : { cls: "bg-surface text-muted border-line", label: "Draft" };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 no-scrollbar max-w-7xl mx-auto pb-16">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/contracts"
              className="inline-flex items-center text-xs font-semibold text-muted hover:text-fg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Contracts
            </Link>
            <span className="text-muted text-xs">•</span>
            <span className="text-xs text-accent font-semibold font-mono">Agreement Room</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
              {contract.title}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${pill.cls}`}
            >
              {pill.label}
            </span>
            {contract.version && contract.version > 1 && (
              <span className="text-[11px] font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-full border border-accent/20">
                v{contract.version}
              </span>
            )}
            {isOpen && typeof contract.days_left === "number" && (
              <span className="text-[11px] font-mono text-warn bg-warn/15 px-2 py-0.5 rounded-full border border-warn/25">
                {contract.days_left <= 0 ? "expires today" : `valid ${contract.days_left} more days`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="border-line text-xs font-semibold h-9 rounded-xl gap-1.5"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Link Copied" : "Copy E-Sign Link"}
          </Button>

          <a
            href={`/sign-contract/${contract.token || contract.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              size="sm"
              className="bg-accent hover:bg-accent-hi text-accent-fg font-bold text-xs h-9 px-3.5 rounded-xl gap-1.5 shadow-xs"
            >
              <span>Open Signer View</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </a>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveAsTemplate}
            className="border-line text-xs font-semibold h-9 rounded-xl gap-1.5"
            title="Save as a reusable template"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save as Template</span>
          </Button>

          {!isExecuted && !isDead && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              className="border-line text-xs font-semibold h-9 rounded-xl gap-1.5"
              title="Re-send as a new version"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Re-send (v2)</span>
            </Button>
          )}

          {!isExecuted && !isDead && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotateLink}
              disabled={rotating}
              className="border-line text-xs font-semibold h-9 rounded-xl gap-1.5"
              title="Rotate the signing link to revoke any leaked copy"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{rotating ? "Rotating…" : "Rotate link"}</span>
            </Button>
          )}

          {needsCounterSign && (
            <Button
              size="sm"
              onClick={() => setShowSignForm((s) => !s)}
              className="bg-accent hover:bg-accent-hi text-accent-fg font-bold text-xs h-9 px-3.5 rounded-xl gap-1.5"
            >
              <PenLine className="w-3.5 h-3.5" />
              Counter-sign
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-xs text-muted hover:text-danger hover:bg-danger/10 h-9 px-2 rounded-xl"
            title="Delete Agreement"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* N6 inline counter-sign form (no modal) */}
      {needsCounterSign && showSignForm && (
        <Card className="bg-card border-accent/30 p-4 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-muted">Your legal name or role</label>
              <input
                type="text"
                value={signName}
                onChange={(e) => setSignName(e.target.value)}
                placeholder={contract.sender_signature || "e.g. Jane Freelancer"}
                className="w-full mt-1 h-10 px-3 rounded-xl bg-surface border border-line text-sm text-fg focus:outline-none focus:border-accent"
              />
            </div>
            <Button
              size="sm"
              onClick={handleCounterSign}
              disabled={signing}
              className="bg-accent hover:bg-accent-hi text-accent-fg font-bold text-xs h-10 px-4 rounded-xl"
            >
              {signing ? "Recording..." : "Adopt & Counter-sign"}
            </Button>
          </div>
          <p className="text-[11px] text-muted mt-2">
            Full execution is only recorded once both you and the client have signed.
          </p>
        </Card>
      )}

      {/* 2-Column Layout: Document Viewer (7 cols) + Audit Trail & Metadata (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Document Clauses & Text */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-card border-line p-6 rounded-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                <span className="text-sm font-bold text-fg">Agreement Terms & Scope</span>
              </div>
              <span className="text-xs font-mono text-muted">
                Created {new Date(contract.created_at).toLocaleDateString()}
              </span>
            </div>

            <div className="text-xs leading-relaxed text-fg whitespace-pre-wrap font-mono bg-surface/40 p-5 rounded-xl border border-line">
              {contract.content}
            </div>

            {/* Signatures Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-line">
              {/* Sender Signature */}
              <div className="p-4 rounded-xl bg-surface/30 border border-line space-y-2">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Provider Sign-Off
                </span>
                <p className="text-sm font-bold text-fg">{contract.sender_signature || "Authorized Representative"}</p>
                {contract.sender_signed_at ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-ok font-mono">
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Signed {new Date(contract.sender_signed_at).toLocaleDateString()}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-warn font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Awaiting your counter-signature</span>
                  </div>
                )}
              </div>

              {/* Client Signature */}
              <div className="p-4 rounded-xl bg-surface/30 border border-line space-y-2">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Client E-Signature
                </span>
                {contract.client_signature ? (
                  <>
                    <p className="text-sm font-bold text-accent font-serif italic">
                      "{contract.client_signature}"
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Signed {contract.client_signed_at ? new Date(contract.client_signed_at).toLocaleDateString() : "Online"}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted italic">Awaiting client signature...</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Real-Time Audit Trail & Context */}
        <div className="lg:col-span-5 space-y-5 sticky top-24">
          {/* Associated Entities */}
          <Card className="bg-card border-line p-5 rounded-2xl space-y-4">
            <span className="text-xs font-bold text-fg">Linked Workspace Records</span>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-surface/40 border border-line">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-accent" />
                  <span className="text-muted">Client</span>
                </div>
                <span className="font-bold text-fg">{contract.client_name || "Direct / Independent"}</span>
              </div>

              <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-surface/40 border border-line">
                <div className="flex items-center gap-2">
                  <FileSignature className="w-4 h-4 text-accent" />
                  <span className="text-muted">Project</span>
                </div>
                <span className="font-bold text-fg">{contract.project_title || "General Contract"}</span>
              </div>

              <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-surface/40 border border-line">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-accent" />
                  <span className="text-muted">Signer</span>
                </div>
                <span className="font-bold text-fg">{contract.recipient_name || "Client Lead"}</span>
              </div>

              {contract.recipient_email && (
                <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-surface/40 border border-line">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-accent" />
                    <span className="text-muted">Email</span>
                  </div>
                  <span className="font-mono text-fg text-[11px]">{contract.recipient_email}</span>
                </div>
              )}
            </div>
          </Card>

          {/* N1: real audit trail from the append-only ContractEvent log */}
          <Card className="bg-card border-line p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold text-fg">Audit Trail</span>
              <span className="text-[11px] font-mono text-muted">({events.length})</span>
            </div>

            {events.length === 0 ? (
              <p className="text-xs text-muted italic">No events recorded yet.</p>
            ) : (
              <div className="space-y-3 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-line text-xs pl-6">
                {events.map((ev) => {
                  const tone = eventTone(ev.event);
                  const dot =
                    tone === "ok" ? "bg-ok" : tone === "danger" ? "bg-danger" : tone === "warn" ? "bg-warn" : "bg-info";
                  return (
                    <div key={ev.id} className="relative space-y-0.5">
                      <span className={`absolute -left-6 top-1 w-2 h-2 rounded-full ${dot}`} />
                      <p className="font-bold text-fg">{EVENT_LABELS[ev.event] || ev.event}</p>
                      <div className="space-y-0.5 text-[11px] text-muted font-mono">
                        <p>{new Date(ev.occurred_at).toLocaleString()}</p>
                        {ev.actor_ip && <p className="text-[10px]">IP: {ev.actor_ip}</p>}
                        {ev.actor_user_agent && (
                          <p className="truncate text-[10px] text-muted/80">{ev.actor_user_agent}</p>
                        )}
                        {ev.note && <p className="text-[10px] italic">{ev.note}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
