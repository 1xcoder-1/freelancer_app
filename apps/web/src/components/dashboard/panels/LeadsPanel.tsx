"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Target,
  Plus,
  RefreshCw,
  DollarSign,
  Trophy,
  CalendarClock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getLeads,
  getPipelineInsights,
  type Lead,
  type LeadStage,
  type PipelineInsights,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { CategoryVisualCard, ChaiCupIcon } from "@/components/dashboard/CategoryVisualCard";

const CARDS_PER_PAGE = 20;

const STAGES: Array<{ key: LeadStage; label: string; step: number; tone: string }> = [
  { key: "new", label: "New Lead", step: 1, tone: "bg-surface text-muted" },
  { key: "contacted", label: "Contacted", step: 2, tone: "bg-info/10 text-info" },
  { key: "proposal", label: "Proposal", step: 3, tone: "bg-accent-soft text-accent" },
  { key: "negotiation", label: "Talking Price", step: 4, tone: "bg-warn/10 text-warn" },
  { key: "won", label: "Won", step: 5, tone: "bg-ok/10 text-ok" },
  { key: "lost", label: "Lost", step: 0, tone: "bg-danger/10 text-danger" },
];

const money = (n: number, currency: string) =>
  `${currency === "USD" ? "$" : `${currency} `}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function LeadsPanel() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [catPages, setCatPages] = useState<Record<string, number>>({});

  const { data: leadsData, loading, refresh: loadLeads } = useApiData<Lead[]>(
    "leads:data",
    async (token) => getLeads(token),
    { reportContext: "leads" }
  );

  const { data: insights, refresh: loadInsights } = useApiData<PipelineInsights>(
    "leads:insights",
    async (token) => getPipelineInsights(token),
    { reportContext: "leads-insights" }
  );

  const leads = leadsData ?? [];
  const currency = insights?.currency ?? "USD";

  const reloadBoth = () => {
    invalidateCache("leads:insights");
    invalidateCache("clients:data");
    invalidateCache("dashboard:data");
    loadLeads();
    loadInsights();
  };

  const getLeadCategory = (l: Lead): string => {
    if (!l) return "Featured";
    if (l.notes && typeof l.notes === "string") {
      const match = l.notes.match(/\[category:\s*([^\]]+)\]/i);
      if (match && match[1]) {
        const parsed = match[1].trim();
        if (parsed && parsed !== "[object Object]" && !parsed.includes("[object Object]")) {
          return parsed;
        }
      }
    }
    return "Featured";
  };

  const handleOpenCreate = () => {
    router.push("/dashboard/leads/new");
  };

  const handleOpenDetail = (lead: Lead) => {
    router.push(`/dashboard/leads/${lead.id}`);
  };

  // Group leads by category (only categories that actually contain leads)
  const categoriesPresent = Array.from(
    new Set(
      leads
        .map((l) => getLeadCategory(l))
        .filter((cat) => Boolean(cat) && typeof cat === "string" && cat !== "[object Object]")
    )
  );
  if (categoriesPresent.length === 0 && leads.length > 0) {
    categoriesPresent.push("Featured");
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 no-scrollbar">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">Lead Pipeline</h2>
            <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
              {loading ? "Loading..." : `${leads.length} Active Deals`}
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Categorized sales pipeline, client acquisition, and follow-up tracker.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadLeads(true);
              loadInsights(true);
            }}
            disabled={loading}
            className="border-line text-fg bg-card hover:bg-surface w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <button
            onClick={() => handleOpenCreate()}
            className="relative group overflow-hidden rounded-xl p-[1px] font-semibold text-xs transition-all duration-300 shadow-sm hover:shadow-accent/25 hover:shadow-md active:scale-[0.98]"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-accent via-amber-400 to-accent rounded-xl opacity-90 group-hover:opacity-100 transition-opacity" />
            <span className="relative flex items-center gap-1.5 px-4 py-2 rounded-[11px] bg-accent group-hover:bg-accent-hi text-accent-fg transition-colors duration-200 font-bold">
              <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />
              <span>Add Lead</span>
            </span>
          </button>
        </div>
      </div>

      {/* Pipeline Health Insights Strip */}
      {insights ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-card border-line p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-muted text-xs font-semibold">
              <DollarSign className="w-3.5 h-3.5 text-accent" /> Pipeline Value
            </div>
            <p className="text-xl font-bold font-mono text-fg mt-1.5">{money(insights.open_pipeline_value, currency)}</p>
            <p className="text-[11px] text-muted mt-0.5">Realistic: {money(insights.weighted_pipeline_value, currency)}</p>
          </Card>
          <Card className="bg-card border-line p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-muted text-xs font-semibold">
              <Trophy className="w-3.5 h-3.5 text-ok" /> Win Rate
            </div>
            <p className="text-xl font-bold font-mono text-fg mt-1.5">{insights.win_rate_pct}%</p>
            <p className="text-[11px] text-muted mt-0.5">{insights.won_count} won · {insights.lost_count} lost</p>
          </Card>
          <Card className={`bg-card border-line p-4 rounded-2xl ${insights.due_follow_up_count > 0 ? "border-warn/40" : ""}`}>
            <div className="flex items-center gap-2 text-muted text-xs font-semibold">
              <CalendarClock className="w-3.5 h-3.5 text-warn" /> Follow Ups Due
            </div>
            <p className="text-xl font-bold font-mono text-fg mt-1.5">{insights.due_follow_up_count}</p>
            <p className="text-[11px] text-muted mt-0.5">waiting on outreach</p>
          </Card>
          <Card className={`bg-card border-line p-4 rounded-2xl ${insights.stale_deal_count > 0 ? "border-danger/40" : ""}`}>
            <div className="flex items-center gap-2 text-muted text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-danger" /> Going Cold
            </div>
            <p className="text-xl font-bold font-mono text-fg mt-1.5">{insights.stale_deal_count}</p>
            <p className="text-[11px] text-muted mt-0.5">untouched {insights.stale_after_days}+ days</p>
          </Card>
        </div>
      ) : null}

      {/* Cards Display Grouped by Category with Sliding Pagination */}
      {loading && leads.length === 0 ? (
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
      ) : leads.length === 0 ? (
        <Card className="bg-card border-dashed border-line p-12 text-center rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
            <ChaiCupIcon className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-fg">No leads yet</h3>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">
            Track every prospective project by category and move them through deal stages.
          </p>
          <Button
            onClick={() => handleOpenCreate()}
            className="mt-6 bg-accent hover:bg-accent-hi text-accent-fg font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add First Lead
          </Button>
        </Card>
      ) : (
        <div className="space-y-10">
          {categoriesPresent.map((cat) => {
            const catLeads = leads.filter((l) => getLeadCategory(l) === cat);
            if (catLeads.length === 0) return null;

            const totalPages = Math.ceil(catLeads.length / CARDS_PER_PAGE);
            const currentPage = Math.min(catPages[cat] || 1, totalPages || 1);
            const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
            const endIndex = Math.min(startIndex + CARDS_PER_PAGE, catLeads.length);
            const visibleLeads = catLeads.slice(startIndex, endIndex);

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
                    <div className="flex items-center gap-2">
                      <h3 className="text-base md:text-lg font-medium tracking-wide text-fg">
                        {cat}
                      </h3>
                      <span className="text-xs font-mono font-semibold text-accent bg-accent-soft px-2 py-0.5 rounded-md border border-accent/20">
                        {catLeads.length}
                      </span>
                    </div>
                    {/* Straight orange line under category title */}
                    <div className="w-full h-[2.5px] bg-accent rounded-full shadow-xs" />
                  </div>

                  {/* Sliding Pagination Controls (Shown when category has > 20 cards or multi-page) */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2 self-start sm:self-auto bg-card/90 backdrop-blur-md border border-line/80 px-3 py-1.5 rounded-2xl shadow-sm">
                      <span className="text-xs font-mono text-muted hidden sm:inline mr-1">
                        Showing <strong className="text-fg">{startIndex + 1}–{endIndex}</strong> of {catLeads.length}
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
                  {visibleLeads.map((lead) => {
                    const stageObj = STAGES.find((s) => s.key === lead.stage) || STAGES[0];
                    const totalSteps = 5;

                    return (
                      <CategoryVisualCard
                        key={lead.id}
                        title={lead.name}
                        currentCount={stageObj.step}
                        totalCount={totalSteps}
                        subtitle={lead.company || lead.source || "Referral"}
                        category={cat}
                        onClick={() => handleOpenDetail(lead)}
                        tags={
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                                lead.stage === "won"
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                                  : lead.stage === "negotiation"
                                  ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                                  : lead.stage === "proposal"
                                  ? "bg-purple-500/15 text-purple-400 border-purple-500/25"
                                  : lead.stage === "contacted"
                                  ? "bg-sky-500/15 text-sky-400 border-sky-500/25"
                                  : "bg-slate-500/15 text-slate-400 border-slate-500/25"
                              }`}
                            >
                              {stageObj.label}
                            </span>
                            <span className="text-[11px] font-mono font-medium text-orange-400 bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/25">
                              {money(lead.estimated_value || 0, currency)}
                            </span>
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
