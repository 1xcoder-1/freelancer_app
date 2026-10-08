"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  FileSignature,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
  CheckCircle2,
  Trash2,
  Send,
  Eye,
  CheckCheck,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getContracts, deleteContract, type Contract } from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { CategoryVisualCard, ChaiCupIcon } from "@/components/dashboard/CategoryVisualCard";

const DEFAULT_CATEGORIES = [
  "Featured",
  "Awaiting Signature",
  "Signed Agreements",
  "Master Service Agreements",
  "Draft Agreements",
];

const CARDS_PER_PAGE = 20;

export function ContractsPanel() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [catPages, setCatPages] = useState<Record<string, number>>({});
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const { data: contractsData, loading, refresh: loadData } = useApiData<Contract[]>(
    "contracts:data",
    async (token) => {
      return await getContracts(undefined, token);
    },
    { reportContext: "contracts", pollMs: 20_000 }
  );

  const contracts = contractsData ?? [];

  // Helper to categorize contract based on status or type
  const getContractCategory = (c: Contract): string => {
    if (!c) return "Featured";
    if (c.status === "signed" || c.status === "fully_executed") return "Signed Agreements";
    if (c.status === "viewed" || c.status === "sent") return "Awaiting Signature";
    if (c.title?.toLowerCase().includes("msa") || c.title?.toLowerCase().includes("master")) {
      return "Master Service Agreements";
    }
    return "Draft Agreements";
  };

  const handleOpenCreate = () => {
    router.push("/dashboard/contracts/new");
  };

  const handleOpenDetail = (contract: Contract) => {
    router.push(`/dashboard/contracts/${contract.id}`);
  };

  const copySigningLink = (tokenOrId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/sign-contract/${tokenOrId}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(tokenOrId);
    toast.success("Public signing link copied to clipboard");
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleDeleteContract = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmed = await confirmDialog({
      title: "Delete Contract",
      message: "Are you sure you want to delete this agreement? This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const token = (await getToken()) || undefined;
      await deleteContract(id, token);
      invalidateCache("contracts:data");
      loadData(true);
      toast.success("Contract deleted");
    } catch (err) {
      console.error("Error deleting contract:", err);
      toast.error("Could not delete contract");
    }
  };

  const categoriesPresent = DEFAULT_CATEGORIES.filter((cat) =>
    contracts.some((c) => getContractCategory(c) === cat)
  );
  if (categoriesPresent.length === 0 && contracts.length > 0) {
    categoriesPresent.push("Featured");
  }

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
              Contracts
            </h2>
            <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
              {loading ? "Loading..." : `${contracts.length} Total Contracts`}
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Send legally binding proposals, agreements, and contracts with real-time signature audit logs.
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
            <span>Draft Contract</span>
          </button>
        </div>
      </div>

      {/* Main List */}
      {loading && contracts.length === 0 ? (
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
      ) : contracts.length === 0 ? (
        <Card className="bg-card border-dashed border-line p-10 text-center rounded-2xl">
          <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center mx-auto mb-3.5">
            <ChaiCupIcon className="w-6 h-6" />
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">No contracts yet</h3>
          <p className="text-xs sm:text-sm text-muted mt-1 max-w-sm mx-auto leading-relaxed">
            Draft statements of work, master services agreements, and send public e-sign links to clients.
          </p>
          <div className="mt-5 flex justify-center">
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm active:scale-95 transition-all duration-150 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Draft Contract</span>
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-10">
          {categoriesPresent.map((cat) => {
            const catContracts = contracts.filter((c) => getContractCategory(c) === cat);
            if (catContracts.length === 0) return null;

            const totalPages = Math.ceil(catContracts.length / CARDS_PER_PAGE);
            const currentPage = Math.min(catPages[cat] || 1, totalPages || 1);
            const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
            const endIndex = Math.min(startIndex + CARDS_PER_PAGE, catContracts.length);
            const visibleContracts = catContracts.slice(startIndex, endIndex);

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

                {/* Grid of Contracts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleContracts.map((contract) => {
                    const isExecuted = contract.status === "fully_executed" || contract.status === "signed";
                    const isViewed = contract.status === "viewed";
                    const isSent = contract.status === "sent";
                    const isExpired = contract.status === "expired";
                    const isSuperseded = contract.status === "superseded";
                    // N2: only still-open sign links carry an awaiting/expiry chip.
                    const awaiting = (isSent || isViewed) ? contract.days_awaiting : undefined;
                    const expiringSoon = (isSent || isViewed) && typeof contract.days_left === "number" && contract.days_left <= 5;
                    const dead = isExpired || isSuperseded || contract.status === "declined";

                    return (
                      <CategoryVisualCard
                        key={contract.id}
                        title={contract.title}
                        currentCount={isExecuted ? "★" : isViewed ? "1" : "0"}
                        totalCount={isExecuted ? "Signed" : isViewed ? "Viewed" : isSent ? "Sent" : isExpired ? "Expired" : isSuperseded ? "Superseded" : "Draft"}
                        subtitle={
                          contract.client_name
                            ? `Client: ${contract.client_name}`
                            : contract.project_title
                            ? `Project: ${contract.project_title}`
                            : "Standard Agreement"
                        }
                        category={cat}
                        onClick={() => handleOpenDetail(contract)}
                        tags={
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border capitalize ${
                                isExecuted
                                  ? "bg-ok/15 text-ok border-ok/25 font-semibold"
                                  : isViewed
                                  ? "bg-warn/15 text-warn border-warn/25"
                                  : isSent
                                  ? "bg-info/15 text-info border-info/25"
                                  : dead
                                  ? "bg-danger/15 text-danger border-danger/25"
                                  : "bg-surface text-muted border-line"
                              }`}
                            >
                              {isExecuted
                                ? "★ Executed"
                                : isViewed
                                ? "Viewed by Client"
                                : isSent
                                ? "Sent"
                                : isExpired
                                ? "Expired"
                                : isSuperseded
                                ? "Superseded"
                                : contract.status === "declined"
                                ? "Declined"
                                : "Draft"}
                            </span>
                            {/* N2: waiting age + expiry countdown on live links */}
                            {typeof awaiting === "number" && (
                              <span className="text-[11px] font-mono text-muted bg-surface px-2 py-0.5 rounded-full border border-line">
                                awaiting {awaiting}d
                              </span>
                            )}
                            {expiringSoon && (
                              <span className="text-[11px] font-mono font-semibold text-warn bg-warn/15 px-2 py-0.5 rounded-full border border-warn/25">
                                {contract.days_left! <= 0 ? "expires today" : `expires in ${contract.days_left}d`}
                              </span>
                            )}
                            {/* N5: version badge only once a contract has been re-sent */}
                            {contract.version && contract.version > 1 && (
                              <span className="text-[11px] font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-full border border-accent/20">
                                v{contract.version}
                              </span>
                            )}
                            {contract.project_title && (
                              <span className="text-[11px] font-mono font-medium text-orange-400 bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/25">
                                {contract.project_title}
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
