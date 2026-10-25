"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { TextMorph } from "torph/react";
import {
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  LayoutGrid,
  Layers,
  Lock,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SubTabs } from "@/components/dashboard/SubTabs";
import {
  getProjects,
  updateProject,
  type Project,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { useWorkspaceCurrency } from "@/hooks/use-workspace-currency";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";
import { usePlanCapacity } from "@/components/dashboard/PlanLimit";
import { logHandledError } from "@/lib/log-error";

const CARDS_PER_PAGE = 20;

const moneyShort = (n: number, currency: string) => formatMoney(n, currency, 0);

export function ProjectsPanel() {
  const router = useRouter();
  const { getToken } = useAuth();
  const capacity = usePlanCapacity("projects");
  const { currency } = useWorkspaceCurrency();

  const [activeTab, setActiveTab] = useState<"now" | "archive">("now");
  const [catPages, setCatPages] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: projectsData, loading, refresh: loadData } = useApiData<Project[]>(
    "projects:data",
    async (token) => {
      return await getProjects(token);
    },
    {
      reportContext: "projects",
      pollMs: 20_000,
    }
  );

  const projects = projectsData ?? [];

  // Helper to extract category from project description or metadata
  const getProjectCategory = (p: Project): string => {
    if (!p) return "Featured";
    if (p.description && typeof p.description === "string") {
      const match = p.description.match(/\[category:\s*([^\]]+)\]/i);
      if (match && match[1]) {
        const val = match[1].trim();
        if (val && val !== "[object Object]" && !val.includes("[object Object]")) {
          return val;
        }
      }
    }
    return "Featured";
  };

  const activeProjects = projects.filter((p) => p.status === "planning" || p.status === "in_progress");
  const archivedProjects = projects.filter((p) => p.status === "completed" || p.status === "paused");
  const currentProjectList = activeTab === "archive" ? archivedProjects : activeProjects;

  const handleOpenDetail = (project: Project) => {
    router.push(`/dashboard/projects/${project.id}`);
  };

  const handleRestoreProject = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBusyId(id);
    try {
      const token = (await getToken()) || undefined;
      await updateProject(id, { status: "in_progress" }, token);
      invalidateCache("projects:data");
      invalidateCache("dashboard:data");
      loadData();
      toast.success("Project is active again");
    } catch (err) {
      logHandledError("Error restoring project:", err);
      toast.error("Could not restore project");
    } finally {
      setBusyId(null);
    }
  };

  // Group current projects by category
  const categoriesPresent = Array.from(
    new Set(
      currentProjectList
        .map((p) => getProjectCategory(p))
        .filter((cat) => Boolean(cat) && typeof cat === "string" && cat !== "[object Object]")
    )
  );
  if (categoriesPresent.length === 0 && currentProjectList.length > 0) {
    categoriesPresent.push("Featured");
  }

  return (
    <div className="space-y-6">
      {/* 4 Headline Metric Cards at the top — concise, vibrant, real-time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 enter-stagger">
        {loading && projects.length === 0 ? (
          [1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl bg-card border border-line" />
          ))
        ) : (
          <>
            {/* Card 1: Total Projects */}
            <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-accent/5 blur-2xl group-hover:bg-accent/15 transition-all duration-500 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
                  Projects
                </span>
                <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-accent group-hover:border-accent/30 transition-all duration-200">
                  <LayoutGrid className="w-4 h-4" />
                </div>
              </div>
              <div className="relative z-10 my-2.5">
                <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
                  <TextMorph numbers className="tabular-nums">{projects.length}</TextMorph>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 pt-1 text-xs text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block shrink-0" />
                <span>{activeProjects.length} active in motion</span>
              </div>
            </div>

            {/* Card 2: Active Now */}
            <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/15 transition-all duration-500 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
                  Active Now
                </span>
                <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all duration-200">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="relative z-10 my-2.5">
                <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
                  <TextMorph numbers className="tabular-nums">{activeProjects.length}</TextMorph>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 pt-1 text-xs text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0 animate-pulse" />
                <span>{activeProjects.length > 0 ? "delivery on track" : "all clear"}</span>
              </div>
            </div>

            {/* Card 3: Archived */}
            <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-accent/5 blur-2xl group-hover:bg-accent/15 transition-all duration-500 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
                  Archived
                </span>
                <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-accent group-hover:border-accent/30 transition-all duration-200">
                  <RotateCcw className="w-4 h-4" />
                </div>
              </div>
              <div className="relative z-10 my-2.5">
                <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
                  <TextMorph numbers className="tabular-nums">{archivedProjects.length}</TextMorph>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 pt-1 text-xs text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block shrink-0" />
                <span>{archivedProjects.length} completed / paused</span>
              </div>
            </div>

            {/* Card 4: Categories */}
            <div className="group relative p-5 rounded-2xl border border-line/70 bg-gradient-to-b from-card via-card to-surface/20 hover:border-line-strong hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default select-none shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/15 transition-all duration-500 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
                  Categories
                </span>
                <div className="w-8 h-8 rounded-xl bg-surface/80 border border-line/60 flex items-center justify-center text-muted group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all duration-200">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="relative z-10 my-2.5">
                <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg transition-transform duration-300 group-hover:translate-x-0.5">
                  <TextMorph numbers className="tabular-nums">{categoriesPresent.length}</TextMorph>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-1.5 pt-1 text-xs text-muted font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                <span>{categoriesPresent.length} project group{categoriesPresent.length === 1 ? "" : "s"}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action Controls Row (below the 4 main cards) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-2">
          <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
            {projects.length} Total Project{projects.length === 1 ? "" : "s"}
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
            href={capacity.atLimit ? capacity.upgradeHref : "/dashboard/projects/new"}
            title={
              capacity.atLimit
                ? `Project limit reached (${capacity.used}/${capacity.limit})`
                : "Add Project"
            }
            className={`press group relative inline-flex h-9 items-center justify-center gap-1.5 rounded-xl font-medium text-xs sm:text-[13px] px-3.5 border active:scale-95 transition-all duration-150 cursor-pointer ${
              capacity.atLimit
                ? "bg-warn/15 text-warn border-warn/30 hover:bg-warn/20"
                : "bg-gradient-to-b from-[#ff7a29] to-[#ea580c] hover:from-[#ff883d] hover:to-[#f97316] text-white shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.25),0_0_12px_rgba(234,88,12,0.3)] hover:shadow-[0_2px_5px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.35),0_0_16px_rgba(234,88,12,0.45)] border-orange-400/40"
            }`}
          >
            {capacity.atLimit ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Plus className="w-3.5 h-3.5 text-white transition-transform duration-200 group-hover:rotate-90" />
            )}
            <span>{capacity.atLimit ? "Upgrade plan" : "New project"}</span>
          </Link>
        </div>
      </div>

      {/* Active / Archived filter */}
      <SubTabs
        tabs={[
          { value: "now", label: "Active Projects", count: activeProjects.length },
          { value: "archive", label: "Archived", count: archivedProjects.length },
        ] as const}
        value={activeTab === "archive" ? "archive" : "now"}
        onChange={(v) => setActiveTab(v as any)}
      />

      {/* ============================================================ */}
      {/* SUBTAB 1 & 4: NOW / ARCHIVE PROJECT BOARDS                   */}
      {/* ============================================================ */}
      {(activeTab === "now" || activeTab === "archive") && (
        <>
          {loading && currentProjectList.length === 0 ? (
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
          ) : currentProjectList.length === 0 ? (
            <div className="rounded-2xl border border-line/70 bg-card p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-surface border border-line/80 mx-auto flex items-center justify-center text-muted">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-lg font-medium text-fg">
                  {activeTab === "archive" ? "No archived projects" : "No active projects yet"}
                </h3>
                <p className="text-muted text-xs max-w-sm mx-auto">
                  {activeTab === "archive"
                    ? "Completed and paused projects you archive will appear here."
                    : "Create client projects with phased deliverables and track time-to-value."}
                </p>
              </div>
              {activeTab === "now" && (
                <div className="pt-2">
                  <Link
                    href={capacity.atLimit ? capacity.upgradeHref : "/dashboard/projects/new"}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-accent/40 bg-accent/15 hover:bg-accent hover:text-white text-accent font-semibold text-xs shadow-[0_0_16px_rgba(212,107,40,0.12)] transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create project</span>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-10">
              {categoriesPresent.map((cat) => {
                const catProjects = currentProjectList.filter((p) => getProjectCategory(p) === cat);
                if (catProjects.length === 0) return null;

                const totalPages = Math.ceil(catProjects.length / CARDS_PER_PAGE);
                const currentPage = Math.min(catPages[cat] || 1, totalPages || 1);
                const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
                const endIndex = Math.min(startIndex + CARDS_PER_PAGE, catProjects.length);
                const visibleProjects = catProjects.slice(startIndex, endIndex);

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

                      {/* Sliding Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center gap-2 self-start sm:self-auto bg-card/90 backdrop-blur-md border border-line/80 px-3 py-1.5 rounded-2xl shadow-sm">
                          <span className="text-xs font-mono text-muted hidden sm:inline mr-1">
                            Showing <strong className="text-fg">{startIndex + 1}–{endIndex}</strong> of {catProjects.length}
                          </span>

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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 stagger-grid">
                      {visibleProjects.map((p) => {
                        const totalMilestones = p.milestones?.length || 0;
                        const completedMilestones = p.milestones?.filter((m) => m.is_completed).length || 0;
                        const currentStep = totalMilestones > 0 ? completedMilestones : (p.tasks?.filter((t) => t.status === "done").length || 0);
                        const totalSteps = totalMilestones > 0 ? totalMilestones : Math.max(1, p.tasks?.length || 3);

                        return (
                          <CategoryVisualCard
                            key={p.id}
                            title={p.title}
                            currentCount={currentStep}
                            totalCount={totalSteps}
                            subtitle={p.client_name || "Direct Client"}
                            onClick={() => handleOpenDetail(p)}
                            tags={
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border capitalize ${p.status === "completed"
                                      ? "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/25"
                                      : p.status === "in_progress"
                                        ? "bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/25"
                                        : "bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/25"
                                    }`}
                                >
                                  {p.status === "in_progress" ? "In Progress" : p.status}
                                </span>
                                <span className="text-[11px] font-mono font-medium text-orange-700 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/20 dark:border-orange-500/25">
                                  {moneyShort(p.budget || 0, currency)}
                                </span>
                                {activeTab === "archive" && (
                                  <button
                                    onClick={(e) => handleRestoreProject(p.id, e)}
                                    disabled={busyId === p.id}
                                    className="text-[10px] text-accent font-semibold flex items-center gap-1 hover:underline ml-auto"
                                    title="Restore to Active"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    Restore
                                  </button>
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
        </>
      )}

    </div>
  );
}
