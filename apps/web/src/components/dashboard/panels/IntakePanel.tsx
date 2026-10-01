"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getIntakeForms, type IntakeForm } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
import { CategoryVisualCard, ChaiCupIcon } from "@/components/dashboard/CategoryVisualCard";

const DEFAULT_CATEGORIES = [
  "Featured",
  "Client Onboarding",
  "Project Discovery",
  "Feedback & Reviews",
  "Design Sprints",
];

const CARDS_PER_PAGE = 20;

export function IntakePanel() {
  const router = useRouter();
  const [catPages, setCatPages] = useState<Record<string, number>>({});

  const { data: formsData, loading, refresh: fetchForms } = useApiData<IntakeForm[]>(
    "intake:forms",
    async (token) => {
      return await getIntakeForms(token);
    },
    { reportContext: "intake" }
  );

  const forms = formsData ?? [];

  const getFormCategory = (f: IntakeForm): string => {
    if (!f) return "Featured";
    if (f.description && typeof f.description === "string") {
      const match = f.description.match(/\[category:\s*([^\]]+)\]/i);
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
    router.push("/dashboard/intake/new");
  };

  const handleOpenDetail = (form: IntakeForm) => {
    router.push(`/dashboard/intake/${form.id}`);
  };

  // Group forms by category (only categories that actually contain forms)
  const categoriesPresent = Array.from(
    new Set(
      forms
        .map((f) => getFormCategory(f))
        .filter((cat) => Boolean(cat) && typeof cat === "string" && cat !== "[object Object]")
    )
  );
  if (categoriesPresent.length === 0 && forms.length > 0) {
    categoriesPresent.push("Featured");
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 no-scrollbar">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
              Intake Questionnaires
            </h2>
            <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
              {loading ? "Loading..." : `${forms.length} Total`}
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Categorized intake flows to collect project scope, goals, and assets from clients.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchForms(true)}
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
              <span>Add Questionnaire</span>
            </span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && forms.length === 0 ? (
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
      ) : forms.length === 0 ? (
        <Card className="bg-card border-dashed border-line p-12 text-center rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
            <ChaiCupIcon className="w-7 h-7" />
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">No questionnaires yet</h3>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">
            Build customized client questionnaires to collect requirements before kicking off projects.
          </p>
          <Button
            onClick={() => handleOpenCreate()}
            className="mt-6 bg-accent hover:bg-accent-hi text-accent-fg font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create First Questionnaire
          </Button>
        </Card>
      ) : (
        /* Categorized Cards with Sliding Pagination (20 cards per page) */
        <div className="space-y-10">
          {categoriesPresent.map((cat) => {
            const catForms = forms.filter((f) => getFormCategory(f) === cat);
            if (catForms.length === 0) return null;

            const totalPages = Math.ceil(catForms.length / CARDS_PER_PAGE);
            const currentPage = Math.min(catPages[cat] || 1, totalPages || 1);
            const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
            const endIndex = Math.min(startIndex + CARDS_PER_PAGE, catForms.length);
            const visibleForms = catForms.slice(startIndex, endIndex);

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
                        Showing <strong className="text-fg">{startIndex + 1}–{endIndex}</strong> of {catForms.length}
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
                  {visibleForms.map((form) => {
                    const questionsList = Array.isArray(form.questions) ? form.questions : [];
                    const submissionsCount = form.submissions_count || 0;

                    return (
                      <CategoryVisualCard
                        key={form.id}
                        title={form.title}
                        currentCount={submissionsCount}
                        totalCount={questionsList.length || 1}
                        subtitle={`By ${cat}`}
                        category={cat}
                        onClick={() => handleOpenDetail(form)}
                        tags={
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/25 capitalize">
                              {cat}
                            </span>
                            <span className="text-[11px] font-mono font-medium text-orange-700 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/20 dark:border-orange-500/25">
                              {questionsList.length} Question{questionsList.length === 1 ? "" : "s"}
                            </span>
                            {submissionsCount > 0 && (
                              <span className="text-[11px] font-mono font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/20 dark:border-emerald-500/25">
                                {submissionsCount} Answer{submissionsCount === 1 ? "" : "s"}
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
