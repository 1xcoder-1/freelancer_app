"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  Loader2,
  Send,
  Sparkles,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createProposal,
  generateAIProposalPitch,
  getClients,
  type Client,
} from "@/lib/api";
import { validateOrToast, nameSchema, moneySchema } from "@/lib/validation";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { celebrate } from "@/components/common/Celebration";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

const composerSchema = z.object({
  clientScope: nameSchema("Project scope", 1000),
  targetBudget: moneySchema("Target budget"),
});

const saveSchema = z.object({
  clientScope: nameSchema("Project scope", 1000),
  pitch: z.string().trim().min(1, "Generate a pitch before saving"),
  budget: moneySchema("Budget"),
});

export default function NewProposalPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientScope, setClientScope] = useState("");
  const [targetBudget, setTargetBudget] = useState(1500);
  const [proposalTitle, setProposalTitle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPitch, setGeneratedPitch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: clientsData, loading: clientsLoading } = useApiData<Client[]>(
    "proposals-new:clients",
    async (token) => getClients(token).catch(() => [] as Client[]),
  );
  const clients = clientsData ?? [];

  const formValues = useMemo(
    () => ({ selectedClientId, clientScope, targetBudget: String(targetBudget), proposalTitle, generatedPitch }),
    [selectedClientId, clientScope, targetBudget, proposalTitle, generatedPitch]
  );

  const applyDraft = useCallback((draft: Record<string, unknown>) => {
    const s = (v: unknown) => (v == null ? null : String(v));
    if (s(draft.selectedClientId) != null) setSelectedClientId(s(draft.selectedClientId)!);
    if (s(draft.clientScope) != null) setClientScope(s(draft.clientScope)!);
    const b = Number(s(draft.targetBudget));
    if (Number.isFinite(b) && b >= 0) setTargetBudget(b);
    if (s(draft.proposalTitle) != null) setProposalTitle(s(draft.proposalTitle)!);
    if (s(draft.generatedPitch) != null) setGeneratedPitch(s(draft.generatedPitch)!);
  }, []);

  const guard = useUnsavedChangesGuard({
    values: formValues,
    draftKey: "proposal-composer",
    onRestoreDraft: applyDraft,
  });

  const justSavedRef = useRef(false);
  React.useEffect(() => {
    if (justSavedRef.current && !clientScope && !generatedPitch && !proposalTitle) {
      justSavedRef.current = false;
      guard.markSaved();
    }
  }, [clientScope, generatedPitch, proposalTitle, guard]);

  const handleGenerateAI = async () => {
    if (!validateOrToast(composerSchema, { clientScope, targetBudget: Number(targetBudget) })) return;
    try {
      setIsGenerating(true);
      const token = (await getToken()) || undefined;
      const res = await generateAIProposalPitch(clientScope, targetBudget, token);
      setProposalTitle(res.title);
      setGeneratedPitch(res.pitch_content);
      toast.success("Pitch generated — review and edit below");
    } catch (err) {
      console.error("AI Generation failed:", err);
      toast.error("AI could not generate a pitch");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOrToast(saveSchema, { clientScope, pitch: generatedPitch, budget: Number(targetBudget) })) return;
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
      invalidateCache("proposals:data");
      justSavedRef.current = true;
      toast.success("Proposal saved");
      celebrate("Proposal sent");
      guard.markSaved();
      router.push("/dashboard/proposals");
    } catch (err) {
      console.error("Failed to save proposal:", err);
      toast.error("Could not save proposal");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <Link
            href="/dashboard/proposals"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Proposals</span>
          </Link>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            New Proposal
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => guard.guardedPush("/dashboard/proposals")}
            disabled={isSaving}
            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg border border-line bg-card hover:bg-surface text-fg font-medium text-xs sm:text-sm transition-all duration-150 cursor-pointer disabled:opacity-50 h-9"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="proposal-form"
            disabled={isSaving || !generatedPitch.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none h-9"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                <span>Save Proposal</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <form id="proposal-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Client & scope */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <h2 className="text-sm font-medium text-fg">Client & Scope</h2>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg block">Select Client (Optional)</label>
              {clientsLoading ? (
                <Skeleton className="w-full h-10 rounded-xl" />
              ) : (
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm focus:border-accent focus:bg-card focus:outline-none transition-all"
                >
                  <option value="">— General / Direct Pitch —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.company_name ? ` (${c.company_name})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg block">
                Client Job Description / Scope <span className="text-accent">*</span>
              </label>
              <textarea
                value={clientScope}
                onChange={(e) => setClientScope(e.target.value)}
                placeholder="e.g. Need a Next.js 16 food delivery dashboard with Stripe payments and mobile responsiveness."
                rows={4}
                className="w-full p-3 rounded-xl border border-line bg-surface/50 text-fg placeholder:text-muted/60 text-xs sm:text-sm focus:border-accent focus:bg-card focus:outline-none transition-all resize-y"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg block">Proposed Budget ($)</label>
              <input
                type="number"
                min="0"
                value={targetBudget}
                onChange={(e) => setTargetBudget(Number(e.target.value))}
                className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm font-mono focus:border-accent focus:bg-card focus:outline-none transition-all"
              />
            </div>

            <Button
              type="button"
              onClick={handleGenerateAI}
              disabled={isGenerating || !clientScope.trim()}
              className="w-full inline-flex items-center justify-center px-4 py-2 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-sm shadow-xs active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />AI is crafting your pitch...</>
              ) : (
                <><Bot className="w-4 h-4 mr-1.5" />Generate Winning Proposal</>
              )}
            </Button>
          </Card>

          {/* 2. Generated pitch */}
          <Card className="p-5 sm:p-6 rounded-2xl border border-line bg-card space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-1 border-b border-line/50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <h2 className="text-sm font-medium text-fg">Pitch & Title</h2>
              </div>
              <span className="text-[11px] font-mono text-muted tracking-wider">AI draft · editable</span>
            </div>

            {generatedPitch ? (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-fg block">Proposal Title</label>
                  <input
                    type="text"
                    value={proposalTitle}
                    onChange={(e) => setProposalTitle(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm focus:border-accent focus:bg-card focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-fg block">Generated Scope & Pitch Body</label>
                  <textarea
                    value={generatedPitch}
                    onChange={(e) => setGeneratedPitch(e.target.value)}
                    rows={12}
                    className="w-full p-3 rounded-xl border border-line bg-surface/50 text-fg text-xs font-mono focus:border-accent focus:bg-card focus:outline-none transition-all resize-y"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <Sparkles className="w-8 h-8 text-faint mx-auto mb-3" />
                <p className="text-xs text-faint max-w-sm mx-auto">
                  Fill in the scope above and press “Generate Winning Proposal” — the AI draft will appear here for you to edit before saving.
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Right column: preview */}
        <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-6">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted">Proposal Preview</span>
            <span className="text-[11px] font-mono text-muted">${Number(targetBudget || 0).toLocaleString()}</span>
          </div>

          <Card className="rounded-2xl border-line bg-card p-6 space-y-3 shadow-xs">
            <h3 className="text-base font-bold text-fg break-words">
              {proposalTitle || (clientScope.trim() ? `Proposal for ${clientScope.trim().slice(0, 40)}…` : "Untitled Proposal")}
            </h3>
            <p className="text-xs text-muted">
              {selectedClient
                ? `Client: ${selectedClient.name}${selectedClient.company_name ? ` · ${selectedClient.company_name}` : ""}`
                : "General / direct pitch"}
            </p>
            <p className="text-xs text-fg font-mono bg-surface/60 border border-line rounded-lg p-3 line-clamp-8">
              {generatedPitch || "The generated pitch will show here."}
            </p>
          </Card>
        </div>
      </form>
    </div>
  );
}
