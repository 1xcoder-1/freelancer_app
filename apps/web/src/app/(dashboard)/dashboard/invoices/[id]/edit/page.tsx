"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";
import { getInvoice, updateInvoiceStatus, type Invoice } from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { toast } from "sonner";

export default function EditInvoicePage() {
  const params = useParams();
  const invoiceId = params?.id as string;
  const router = useRouter();
  const { getToken } = useAuth();

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = (await getToken()) || undefined;
      await updateInvoiceStatus(invoiceId, status, token);
      invalidateCache(`invoice:${invoiceId}`);
      invalidateCache("invoices:data");
      toast.success("Invoice updated successfully");
      router.push(`/dashboard/invoices/${invoiceId}`);
    } catch (err) {
      console.error("Error updating invoice:", err);
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
    <div className="space-y-8 animate-in fade-in duration-300 no-scrollbar max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/invoices/${invoiceId}`}
              className="inline-flex items-center text-xs font-semibold text-muted hover:text-fg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back to Invoice
            </Link>
            <span className="text-muted text-xs">•</span>
            <span className="text-xs text-accent font-semibold font-mono">Edit State</span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            Edit Invoice {invoice?.invoice_number}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/dashboard/invoices/${invoiceId}`}>
            <Button variant="outline" className="border-line text-xs font-semibold h-9 rounded-xl">
              Cancel
            </Button>
          </Link>
          <Button
            onClick={handleSave}
            disabled={submitting}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-bold text-xs h-9 px-4 rounded-xl shadow-xs"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
          <Card className="bg-card border-line p-5 rounded-2xl space-y-4">
            <span className="text-xs font-bold text-fg">Status & Notes</span>
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
          </Card>

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
            currentCount={`$${(invoice?.total_amount || 0).toLocaleString()}`}
            totalCount="Amount"
            subtitle={invoice?.client_name ? `Client: ${invoice.client_name}` : "Direct"}
            category="Invoices & Billing"
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
