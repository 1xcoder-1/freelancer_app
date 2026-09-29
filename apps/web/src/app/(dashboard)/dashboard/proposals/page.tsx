"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { z } from "zod";
import { validateOrToast, nameSchema, moneySchema } from "@/lib/validation";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import {
  Sparkles,
  Send,
  FileText,
  Plus,
  CheckCircle2,
  Bot,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getProposals,
  createProposal,
  deleteProposal,
  updateProposalStatus,
  generateAIProposalPitch,
  getClients,
  type Proposal,
  type Client,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";

export default function ProposalsPage() {
  const { getToken } = useAuth();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientScope, setClientScope] = useState("");
  const [targetBudget, setTargetBudget] = useState(1500);
  const [proposalTitle, setProposalTitle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPitch, setGeneratedPitch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: pageData, loading, refresh: loadData } = useApiData(
    "proposals:data",
    async (token) => {
      const [propsRes, clientsRes] = await Promise.all([
        getProposals(token).catch(() => []),
        getClients(token).catch(() => []),
      ]);
      return { proposals: propsRes, clients: clientsRes };
    },
    { reportContext: "proposals" }
  );

  const proposals = pageData?.proposals ?? [];
  const clients = pageData?.clients ?? [];

  const handleGenerateAI = async () => {
    if (!validateOrToast(z.object({ clientScope: nameSchema("Project scope", 1000), targetBudget: moneySchema("Target budget") }), { clientScope, targetBudget: Number(targetBudget) })) return;
    try {
      setIsGenerating(true);
      const token = (await getToken()) || undefined;
      const res = await generateAIProposalPitch(clientScope, targetBudget, token);
      setProposalTitle(res.title);
      setGeneratedPitch(res.pitch_content);
    } catch (err) {
      console.error("AI Generation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveProposal = async () => {
    if (!validateOrToast(z.object({
      clientScope: nameSchema("Project scope", 1000),
      pitch: z.string().trim().min(1, "Generate a pitch before saving"),
      budget: moneySchema("Budget"),
    }), { clientScope, pitch: generatedPitch, budget: Number(targetBudget) })) return;
    try {
      setIsSaving(true);
      const token = (await getToken()) || undefined;
      await createProposal(
        {
          title: proposalTitle || `Proposal for ${clientScope.slice(0, 30)}...`,
          client_id: selectedClientId || undefined,
          client_scope: clientScope,
          budget: Number(targetBudget),
          pitch_content: generatedPitch,
          status: "sent",
        },
        token
      );
      setClientScope("");
      setGeneratedPitch("");
      setProposalTitle("");
      setSelectedClientId("");
      loadData();
      toast.success("Proposal saved");
    } catch (err) {
      console.error("Failed to save proposal:", err);
      toast.error("Could not save proposal");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete proposal",
      message: "This proposal will be removed. Any link already sent to the client will stop working.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteProposal(id, token);
      loadData();
      toast.success("Proposal deleted");
    } catch (err) {
      console.error("Failed to delete proposal:", err);
      toast.error("Could not delete proposal");
    }
  };

  const handleSetStatus = async (id: string, statusVal: "draft" | "sent" | "accepted" | "declined") => {
    try {
      const token = (await getToken()) || undefined;
      await updateProposalStatus(id, statusVal, token);
      loadData();
    } catch (err) {
      console.error("Failed to update proposal status:", err);
    }
  };

  const handleCopyPitch = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">Proposals</h1>
          </div>
          <p className="text-muted text-sm mt-1">
            Write winning proposals for new clients, save them, and mark deals as won.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading}
            className="border-line text-fg hover:text-fg w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-line p-6 space-y-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </Card>
          <Card className="bg-card border-line p-6 space-y-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Pitch Generator Input */}
          <Card className="bg-card border-line p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <h3 className="text-base font-bold text-fg">AI Pitch Writer</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted">Select Client (Optional)</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-line-strong"
                >
                  <option value="">-- General / Direct Pitch --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company_name ? `(${c.company_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted">Client Job Description / Scope *</label>
                <textarea
                  value={clientScope}
                  onChange={(e) => setClientScope(e.target.value)}
                  placeholder="e.g. Need a Next.js 16 food delivery dashboard with Stripe payments and mobile responsiveness."
                  rows={4}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-line-strong"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted">Proposed Budget ($)</label>
                <input
                  type="number"
                  value={targetBudget}
                  onChange={(e) => setTargetBudget(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-line-strong"
                />
              </div>

              <Button
                onClick={handleGenerateAI}
                disabled={isGenerating || !clientScope.trim()}
                className="w-full bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
              >
                <Bot className="w-4 h-4 mr-1.5" />
                {isGenerating ? "AI is crafting your pitch..." : "Generate Winning Proposal"}
              </Button>
            </div>

            {generatedPitch && (
              <div className="space-y-3 pt-3 border-t border-line animate-in fade-in">
                <div>
                  <label className="text-xs font-semibold text-accent">Proposal Title</label>
                  <input
                    type="text"
                    value={proposalTitle}
                    onChange={(e) => setProposalTitle(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line-strong text-fg text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-accent">Generated Scope & Pitch Body</label>
                  <textarea
                    value={generatedPitch}
                    onChange={(e) => setGeneratedPitch(e.target.value)}
                    rows={8}
                    className="w-full mt-1 p-3 rounded-lg bg-bg border border-line-strong text-fg font-mono text-xs focus:outline-none"
                  />
                </div>

                <Button
                  onClick={handleSaveProposal}
                  disabled={isSaving}
                  className="w-full bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  {isSaving ? "Saving..." : "Save Proposal"}
                </Button>
              </div>
            )}
          </Card>

          {/* Proposals List */}
          <Card className="bg-card border-line p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-fg">Saved Proposals ({proposals.length})</h3>
            </div>

            {proposals.length > 0 ? (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {proposals.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl bg-bg border border-line hover:border-line-strong transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-fg">{p.title}</h4>
                        <p className="text-xs text-muted">
                          {p.client_name ? `Client: ${p.client_name} • ` : ""}
                          <span className="font-mono text-accent font-semibold">${p.budget.toLocaleString()}</span>
                          {" • "}
                          {p.created_at?.slice(0, 10)}
                        </p>
                      </div>

                      <select
                        value={p.status}
                        onChange={(e) => handleSetStatus(p.id, e.target.value as "draft" | "sent" | "accepted" | "declined")}
                        className={
                          "text-[10px] uppercase font-semibold rounded-lg border px-2 py-1 bg-bg focus:outline-none " +
                          (p.status === "accepted"
                            ? "text-accent border-accent/30"
                            : p.status === "declined"
                              ? "text-danger border-danger/30"
                              : "text-muted border-line")
                        }
                        title="Update proposal status"
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="accepted">Accepted</option>
                        <option value="declined">Declined</option>
                      </select>
                    </div>

                    <p className="text-xs text-fg line-clamp-2 font-mono bg-card p-2 rounded-lg border border-line">
                      {p.pitch_content}
                    </p>

                    <div className="pt-2 border-t border-line flex items-center justify-between">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyPitch(p.pitch_content, p.id)}
                        className="text-xs text-muted hover:text-fg h-7 px-2"
                      >
                        {copiedId === p.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1 text-accent" />
                            <span className="italic font-medium text-accent">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-1" />
                            Copy Pitch
                          </>
                        )}
                      </Button>

                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-faint hover:text-danger p-1 transition-colors"
                        title="Delete proposal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-faint text-xs">
                No saved proposals yet. Write one on the left and press Save.
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
