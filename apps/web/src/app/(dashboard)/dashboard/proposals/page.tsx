"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { SubTabs } from "@/components/dashboard/SubTabs";
import { BookAIPanel } from "@/components/dashboard/panels/BookAIPanel";
import { toast } from "sonner";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import {
  FileText,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  Check,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getProposals,
  deleteProposal,
  updateProposalStatus,
  type Proposal,
} from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";

function ProposalsList() {
  const { getToken } = useAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: proposalsData, loading, refresh: loadData } = useApiData<Proposal[]>(
    "proposals:data",
    async (token) => getProposals(token).catch(() => [] as Proposal[]),
    { reportContext: "proposals" }
  );
  const proposals = proposalsData ?? [];

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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">Proposals</h1>
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
          <Link
            href="/dashboard/proposals/new"
            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs shadow-xs hover:shadow-sm active:scale-95 transition-all h-9"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Proposal
          </Link>
        </div>
      </div>

      {loading && proposals.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card border-line p-5 space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </Card>
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <Card className="bg-card border-dashed border-line p-12 text-center">
          <FileText className="w-12 h-12 text-faint mx-auto mb-4" />
          <h3 className="text-lg font-bold text-fg mb-1">No Saved Proposals Yet</h3>
          <p className="text-muted text-sm max-w-md mx-auto mb-6">
            Compose a pitch with the AI writer and it lands here — track each one from draft to won.
          </p>
          <Link
            href="/dashboard/proposals/new"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-sm shadow-xs active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 mr-1.5" />Write Your First Proposal
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {proposals.map((p) => (
            <Card key={p.id} className="bg-card border-line p-4 rounded-xl hover:border-line-strong transition-all space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-fg truncate">{p.title}</h4>
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
                    "text-[10px] uppercase font-semibold rounded-lg border px-2 py-1 bg-bg focus:outline-none shrink-0 " +
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

              <p className="text-xs text-fg line-clamp-3 font-mono bg-bg p-2 rounded-lg border border-line">
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const TABS = [
  { value: "proposals", label: "Saved Proposals" },
  { value: "book-ai", label: "Book AI" },
] as const;

function ProposalsContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const tab = searchParams.get("tab");
  const active = tab === "book-ai" ? "book-ai" : "proposals";

  const handleTabChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    // "proposals" is the default view, so drop the param entirely for a clean URL.
    if (next === "proposals") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  if (active === "book-ai") {
    return (
      <div className="space-y-6">
        <SubTabs tabs={TABS} value={active} onChange={handleTabChange} />
        <BookAIPanel />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SubTabs tabs={TABS} value={active} onChange={handleTabChange} />
      <ProposalsList />
    </div>
  );
}

export default function ProposalsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-72 rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      <ProposalsContent />
    </Suspense>
  );
}
