"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Receipt,
  CheckCircle2,
  Send,
  Trash2,
  Copy,
  DollarSign,
  Calendar,
  Building2,
  Clock,
  ExternalLink,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getInvoice, updateInvoiceStatus, deleteInvoice, type Invoice } from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params?.id as string;
  const router = useRouter();
  const { getToken } = useAuth();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: invoice, loading, refresh: loadInvoice } = useApiData<Invoice>(
    `invoice:${invoiceId}`,
    async (token) => {
      if (!invoiceId) throw new Error("Missing invoice ID");
      return await getInvoice(invoiceId, token);
    },
    { reportContext: `invoice-${invoiceId}`, pollMs: 15_000 }
  );

  const handleStatusChange = async (newStatus: "draft" | "sent" | "paid" | "overdue") => {
    if (!invoice) return;
    setBusy(true);
    try {
      const token = (await getToken()) || undefined;
      await updateInvoiceStatus(invoice.id, newStatus, token);
      invalidateCache(`invoice:${invoiceId}`);
      invalidateCache("invoices:data");
      loadInvoice(true);
      toast.success(`Invoice marked as ${newStatus}`);
    } catch (err) {
      console.error("Error updating invoice status:", err);
      toast.error("Could not update invoice status");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = () => {
    if (!invoice) return;
    // V1: link the client to the token-guarded public pay page, never the
    // internal invoice id (which had no /pay/ route and 404'd every client).
    if (!invoice.token) {
      toast.error("This invoice has no payment link yet. Save it first, then try again.");
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/pay/${invoice.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Payment link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDelete = async () => {
    if (!invoice) return;
    const confirmed = await confirmDialog({
      title: "Delete Invoice",
      message: "Are you sure you want to delete this invoice? This action is permanent.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const token = (await getToken()) || undefined;
      await deleteInvoice(invoice.id, token);
      invalidateCache("invoices:data");
      toast.success("Invoice deleted");
      router.push("/dashboard/invoices");
    } catch (err) {
      console.error("Error deleting invoice:", err);
      toast.error("Could not delete invoice");
    }
  };

  if (loading && !invoice) {
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

  if (!invoice) {
    return (
      <div className="text-center py-20 space-y-4 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-fg">Invoice Not Found</h2>
        <p className="text-sm text-muted">The requested invoice does not exist or has been removed.</p>
        <Link href="/dashboard/invoices">
          <Button variant="outline" className="rounded-xl border-line">
            Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  const isPaid = invoice.status === "paid";
  const isOverdue = invoice.status === "overdue";
  const isSent = invoice.status === "sent";

  return (
    <div className="space-y-8 animate-in fade-in duration-300 no-scrollbar max-w-7xl mx-auto pb-16">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/invoices"
              className="inline-flex items-center text-xs font-semibold text-muted hover:text-fg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Invoices & Billing
            </Link>
            <span className="text-muted text-xs">•</span>
            <span className="text-xs text-accent font-semibold font-mono">{invoice.invoice_number}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg font-mono">
              {invoice.invoice_number}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border capitalize ${
                isPaid
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                  : isOverdue
                  ? "bg-rose-500/15 text-rose-400 border-rose-500/25"
                  : isSent
                  ? "bg-sky-500/15 text-sky-400 border-sky-500/25"
                  : "bg-surface text-muted border-line"
              }`}
            >
              {isPaid ? "★ Paid & Settled" : isOverdue ? "Overdue" : isSent ? "Sent to Client" : "Draft"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isPaid && (
            <Button
              size="sm"
              onClick={() => handleStatusChange("paid")}
              disabled={busy}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs h-9 px-3.5 rounded-xl gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark as Paid</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="border-line text-xs font-semibold h-9 rounded-xl gap-1.5"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Link Copied" : "Payment Link"}
          </Button>

          <Link href={`/dashboard/invoices/${invoice.id}/edit`}>
            <Button variant="outline" size="sm" className="border-line text-xs font-semibold h-9 rounded-xl gap-1.5">
              <Edit className="w-3.5 h-3.5" />
              <span>Edit</span>
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-xs text-muted hover:text-danger hover:bg-danger/10 h-9 px-2 rounded-xl"
            title="Delete Invoice"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Invoice Line Items */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="bg-card border-line p-6 rounded-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-accent" />
                <span className="text-sm font-bold text-fg">Line Items & Deliverables</span>
              </div>
              <span className="text-xs font-mono text-muted">
                Issued {new Date(invoice.created_at).toLocaleDateString()}
              </span>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-line text-muted uppercase text-[10px] tracking-wider">
                    <th className="pb-3 font-semibold">Description</th>
                    <th className="pb-3 font-semibold text-center">Qty / Hrs</th>
                    <th className="pb-3 font-semibold text-right">Unit Rate</th>
                    <th className="pb-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40">
                  {(invoice.items || []).map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface/30">
                      <td className="py-3.5 font-medium text-fg">{item.description}</td>
                      <td className="py-3.5 text-center font-mono text-muted">{item.quantity}</td>
                      <td className="py-3.5 text-right font-mono text-muted">${item.unit_price.toLocaleString()}</td>
                      <td className="py-3.5 text-right font-mono font-bold text-fg">
                        ${((item.amount !== undefined ? item.amount : item.quantity * item.unit_price) || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Footer */}
            <div className="pt-4 border-t border-line flex flex-col items-end space-y-1.5">
              <div className="flex items-center justify-between w-48 text-xs text-muted">
                <span>Subtotal</span>
                <span className="font-mono font-semibold">${invoice.total_amount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between w-48 text-sm font-bold text-fg pt-2 border-t border-line">
                <span>Total Due</span>
                <span className="font-mono text-accent text-base font-bold">
                  ${invoice.total_amount.toLocaleString()}
                </span>
              </div>
            </div>

            {invoice.notes && (
              <div className="p-4 rounded-xl bg-surface/30 border border-line text-xs text-muted space-y-1">
                <span className="font-semibold text-fg">Payment Terms & Notes:</span>
                <p className="leading-relaxed">{invoice.notes}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Right: Client Card & Status */}
        <div className="lg:col-span-4 space-y-5 sticky top-24">
          <Card className="bg-card border-line p-5 rounded-2xl space-y-4">
            <span className="text-xs font-bold text-fg">Recipient & Settlement</span>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface/40 border border-line">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-accent" />
                  <span className="text-muted">Client</span>
                </div>
                <span className="font-bold text-fg">{invoice.client_name || "Direct Client"}</span>
              </div>

              {invoice.due_date && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface/40 border border-line">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-accent" />
                    <span className="text-muted">Due Date</span>
                  </div>
                  <span className="font-mono text-fg">{new Date(invoice.due_date).toLocaleDateString()}</span>
                </div>
              )}

              {invoice.paid_at && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Settled On</span>
                  </div>
                  <span className="font-mono text-emerald-400 font-bold">
                    {new Date(invoice.paid_at).toLocaleDateString()}
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
