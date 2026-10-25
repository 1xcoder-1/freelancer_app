"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  FileSignature,
  Save,
  Trash2,
  Send,
  User,
  Mail,
  ShieldCheck,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";
import { getContract, type Contract } from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { toast } from "sonner";
import { logHandledError } from "@/lib/log-error";

export default function EditContractPage() {
  const params = useParams();
  const contractId = params?.id as string;
  const router = useRouter();
  const { getToken } = useAuth();

  const [title, setTitle] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [content, setContent] = useState("");
  const [senderSignature, setSenderSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: contract, loading } = useApiData<Contract>(
    `contract:${contractId}`,
    async (token) => {
      if (!contractId) throw new Error("Missing contract ID");
      return await getContract(contractId, token);
    }
  );

  useEffect(() => {
    if (contract) {
      setTitle(contract.title || "");
      setRecipientName(contract.recipient_name || "");
      setRecipientEmail(contract.recipient_email || "");
      setContent(contract.content || "");
      setSenderSignature(contract.sender_signature || "");
    }
  }, [contract]);

  // Unsaved-changes guard — the stored contract is the baseline, so leaving
  // with edited terms asks first and a saved draft can be restored on return.
  const initialValues = useMemo(
    () =>
      contract
        ? {
            title: contract.title || "",
            recipientName: contract.recipient_name || "",
            recipientEmail: contract.recipient_email || "",
            content: contract.content || "",
            senderSignature: contract.sender_signature || "",
          }
        : undefined,
    [contract]
  );

  const formValues = useMemo(
    () => ({ title, recipientName, recipientEmail, content, senderSignature }),
    [title, recipientName, recipientEmail, content, senderSignature]
  );

  const applyDraft = useCallback((draft: Record<string, unknown>) => {
    const s = (v: unknown) => (v == null ? null : String(v));
    if (s(draft.title) != null) setTitle(s(draft.title)!);
    if (s(draft.recipientName) != null) setRecipientName(s(draft.recipientName)!);
    if (s(draft.recipientEmail) != null) setRecipientEmail(s(draft.recipientEmail)!);
    if (s(draft.content) != null) setContent(s(draft.content)!);
    if (s(draft.senderSignature) != null) setSenderSignature(s(draft.senderSignature)!);
  }, []);

  const guard = useUnsavedChangesGuard({
    values: formValues,
    initial: initialValues,
    enabled: !!contract,
    draftKey: `contract-edit-${contractId}`,
    onRestoreDraft: applyDraft,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Invalidate and redirect
      invalidateCache(`contract:${contractId}`);
      invalidateCache("contracts:data");
      guard.markSaved();
      toast.success("Contract details updated");
      router.push(`/dashboard/contracts/${contractId}`);
    } catch (err) {
      logHandledError("Error updating contract:", err);
      toast.error("Could not update contract");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !contract) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-4 animate-pulse">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 pt-2 px-3 sm:px-6 enter-stagger">
      {/* Top Breadcrumb & Quick Nav */}
      <div className="flex items-center justify-between pb-1">
        <Link
          href={`/dashboard/contracts/${contractId}`}
          className="group inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-fg transition-colors cursor-pointer"
        >
          <span className="w-6 h-6 rounded-lg bg-surface border border-line/70 flex items-center justify-center transition-all group-hover:bg-surface-elevated group-hover:border-line-strong group-hover:-translate-x-0.5">
            <ArrowLeft className="w-3.5 h-3.5 text-muted group-hover:text-fg" />
          </span>
          <span className="text-muted/80">Contracts</span>
          <span className="text-faint">/</span>
          <span className="text-muted/80">{contract?.title}</span>
          <span className="text-faint">/</span>
          <span className="text-fg font-medium capitalize">Edit</span>
        </Link>
      </div>

      {/* Main Header Card: Title & Actions */}
      <div className="relative overflow-hidden rounded-2xl border border-line/70 bg-gradient-to-b from-card to-card/90 p-4 sm:px-6 sm:py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-fg capitalize">
            Edit Agreement
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => guard.guardedPush(`/dashboard/contracts/${contractId}`)}
            disabled={submitting}
            className="h-9 px-3.5 rounded-xl border border-line bg-surface/50 hover:bg-surface-elevated hover:border-line-strong text-muted hover:text-fg font-medium text-xs transition-all active:scale-[0.97] cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            onClick={handleSave}
            disabled={submitting}
            className="h-9 px-4 rounded-xl border border-accent/40 bg-accent/15 hover:bg-accent hover:text-white text-accent font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-[0.96] shadow-[0_0_16px_rgba(212,107,40,0.12)] cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            <span>{submitting ? "Saving..." : "Save Changes"}</span>
          </Button>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-5">
          <div className="rounded-2xl border border-line/70 bg-card p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-4">
            <h2 className="font-display text-base font-medium tracking-wide text-fg pb-2.5 border-b border-line/60">
              Agreement Metadata
            </h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface border border-line text-xs text-fg focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted">Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-surface border border-line text-xs text-fg focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted">Recipient Email</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-surface border border-line text-xs text-fg focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line/70 bg-card p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-3">
            <h2 className="font-display text-base font-medium tracking-wide text-fg pb-2.5 border-b border-line/60">
              Agreement Content
            </h2>
            <textarea
              rows={12}
              value={content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
              className="w-full p-3 rounded-xl bg-surface border border-line text-xs font-mono text-fg leading-relaxed resize-y focus:outline-none focus:border-accent"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent hover:bg-accent-hi text-accent-fg font-bold h-11 rounded-xl shadow-md text-sm"
          >
            <Save className="w-4 h-4 mr-2" />
            {submitting ? "Saving..." : "Save Agreement"}
          </Button>
        </form>

        {/* Right Preview */}
        <div className="lg:col-span-5 sticky top-24 space-y-4">
          <CategoryVisualCard
            title={title || "Agreement"}
            currentCount="Edit"
            totalCount="Review"
            subtitle={recipientName ? `Signer: ${recipientName}` : "Agreement"}
            tags={
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-sky-500/15 text-sky-400 border-sky-500/25">
                  Live Edit
                </span>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
