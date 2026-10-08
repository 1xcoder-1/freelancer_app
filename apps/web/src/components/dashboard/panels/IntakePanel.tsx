"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileText,
  ClipboardCheck,
  MessageSquare,
  Layers,
  Sparkles,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/patterns";
import { getIntakeForms, type IntakeForm } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
import { CategoryVisualCard, ChaiCupIcon } from "@/components/dashboard/CategoryVisualCard";

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

  const totalForms = forms.length;
  const activeForms = forms.filter((f) => f.status !== "archived").length;
  const totalSubmissions = forms.reduce((sum, f) => sum + (f.submissions_count || 0), 0);
  const categoriesCount = categoriesPresent.length;

  return (
    <div className="space-y-6">
      {/* 4 Headline Cards at the top matching Dashboard, Leads & Clients */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 enter-stagger">
        {loading && forms.length === 0 ? (
          <>
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
            <Skeleton className="h-[180px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
          </>
        ) : (
          <>
            <StatCard
              label="Total Questionnaires"
              value={totalForms}
              icon={FileText}
              rows={[
                {
                  text: `${activeForms} Active · ${totalForms - activeForms} Drafts`,
                  dot: "info",
                },
              ]}
            />
            <StatCard
              label="Active Flows"
              value={activeForms}
              icon={ClipboardCheck}
              rows={[
                {
                  text: activeForms > 0 ? `${activeForms} Published Live` : "No Active Flows",
                  dot: activeForms > 0 ? "ok" : "info",
                },
              ]}
            />
            <StatCard
              label="Responses"
              value={totalSubmissions}
              icon={MessageSquare}
              rows={[
                {
                  text: totalSubmissions > 0 ? `${totalSubmissions} Client Answers` : "No Responses Yet",
                  dot: totalSubmissions > 0 ? "ok" : "info",
                },
              ]}
            />
            <StatCard
              label="Categories"
              value={categoriesCount}
              icon={Layers}
              rows={[
                {
                  text: `${categoriesCount} Flow Groups`,
                  dot: "info",
                },
              ]}
            />
          </>
        )}
      </div>

      {/* Action Controls Row matching Clients & Leads layout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-2">
          <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
            {totalForms} Total Questionnaire{totalForms === 1 ? "" : "s"}
          </Badge>
          <span className="text-xs font-mono text-muted hidden sm:inline">
            across {categoriesCount} categor{categoriesCount === 1 ? "y" : "ies"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchForms(true)}
            disabled={loading}
            className="rounded-xl bg-card border-line text-fg w-9 h-9 p-0 flex items-center justify-center shrink-0 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenCreate()}
            className="rounded-xl bg-accent hover:bg-accent-hi text-accent-fg font-medium text-xs px-4 h-9 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Questionnaire
          </Button>
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
            className="mt-6 bg-accent hover:bg-accent-hi text-accent-fg font-semibold rounded-xl"
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
                <div className="flex items-center justify-between gap-4 pb-2 border-b border-line/60">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-lg font-medium text-fg flex items-center gap-2">
                      <span>{cat}</span>
                      <span className="text-xs font-mono font-normal text-muted">
                        ({catForms.length})
                      </span>
                    </h3>
                  </div>

                  {/* Pagination Controls (if > 20 cards) */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted">
                        Page {currentPage} of {totalPages}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePrevPage}
                          disabled={currentPage === 1}
                          className="h-7 w-7 p-0 rounded-lg border-line"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNextPage}
                          disabled={currentPage === totalPages}
                          className="h-7 w-7 p-0 rounded-lg border-line"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cards Grid with Category Visual Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 stagger-grid">
                  {visibleForms.map((form) => {
                    const qCount = Array.isArray(form.questions) ? form.questions.length : 0;
                    const subCount = form.submissions_count || 0;

                    return (
                      <div
                        key={form.id}
                        onClick={() => handleOpenDetail(form)}
                        className="cursor-pointer group block"
                      >
                        <CategoryVisualCard
                          title={form.title}
                          currentCount={subCount}
                          totalCount={qCount}
                          subtitle={`${subCount} submission${subCount === 1 ? "" : "s"}`}
                          category={cat}
                          tags={
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
                                {form.status || "active"}
                              </span>
                              <span className="text-[11px] font-mono font-medium text-orange-400 bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/25">
                                {qCount} Questions
                              </span>
                            </div>
                          }
                        />
                      </div>
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
