"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Receipt,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  AlertCircle,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/patterns";
import {
  getInvoices,
  getUnbilledTimeEntries,
  type Invoice,
  type UnbilledTimeEntry,
} from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
import { useWorkspaceCurrency } from "@/hooks/use-workspace-currency";
import { formatMoney } from "@/lib/currency";
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
  const { currency } = useWorkspaceCurrency();
  const [catPages, setCatPages] = useState<Record<string, number>>({});

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

  const categoriesPresent = DEFAULT_CATEGORIES.filter((cat) =>
    invoices.some((inv) => getInvoiceCategory(inv) === cat)
  );
  if (categoriesPresent.length === 0 && invoices.length > 0) {
    categoriesPresent.push("Featured");
  }

  const unbilledCount = unbilledTimeData?.length ?? 0;
  const unbilledTotal = (unbilledTimeData ?? []).reduce((acc, u) => acc + (u.amount || 0), 0);
  const outstandingCount = invoices.filter((inv) => inv.status === "sent").length;
  const overdueCount = invoices.filter((inv) => inv.status === "overdue").length;
  const paidCount = invoices.filter((inv) => inv.status === "paid").length;
  const paidTotal = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((acc, inv) => acc + (inv.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* 4 Headline Cards at the top (same as Clients) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 enter-stagger">
        {loading && invoices.length === 0 ? (
          <>
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
          </>
        ) : (
          <>
            <StatCard
              label="Total Invoices"
              value={invoices.length}
              icon={Receipt}
              rows={[
                { text: `${unbilledCount} unbilled time logs`, dot: unbilledCount > 0 ? "warn" : "info" },
              ]}
            />
            <StatCard
              label="Outstanding"
              value={outstandingCount}
              icon={Clock}
              rows={[
                {
                  text: `${formatMoney(unbilledTotal, currency, 0)} ready to bill`,
                  dot: outstandingCount > 0 ? "warn" : "ok",
                },
              ]}
            />
            <StatCard
              label="Overdue"
              value={overdueCount}
              icon={AlertCircle}
              rows={[
                {
                  text: overdueCount > 0 ? "needs a follow-up" : "nothing overdue",
                  dot: overdueCount > 0 ? "danger" : "ok",
                },
              ]}
            />
            <StatCard
              label="Paid & Settled"
              value={paidCount}
              icon={DollarSign}
              rows={[{ text: `${formatMoney(paidTotal, currency, 0)} collected`, dot: "ok" }]}
            />
          </>
        )}
      </div>

      {/* Action Controls Row (same as Clients) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-2">
          <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
            {invoices.length} Total Invoice{invoices.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading}
            className="border-line text-fg bg-card hover:bg-surface w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <button
            onClick={handleOpenCreate}
            className="press inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 h-9 rounded-xl bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm cursor-pointer"
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
                        subtitle={inv.client_name ? `Client: ${inv.client_name}` : "Direct Client"}
                        onClick={() => handleOpenDetail(inv)}
                        topRightContent={
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${isPaid
                                ? "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/25"
                                : isOverdue
                                  ? "bg-rose-500/10 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20 dark:border-rose-500/25"
                                  : isSent
                                    ? "bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/25"
                                    : "bg-surface text-muted border-line"
                              }`}
                          >
                            {isPaid ? "Paid" : isOverdue ? "Overdue" : isSent ? "Sent" : "Draft"}
                          </span>
                        }
                        tags={
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-mono font-medium text-orange-700 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/20 dark:border-orange-500/25">
                              {formatMoney(inv.total_amount, currency, 0)}
                            </span>
                            {inv.due_date && !isPaid && (
                              <span className="text-[11px] font-mono text-muted bg-surface px-2.5 py-0.5 rounded-full border border-line">
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
