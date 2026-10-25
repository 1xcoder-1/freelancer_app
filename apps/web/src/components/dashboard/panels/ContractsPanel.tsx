"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TextMorph } from "torph/react";
import {
  FileSignature,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCheck,
  FileText,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getContracts, type Contract } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";

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
  const [catPages, setCatPages] = useState<Record<string, number>>({});

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

  const handleOpenDetail = (contract: Contract) => {
    router.push(`/dashboard/contracts/${contract.id}`);
  };

  const categoriesPresent = DEFAULT_CATEGORIES.filter((cat) =>
    contracts.some((c) => getContractCategory(c) === cat)
  );
  if (categoriesPresent.length === 0 && contracts.length > 0) {
    categoriesPresent.push("Featured");
  }

  const awaitingCount = contracts.filter(
    (c) => c.status === "sent" || c.status === "viewed"
  ).length;
  const signedCount = contracts.filter(
    (c) => c.status === "signed" || c.status === "fully_executed"
  ).length;
  const draftCount = contracts.filter(
    (c) => !["signed", "fully_executed", "sent", "viewed"].includes(c.status)
  ).length;

  return (
    <div className="space-y-6">
      {/* 4 Headline Metric Cards at the top — concise, vibrant, real-time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 enter-stagger">
        {loading && contracts.length === 0 ? (
          [1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl bg-card border border-line" />
          ))
        ) : (
          <>
            {/* Card 1: Total Contracts */}
            <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-accent/5 blur-2xl group-hover:bg-accent/15 transition-all duration-500 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
                  Contracts
                </span>
                <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-accent group-hover:border-accent/30 transition-all duration-200">
                  <FileSignature className="w-4 h-4" />
                </div>
              </div>
              <div className="relative z-10 my-2.5">
                <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
                  <TextMorph numbers className="tabular-nums">{contracts.length}</TextMorph>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 pt-1 text-xs text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block shrink-0" />
                <span>{categoriesPresent.length} agreement group{categoriesPresent.length === 1 ? "" : "s"}</span>
              </div>
            </div>

            {/* Card 2: Awaiting Signature */}
            <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/15 transition-all duration-500 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
                  Awaiting Sign
                </span>
                <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all duration-200">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="relative z-10 my-2.5">
                <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
                  <TextMorph numbers className="tabular-nums">{awaitingCount}</TextMorph>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 pt-1 text-xs text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0 animate-pulse" />
                <span>{awaitingCount > 0 ? "out with clients" : "all signed"}</span>
              </div>
            </div>

            {/* Card 3: Signed */}
            <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-accent/5 blur-2xl group-hover:bg-accent/15 transition-all duration-500 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
                  Signed
                </span>
                <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-accent group-hover:border-accent/30 transition-all duration-200">
                  <CheckCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="relative z-10 my-2.5">
                <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
                  <TextMorph numbers className="tabular-nums">{signedCount}</TextMorph>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 pt-1 text-xs text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block shrink-0" />
                <span>{signedCount} fully executed</span>
              </div>
            </div>

            {/* Card 4: Drafts */}
            <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/15 transition-all duration-500 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
                  Drafts
                </span>
                <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all duration-200">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="relative z-10 my-2.5">
                <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
                  <TextMorph numbers className="tabular-nums">{draftCount}</TextMorph>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 pt-1 text-xs text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                <span>{draftCount} pending review</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action Controls Row (below the 4 main cards) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-2">
          <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
            {contracts.length} Total Contract{contracts.length === 1 ? "" : "s"}
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

          <Link
            href="/dashboard/contracts/new"
            className="press group relative inline-flex h-9 items-center justify-center gap-1.5 rounded-xl font-medium text-xs sm:text-[13px] px-3.5 border active:scale-95 transition-all duration-150 cursor-pointer bg-gradient-to-b from-[#ff7a29] to-[#ea580c] hover:from-[#ff883d] hover:to-[#f97316] text-white shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.25),0_0_12px_rgba(234,88,12,0.3)] hover:shadow-[0_2px_5px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35),0_0_16px_rgba(234,88,12,0.45)] border-orange-400/40"
          >
            <Plus className="w-3.5 h-3.5 text-white transition-transform duration-200 group-hover:rotate-90" />
            <span>New Contract</span>
          </Link>
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
        <div className="rounded-2xl border border-line/70 bg-card p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-surface border border-line/80 mx-auto flex items-center justify-center text-muted">
            <FileSignature className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-lg font-medium text-fg">No contracts yet</h3>
            <p className="text-muted text-xs max-w-sm mx-auto">
              Draft legal agreements, send secure digital signing links, and seal project deliverables.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/dashboard/contracts/new"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-accent/40 bg-accent/15 hover:bg-accent hover:text-white text-accent font-semibold text-xs shadow-[0_0_16px_rgba(212,107,40,0.12)] transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create contract</span>
            </Link>
          </div>
        </div>
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
                    // N2: only still-open sign links carry an expiry countdown.
                    const expiringSoon = (isSent || isViewed) && typeof contract.days_left === "number" && contract.days_left <= 5;
                    const dead = isExpired || isSuperseded || contract.status === "declined";

                    return (
                      <CategoryVisualCard
                        key={contract.id}
                        title={contract.title}
                        subtitle={
                          contract.client_name
                            ? `Client: ${contract.client_name}`
                            : contract.project_title
                            ? `Project: ${contract.project_title}`
                            : "Standard Agreement"
                        }
                        onClick={() => handleOpenDetail(contract)}
                        topRightContent={
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                              isExecuted
                                ? "bg-ok/15 text-ok border-ok/25"
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
                              ? "Signed"
                              : isViewed
                              ? "Viewed"
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
                        }
                        tags={
                          <div className="flex flex-wrap items-center gap-1.5">
                            {expiringSoon && (
                              <span className="text-[11px] font-mono font-semibold text-warn bg-warn/15 px-2.5 py-0.5 rounded-full border border-warn/25">
                                {contract.days_left! <= 0 ? "expires today" : `expires in ${contract.days_left}d`}
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
