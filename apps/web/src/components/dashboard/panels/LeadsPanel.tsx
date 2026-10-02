"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  ListChecks,
  Zap,
  Flame,
  XCircle,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SubTabs } from "@/components/dashboard/SubTabs";
import { StatCard, StatChip } from "@/components/dashboard/patterns";
import {
  getLeads,
  getPipelineInsights,
  type Lead,
  type LeadStage,
  type PipelineInsights,
} from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
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

// L4 proposal expiry chip. Pure by construction: both dates come from server
// data (never a render-time clock read), so it respects the react-hooks/purity
// rule while still telling the freelancer how long a quote stays valid.
const expiryChip = (expiresAt?: string | null, nowIso?: string): string => {
  if (!expiresAt) return "";
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return "";
  const now = nowIso ? new Date(nowIso).getTime() : Number.NaN;
  if (Number.isNaN(now)) return "Valid";
  const days = Math.ceil((end - now) / 86_400_000);
  if (days <= 0) return "Expired";
  return `Valid ${days} more day${days === 1 ? "" : "s"}`;
};

export function LeadsPanel() {
  const router = useRouter();
  const [catPages, setCatPages] = useState<Record<string, number>>({});
  const [tab, setTab] = useState("nextup");

  const { data: leadsData, loading, refresh: loadLeads } = useApiData<Lead[]>(
    "leads:data",
    async (token) => getLeads(token),
    { pollMs: 20000, reportContext: "leads" }
  );

  const { data: insights, refresh: loadInsights } = useApiData<PipelineInsights>(
    "leads:insights",
    async (token) => getPipelineInsights(token),
    { pollMs: 20000, reportContext: "leads-insights" }
  );

  const leads = leadsData ?? [];
  const currency = insights?.currency ?? "USD";

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

  const totalLeads = leads.length;
  const ongoingLeads = leads.filter((l) => l.stage !== "won" && l.stage !== "lost").length;
  const wonLeads = insights?.won_count ?? leads.filter((l) => l.stage === "won").length;
  const lostLeads = insights?.lost_count ?? leads.filter((l) => l.stage === "lost").length;
  const dueFollowUps = insights?.due_follow_up_count ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 no-scrollbar scrollbar-none">
      {/* 4 Headline Cards matching main dashboard layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {loading && !insights ? (
          <>
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
          </>
        ) : (
          <>
            <StatCard
              label="Pipeline Value"
              value={money(insights?.open_pipeline_value ?? 0, currency)}
              icon={DollarSign}
            />
            <StatCard
              label="Total Leads"
              value={totalLeads}
              icon={Target}
              rows={[
                { text: `${wonLeads} Won`, dot: "ok" },
                { text: `${lostLeads} Lost`, dot: "danger" },
              ]}
            />
            <StatCard
              label="Ongoing Leads"
              value={ongoingLeads}
              icon={Flame}
              rows={[
                { text: `${ongoingLeads} In Progress`, dot: "ok" },
                {
                  text: `${insights?.stale_deal_count ?? 0} Going Cold`,
                  dot: (insights?.stale_deal_count ?? 0) > 0 ? "danger" : "info",
                },
              ]}
            />
            <StatCard
              label="Follow Ups Due"
              value={dueFollowUps}
              icon={CalendarClock}
              rows={[
                {
                  text: dueFollowUps > 0 ? `${dueFollowUps} Outreach Required` : "All Caught Up",
                  dot: dueFollowUps > 0 ? "warn" : "ok",
                },
              ]}
            />
          </>
        )}
      </div>

      {/* Capsule Rating & Context Badges — Dashboard Pattern */}
      {insights && (
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 pt-1">
          {insights.response_speed?.median_hours_to_first_reply != null && (
            <StatChip tone="blue">
              <span className="font-semibold">{Math.round(insights.response_speed.median_hours_to_first_reply)}h</span>
              <span>Median first reply</span>
            </StatChip>
          )}
          {insights.response_speed?.median_days_to_close != null && (
            <StatChip tone="green">
              <span className="font-semibold">{insights.response_speed.median_days_to_close}d</span>
              <span>Median to close</span>
            </StatChip>
          )}
          {insights.source_revenue && insights.source_revenue.length > 0 && (
            <StatChip tone="purple">
              <span className="font-semibold">{insights.source_revenue[0].source}</span>
              <span>Top source ({money(insights.source_revenue[0].won_value, currency)})</span>
            </StatChip>
          )}
          {insights.lost_by_reason && Object.keys(insights.lost_by_reason).length > 0 && (
            <StatChip tone="amber">
              <span className="font-semibold">
                {Object.entries(insights.lost_by_reason).sort((a, b) => b[1] - a[1])[0]?.[0]}
              </span>
              <span>Top lost reason ({money(insights.median_lost_deal_size || 0, currency)} med.)</span>
            </StatChip>
          )}
        </div>
      )}

      {/* SubTabs row with Refresh + Add Lead Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <SubTabs
          tabs={[
            { value: "nextup", label: "Needs Action", count: insights?.next_up?.length ?? 0 },
            { value: "pipeline", label: "All Leads", count: leads.length },
          ]}
          value={tab}
          onChange={setTab}
        />

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadLeads(true);
              loadInsights(true);
            }}
            disabled={loading}
            className="border-line text-fg bg-card hover:bg-surface w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <button
            onClick={() => handleOpenCreate()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 h-9 rounded-xl bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm active:scale-95 transition-all duration-150 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {tab === "nextup" && (
        insights ? (
          (insights.next_up?.length ?? 0) === 0 ? (
            <Card className="bg-card border-dashed border-line p-10 text-center rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-ok/10 flex items-center justify-center mx-auto mb-3">
                <ListChecks className="w-6 h-6 text-ok" />
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">Inbox zero on the pipeline</h3>
              <p className="text-sm text-muted mt-1">Nothing due, nothing going cold, nothing awaiting a reply.</p>
            </Card>
          ) : (
            <Card className="bg-card border-line rounded-2xl overflow-hidden">
              <ul className="divide-y divide-line/70">
                {insights.next_up.map((item) => (
                  <li key={`${item.type}:${item.id}`}>
                    <button
                      onClick={() => (item.type === "proposal_reply"
                        ? router.push(`/dashboard/proposals`)
                        : router.push(`/dashboard/leads/${item.id}`))}
                      className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-surface/60 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${item.type === "follow_up" ? "bg-warn/10 text-warn" :
                            item.type === "stale" ? "bg-danger/10 text-danger" : "bg-info/10 text-info"
                          }`}>
                          {item.type === "follow_up" ? <CalendarClock className="w-4 h-4" /> :
                            item.type === "stale" ? <AlertTriangle className="w-4 h-4" /> : <ListChecks className="w-4 h-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-fg truncate">{item.name}</p>
                          <p className="text-[11px] text-muted truncate">{item.company ? `${item.company} · ` : ""}{item.why}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.expires_at && item.type === "proposal_reply" && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-accent-soft text-accent border-accent/20">
                            {expiryChip(item.expires_at, insights?.timestamp)}
                          </span>
                        )}
                        <span className="text-sm font-mono font-semibold text-orange-400">{money(item.value || 0, currency)}</span>
                        <ArrowUpRight className="w-4 h-4 text-muted group-hover:text-accent transition-colors" />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )
        ) : (
          <Skeleton className="h-40 w-full rounded-2xl" />
        )
      )}

      {tab === "pipeline" && (
        <>
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
            <Card className="bg-card border-dashed border-line p-10 text-center rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center mx-auto mb-3.5">
                <ChaiCupIcon className="w-6 h-6" />
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">No leads yet</h3>
              <p className="text-xs sm:text-sm text-muted mt-1 max-w-sm mx-auto leading-relaxed">
                Track every prospective project by category and move them through deal stages.
              </p>
              <div className="mt-5 flex justify-center">
                <button
                  onClick={() => handleOpenCreate()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm active:scale-95 transition-all duration-150 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Lead</span>
                </button>
              </div>
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
                                  className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${lead.stage === "won"
                                      ? "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/25"
                                      : lead.stage === "negotiation"
                                        ? "bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/25"
                                        : lead.stage === "proposal"
                                          ? "bg-purple-500/10 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20 dark:border-purple-500/25"
                                          : lead.stage === "contacted"
                                            ? "bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/25"
                                            : "bg-slate-500/10 dark:bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20 dark:border-slate-500/25"
                                    }`}
                                >
                                  {stageObj.label}
                                </span>
                                <span className="text-[11px] font-mono font-medium text-orange-700 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/20 dark:border-orange-500/25">
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
        </>
      )}
    </div>
  );
}
