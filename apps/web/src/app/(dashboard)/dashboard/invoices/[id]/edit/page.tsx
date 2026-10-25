"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Receipt,
  Save,
  Trash2,
  Calendar,
  DollarSign,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";
import { getInvoice, updateInvoiceStatus, type Invoice } from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useWorkspaceCurrency } from "@/hooks/use-workspace-currency";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";
import { logHandledError } from "@/lib/log-error";

export default function EditInvoicePage() {
  const params = useParams();
  const invoiceId = params?.id as string;
  const router = useRouter();
  const { getToken } = useAuth();
  const { currency } = useWorkspaceCurrency();

  const [status, setStatus] = useState<"draft" | "sent" | "paid" | "overdue">("sent");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: invoice, loading } = useApiData<Invoice>(
    `invoice:${invoiceId}`,
    async (token) => {
      if (!invoiceId) throw new Error("Missing invoice ID");
      return await getInvoice(invoiceId, token);
    }
  );

  useEffect(() => {
    if (invoice) {
      setStatus((invoice.status as any) || "sent");
      setNotes(invoice.notes || "");
    }
  }, [invoice]);

  // Unsaved-changes guard — the stored invoice is the baseline, so leaving
  // with unsaved edits asks first and a saved draft can be restored on return.
  const initialValues = useMemo(
    () => (invoice ? { status: (invoice.status as string) || "sent", notes: invoice.notes || "" } : undefined),
    [invoice]
  );

  const formValues = useMemo(() => ({ status, notes }), [status, notes]);

  const applyDraft = useCallback((draft: Record<string, unknown>) => {
    const s = (v: unknown) => (v == null ? null : String(v));
    if (s(draft.status)) setStatus(s(draft.status) as "draft" | "sent" | "paid" | "overdue");
    if (s(draft.notes) != null) setNotes(s(draft.notes)!);
  }, []);

  const guard = useUnsavedChangesGuard({
    values: formValues,
    initial: initialValues,
    enabled: !!invoice,
    draftKey: `invoice-edit-${invoiceId}`,
    onRestoreDraft: applyDraft,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = (await getToken()) || undefined;
      await updateInvoiceStatus(invoiceId, status, token);
      invalidateCache(`invoice:${invoiceId}`);
      invalidateCache("invoices:data");
      guard.markSaved();
      toast.success("Invoice updated successfully");
      router.push(`/dashboard/invoices/${invoiceId}`);
    } catch (err) {
      logHandledError("Error updating invoice:", err);
      toast.error("Could not update invoice");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !invoice) {
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
          href={`/dashboard/invoices/${invoiceId}`}
          className="group inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-fg transition-colors cursor-pointer"
        >
          <span className="w-6 h-6 rounded-lg bg-surface border border-line/70 flex items-center justify-center transition-all group-hover:bg-surface-elevated group-hover:border-line-strong group-hover:-translate-x-0.5">
            <ArrowLeft className="w-3.5 h-3.5 text-muted group-hover:text-fg" />
          </span>
          <span className="text-muted/80">Invoices</span>
          <span className="text-faint">/</span>
          <span className="text-muted/80">{invoice?.invoice_number}</span>
          <span className="text-faint">/</span>
          <span className="text-fg font-medium capitalize">Edit</span>
        </Link>
      </div>

      {/* Main Header Card: Title & Actions */}
      <div className="relative overflow-hidden rounded-2xl border border-line/70 bg-gradient-to-b from-card to-card/90 p-4 sm:px-6 sm:py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-fg capitalize">
            Edit Invoice {invoice?.invoice_number}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => guard.guardedPush(`/dashboard/invoices/${invoiceId}`)}
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
              Status & Notes
            </h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">Invoice Status</label>
                <select
                  value={status}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value as any)}
                  className="w-full h-10 rounded-xl bg-surface border border-line px-3 text-xs text-fg focus:outline-none focus:border-accent"
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">Client Notes / Terms</label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                  className="w-full p-3 rounded-xl bg-surface border border-line text-xs text-fg resize-none focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent hover:bg-accent-hi text-accent-fg font-bold h-11 rounded-xl shadow-md text-sm"
          >
            <Save className="w-4 h-4 mr-2" />
            {submitting ? "Saving..." : "Save Invoice"}
          </Button>
        </form>

        {/* Right Preview */}
        <div className="lg:col-span-5 sticky top-24 space-y-4">
          <CategoryVisualCard
            title={invoice?.invoice_number || "Invoice"}
            currentCount={formatMoney(invoice?.total_amount || 0, currency, 0)}
            totalCount="Amount"
            subtitle={invoice?.client_name ? `Client: ${invoice.client_name}` : "Direct"}
            tags={
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-sky-500/15 text-sky-400 border-sky-500/25 capitalize">
                  {status}
                </span>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
