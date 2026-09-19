"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getProposals,
  createProposal,
  deleteProposal,
  generateAIProposalPitch,
  getClients,
  type Proposal,
  type Client,
} from "@/lib/api";

export default function ProposalsPage() {
  const { getToken } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientScope, setClientScope] = useState("");
  const [targetBudget, setTargetBudget] = useState(1500);
  const [proposalTitle, setProposalTitle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPitch, setGeneratedPitch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = (await getToken()) || undefined;
      const [propsRes, clientsRes] = await Promise.all([
        getProposals(token).catch(() => []),
        getClients(token).catch(() => []),
      ]);
      setProposals(propsRes);
      setClients(clientsRes);
    } catch (err) {
      console.error("Failed to load proposals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateAI = async () => {
    if (!clientScope.trim()) return;
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
    if (!generatedPitch.trim()) return;
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
    } catch (err) {
      console.error("Failed to save proposal:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this proposal?")) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteProposal(id, token);
      loadData();
    } catch (err) {
      console.error("Failed to delete proposal:", err);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-white">Proposals & AI Pitch Generator</h1>
            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 font-mono text-xs">
              🤖 Neon DB Connected
            </Badge>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Write high-converting client proposals, persist them to database, and track deal closures.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-white/10 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900 border-white/5 p-6 space-y-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </Card>
          <Card className="bg-slate-900 border-white/5 p-6 space-y-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Pitch Generator Input */}
          <Card className="bg-slate-900 border-white/10 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h3 className="text-base font-bold text-white">AI Pitch Writer</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400">Select Client (Optional)</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
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
                <label className="text-xs font-semibold text-slate-400">Client Job Description / Scope *</label>
                <textarea
                  value={clientScope}
                  onChange={(e) => setClientScope(e.target.value)}
                  placeholder="e.g. Need a Next.js 16 food delivery dashboard with Stripe payments and mobile responsiveness."
                  rows={4}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Proposed Budget ($)</label>
                <input
                  type="number"
                  value={targetBudget}
                  onChange={(e) => setTargetBudget(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <Button
                onClick={handleGenerateAI}
                disabled={isGenerating || !clientScope.trim()}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-lg shadow-purple-500/20"
              >
                <Bot className="w-4 h-4 mr-1.5" />
                {isGenerating ? "AI is crafting your pitch..." : "Generate Winning Proposal"}
              </Button>
            </div>

            {generatedPitch && (
              <div className="space-y-3 pt-3 border-t border-white/10 animate-in fade-in">
                <div>
                  <label className="text-xs font-semibold text-purple-300">Proposal Title</label>
                  <input
                    type="text"
                    value={proposalTitle}
                    onChange={(e) => setProposalTitle(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-purple-500/30 text-white text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-purple-300">Generated Scope & Pitch Body</label>
                  <textarea
                    value={generatedPitch}
                    onChange={(e) => setGeneratedPitch(e.target.value)}
                    rows={8}
                    className="w-full mt-1 p-3 rounded-lg bg-slate-950 border border-purple-500/30 text-slate-200 font-mono text-xs focus:outline-none"
                  />
                </div>

                <Button
                  onClick={handleSaveProposal}
                  disabled={isSaving}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20"
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  {isSaving ? "Saving to Neon DB..." : "Save Proposal to Database"}
                </Button>
              </div>
            )}
          </Card>

          {/* Proposals List */}
          <Card className="bg-slate-900 border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Saved Proposals ({proposals.length})</h3>
              <Badge variant="outline" className="text-[10px] text-slate-400 border-white/10">
                PostgreSQL Live
              </Badge>
            </div>

            {proposals.length > 0 ? (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {proposals.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl bg-slate-950 border border-white/10 hover:border-purple-500/30 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{p.title}</h4>
                        <p className="text-xs text-slate-400">
                          {p.client_name ? `Client: ${p.client_name} • ` : ""}
                          <span className="font-mono text-emerald-400 font-semibold">${p.budget.toLocaleString()}</span>
                          {" • "}
                          {p.created_at?.slice(0, 10)}
                        </p>
                      </div>

                      <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20 uppercase">
                        {p.status}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 font-mono bg-slate-900/60 p-2 rounded-lg border border-white/5">
                      {p.pitch_content}
                    </p>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyPitch(p.pitch_content, p.id)}
                        className="text-xs text-slate-400 hover:text-white h-7 px-2"
                      >
                        {copiedId === p.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
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
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                        title="Delete proposal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs">
                No proposals in database yet. Use the AI generator on the left to create and save your first proposal.
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
