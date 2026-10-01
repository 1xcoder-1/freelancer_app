"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Receipt,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
  CheckCircle2,
  Trash2,
  Send,
  Clock,
  DollarSign,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getInvoices,
  deleteInvoice,
  updateInvoiceStatus,
  getUnbilledTimeEntries,
  type Invoice,
  type UnbilledTimeEntry,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { CategoryVisualCard, ChaiCupIcon } from "@/components/dashboard/CategoryVisualCard";

const DEFAULT_CATEGORIES = [
  "Featured",
  "Outstanding & Unpaid",
  "Overdue Payments",
  "Paid & Settled",
  "Draft Invoices",
];

const CARDS_PER_PAGE = 20;

export function InvoicesPanel() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [catPages, setCatPages] = useState<Record<string, number>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: invoicesData, loading, refresh: loadData } = useApiData<Invoice[]>(
    "invoices:data",
    async (token) => {
      return await getInvoices(token);
    },
    { reportContext: "invoices", pollMs: 20_000 }
  );

  const { data: unbilledTimeData } = useApiData<UnbilledTimeEntry[]>(
    "invoices:unbilled-time",
    async (token) => await getUnbilledTimeEntries(token)
  );

  const invoices = invoicesData ?? [];

  // Categorize invoice based on payment state and due date
  const getInvoiceCategory = (inv: Invoice): string => {
    if (!inv) return "Featured";
    if (inv.status === "paid") return "Paid & Settled";
    if (inv.status === "overdue") return "Overdue Payments";
    if (inv.status === "draft") return "Draft Invoices";
    return "Outstanding & Unpaid";
  };

  const handleOpenCreate = () => {
    router.push("/dashboard/invoices/new");
  };

  const handleOpenDetail = (invoice: Invoice) => {
    router.push(`/dashboard/invoices/${invoice.id}`);
  };

  const copyPaymentLink = (invoiceId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/pay/${invoiceId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(invoiceId);
    toast.success("Payment link copied to clipboard");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDeleteInvoice = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmed = await confirmDialog({
      title: "Delete Invoice",
      message: "Are you sure you want to delete this invoice? This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const token = (await getToken()) || undefined;
      await deleteInvoice(id, token);
      invalidateCache("invoices:data");
      loadData(true);
      toast.success("Invoice deleted");
    } catch (err) {
      console.error("Error deleting invoice:", err);
      toast.error("Could not delete invoice");
    }
  };

  const categoriesPresent = DEFAULT_CATEGORIES.filter((cat) =>
    invoices.some((inv) => getInvoiceCategory(inv) === cat)
  );
  if (categoriesPresent.length === 0 && invoices.length > 0) {
    categoriesPresent.push("Featured");
  }

  const unbilledCount = unbilledTimeData?.length ?? 0;
  const unbilledTotal = (unbilledTimeData ?? []).reduce((acc, u) => acc + (u.amount || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 no-scrollbar">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
              Invoices & Billing
            </h2>
            <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
              {loading
                ? "Loading..."
                : `${invoices.length} Total Invoices • ${unbilledCount} Unbilled Logs ($${unbilledTotal.toLocaleString()})`}
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Bill clients for deliverables, track settlements, and import logged sprint time automatically.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading}
            className="border-line text-fg bg-card hover:bg-surface w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm active:scale-95 transition-all duration-150 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Issue Invoice</span>
          </button>
        </div>
      </div>

      {/* Main List */}
      {loading && invoices.length === 0 ? (
        <div className="space-y-8">
          {[1, 2].map((group) => (
            <div key={group} className="space-y-3">
              <Skeleton className="h-6 w-36 rounded-md" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-36 w-full rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <Card className="bg-card border-dashed border-line p-10 text-center rounded-2xl">
          <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center mx-auto mb-3.5">
            <ChaiCupIcon className="w-6 h-6" />
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">No invoices yet</h3>
          <p className="text-xs sm:text-sm text-muted mt-1 max-w-sm mx-auto leading-relaxed">
            Issue invoices, convert tracked sprint time into line items, and receive client payments directly.
          </p>
          <div className="mt-5 flex justify-center">
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm active:scale-95 transition-all duration-150 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Issue Invoice</span>
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-10">
          {categoriesPresent.map((cat) => {
            const catInvoices = invoices.filter((inv) => getInvoiceCategory(inv) === cat);
            if (catInvoices.length === 0) return null;

            const totalPages = Math.ceil(catInvoices.length / CARDS_PER_PAGE);
            const currentPage = Math.min(catPages[cat] || 1, totalPages || 1);
            const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
            const endIndex = Math.min(startIndex + CARDS_PER_PAGE, catInvoices.length);
            const visibleInvoices = catInvoices.slice(startIndex, endIndex);

            const handlePrevPage = () => {
              setCatPages((prev) => ({
                ...prev,
                [cat]: Math.max(1, currentPage - 1),
              }));
            };

            const handleNextPage = () => {
              setCatPages((prev) => ({
                ...prev,
                [cat]: Math.min(totalPages, currentPage + 1),
              }));
            };

            return (
              <div key={cat} className="space-y-4">
                {/* Category Header with Title, Count, Underline & Navigation */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="inline-flex flex-col items-start space-y-1.5">
                    <h3 className="font-display text-base md:text-lg font-medium tracking-wide text-fg">
                      {cat}
                    </h3>
                    {/* Straight orange line under category title */}
                    <div className="w-full h-[2.5px] bg-accent rounded-full shadow-xs" />
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-xs font-mono text-muted">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                        className="h-8 w-8 rounded-lg border-line"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 rounded-lg border-line"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Grid of Invoices */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleInvoices.map((inv) => {
                    const isPaid = inv.status === "paid";
                    const isOverdue = inv.status === "overdue";
                    const isSent = inv.status === "sent";

                    return (
                      <CategoryVisualCard
                        key={inv.id}
                        title={inv.invoice_number}
                        currentCount={`$${inv.total_amount.toLocaleString()}`}
                        totalCount={isPaid ? "Paid" : isOverdue ? "Overdue" : "Due"}
                        subtitle={inv.client_name ? `Client: ${inv.client_name}` : "Direct Client"}
                        category={cat}
                        onClick={() => handleOpenDetail(inv)}
                        tags={
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border capitalize ${isPaid
                                  ? "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/25 font-semibold"
                                  : isOverdue
                                    ? "bg-rose-500/10 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20 dark:border-rose-500/25 font-semibold"
                                    : isSent
                                      ? "bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/25"
                                      : "bg-surface text-muted border-line"
                                }`}
                            >
                              {isPaid
                                ? "★ Paid"
                                : isOverdue
                                  ? "Overdue"
                                  : isSent
                                    ? "Sent to Client"
                                    : "Draft"}
                            </span>

                            {inv.due_date && (
                              <span className="text-[11px] font-mono font-medium text-orange-700 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/20 dark:border-orange-500/25">
                                Due {new Date(inv.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        }
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
