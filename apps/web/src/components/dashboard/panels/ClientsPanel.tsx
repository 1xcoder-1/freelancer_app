"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Users,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getClients, type Client } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
import { invalidateCache } from "@/lib/cache";
import { CategoryVisualCard, ChaiCupIcon } from "@/components/dashboard/CategoryVisualCard";

const DEFAULT_CATEGORIES = ["Featured", "VIP & Enterprise", "Active Retainers", "General Clients"];
const CARDS_PER_PAGE = 20;

export function ClientsPanel() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [catPages, setCatPages] = useState<Record<string, number>>({});

  const { data: clientsData, loading, refresh: loadData } = useApiData<Client[]>(
    "clients:data",
    async (token) => {
      return await getClients(token);
    },
    { pollMs: 20000, reportContext: "clients" }
  );

  const clients = clientsData ?? [];

  // Helper to get effective category for a client
  const getClientCategory = (c: Client): string => {
    if (!c) return "Featured";
    // Check if notes has [category: ...]
    if (c.notes && typeof c.notes === "string") {
      const match = c.notes.match(/\[category:\s*([^\]]+)\]/i);
      if (match && match[1]) {
        const val = match[1].trim();
        if (val && val !== "[object Object]" && !val.includes("[object Object]")) {
          return val;
        }
      }
    }
    if (c.status === "vip") {
      return "VIP & Enterprise";
    }
    return "Featured";
  };

  const handleOpenCreate = () => {
    router.push("/dashboard/clients/new");
  };

  const handleOpenDetail = (client: Client) => {
    router.push(`/dashboard/clients/${client.id}`);
  };

  // Group clients by category (only categories that actually contain clients)
  const categoriesPresent = Array.from(
    new Set(
      clients
        .map((c) => getClientCategory(c))
        .filter((cat) => Boolean(cat) && typeof cat === "string" && cat !== "[object Object]")
    )
  );
  if (categoriesPresent.length === 0 && clients.length > 0) {
    categoriesPresent.push("Featured");
  }

  // Helper to format price numbers with commas (e.g. 50000 -> 50,000)
  const formatPriceWithCommas = (val: string): string => {
    if (!val) return "";
    const suffixMatch = val.match(/\s*(\/.*|[a-zA-Z]+)$/);
    const suffix = suffixMatch ? suffixMatch[0] : "";
    const numericOnly = suffixMatch ? val.slice(0, suffixMatch.index) : val;

    const clean = numericOnly.replace(/,/g, "").replace(/[^\d.]/g, "");
    if (!clean) return val;

    const parts = clean.split(".");
    const intStr = parts[0];
    const formattedInt = intStr ? Number(intStr).toLocaleString("en-US") : "0";

    if (parts.length > 1) {
      return `${formattedInt}.${parts[1]}${suffix}`;
    }

    return `${formattedInt}${suffix}`;
  };

  // Helper to parse client card metadata
  const parseClientCardInfo = (client: Client) => {
    let rateDisplay = "";
    let clientCurrency = "USD";
    const rawNotes = client.notes || "";
    const isVip = client.status === "vip";

    if (rawNotes) {
      const rateMatch = rawNotes.match(/\[rate:\s*([A-Z]{3})?\s*([^\]]+)\]/i);
      if (rateMatch) {
        if (rateMatch[1] && rateMatch[1] !== "[object Object]") clientCurrency = rateMatch[1].trim();
        if (rateMatch[2] && rateMatch[2] !== "[object Object]" && !rateMatch[2].includes("[object Object]")) {
          rateDisplay = formatPriceWithCommas(rateMatch[2].trim());
        }
      }
    }

    return { rateDisplay, clientCurrency, isVip };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 no-scrollbar">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">Clients Roster</h2>
            <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
              {loading ? "Loading..." : `${clients.length} Total`}
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Categorized roster of clients, retainers, and enterprise accounts.
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
            onClick={() => handleOpenCreate()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm active:scale-95 transition-all duration-150 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && clients.length === 0 ? (
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
      ) : clients.length === 0 ? (
        <Card className="bg-card border-dashed border-line p-10 text-center rounded-2xl">
          <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center mx-auto mb-3.5">
            <ChaiCupIcon className="w-6 h-6" />
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">No clients yet</h3>
          <p className="text-xs sm:text-sm text-muted mt-1 max-w-sm mx-auto leading-relaxed">
            Organize clients by category and track invoices, retainers, and contact details seamlessly.
          </p>
          <div className="mt-5 flex justify-center">
            <button
              onClick={() => handleOpenCreate()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm active:scale-95 transition-all duration-150 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Client</span>
            </button>
          </div>
        </Card>
      ) : (
        /* Categorized Cards with Sliding Pagination (20 cards per page) */
        <div className="space-y-10">
          {categoriesPresent.map((cat) => {
            const catClients = clients.filter((c) => getClientCategory(c) === cat);
            if (catClients.length === 0) return null;

            const totalPages = Math.ceil(catClients.length / CARDS_PER_PAGE);
            const currentPage = Math.min(catPages[cat] || 1, totalPages || 1);
            const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
            const endIndex = Math.min(startIndex + CARDS_PER_PAGE, catClients.length);
            const visibleClients = catClients.slice(startIndex, endIndex);

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
                {/* Category Header with Title, Count, Underline & Sliding Navigation */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="inline-flex flex-col items-start space-y-1.5">
                    <h3 className="font-display text-base md:text-lg font-medium tracking-wide text-fg">
                      {cat}
                    </h3>
                    {/* Straight orange line under category title */}
                    <div className="w-full h-[2.5px] bg-accent rounded-full shadow-xs" />
                  </div>

                  {/* Sliding Pagination Controls (Shown when category has > 20 cards or multi-page) */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2 self-start sm:self-auto bg-card/90 backdrop-blur-md border border-line/80 px-3 py-1.5 rounded-2xl shadow-sm">
                      <span className="text-xs font-mono text-muted hidden sm:inline mr-1">
                        Showing <strong className="text-fg">{startIndex + 1}–{endIndex}</strong> of {catClients.length}
                      </span>

                      {/* Slider Navigation Buttons */}
                      <div className="flex items-center gap-1 bg-surface/90 p-0.5 rounded-xl border border-line/70">
                        <button
                          onClick={handlePrevPage}
                          disabled={currentPage <= 1}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-fg hover:bg-accent/15 hover:text-accent disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg transition-all duration-200"
                          title="Previous 20 Cards"
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="px-2.5 py-0.5 text-xs font-mono font-bold text-accent bg-accent/10 rounded-md">
                          {currentPage} / {totalPages}
                        </div>

                        <button
                          onClick={handleNextPage}
                          disabled={currentPage >= totalPages}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-fg hover:bg-accent/15 hover:text-accent disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg transition-all duration-200"
                          title="Next 20 Cards"
                          aria-label="Next page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 animate-in fade-in duration-200">
                  {visibleClients.map((client) => {
                    const { rateDisplay, clientCurrency, isVip } = parseClientCardInfo(client);
                    const clientStatus = client.status ? client.status.toLowerCase() : "active";
                    const isClientVip = isVip || clientStatus === "vip";

                    return (
                      <CategoryVisualCard
                        key={client.id}
                        title={client.name}
                        subtitle={client.company_name || "Direct Client"}
                        category={cat}
                        onClick={() => handleOpenDetail(client)}
                        topRightContent={
                          isClientVip ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/15 to-yellow-500/15 dark:from-amber-500/20 dark:to-yellow-500/20 border border-amber-500/30 dark:border-amber-500/35 text-amber-700 dark:text-amber-300 text-xs font-semibold shadow-sm tracking-wide">
                              <span className="text-amber-600 dark:text-amber-400 text-sm">★</span>
                              <span className="font-display font-bold tracking-wider text-[11px]">VIP</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/10 dark:bg-white/5 border border-slate-200/90 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-medium shadow-2xs tracking-wide">
                              <span className="text-slate-400 dark:text-slate-500 text-[10px]">✦</span>
                              <span className="font-medium text-[11px] tracking-wide">Standard</span>
                            </div>
                          )
                        }
                        tags={
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* C2 silence badge — a quiet client is now visible */}
                            {typeof client.days_since_touch === "number" && client.days_since_touch >= 45 && (
                              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-red-500/10 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20 dark:border-red-500/25">
                                {client.days_since_touch}d silent
                              </span>
                            )}
                            {rateDisplay && (
                              <span className="text-[11px] font-mono font-medium text-orange-700 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/20 dark:border-orange-500/25">
                                {clientCurrency} {rateDisplay}
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
