"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  User,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";
import { StatCard } from "@/components/dashboard/patterns";
import { CardLoadError } from "./States";
import { ShareDialog } from "./ShareDialog";
import { useOwnerReportCard } from "./hooks";
import {
  PROFILE_TEMPLATES,
  emptyContent,
  isGeneratedUserId,
  resolveProfileTemplate,
  type TemplateChrome,
} from "./constants";
import type { CardContent, ReportCardData } from "@/lib/api";
import { logHandledError } from "@/lib/log-error";
import { usePlanCapacity } from "@/components/dashboard/PlanLimit";

const SERIF = "Georgia, 'Times New Roman', serif";

/** Miniature of the classic design (modern, sleek, follows the app theme). */
function ClassicMini() {
  return (
    <div className="h-full w-full bg-[#101114] p-5 flex flex-col justify-between select-none relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top Header Mockup */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-white/20 to-white/5 border border-white/15 flex items-center justify-center text-[10px] font-bold text-white shadow-inner">
              RC
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#101114]" />
          </div>
          <div className="space-y-1">
            <div className="h-2 w-20 rounded bg-white/70" />
            <div className="h-1.5 w-12 rounded bg-white/30" />
          </div>
        </div>
        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
          Live
        </span>
      </div>

      {/* Focus / Skills Row */}
      <div className="space-y-1.5 pt-1">
        <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-white/40">
          Core Focus
        </p>
        <div className="flex flex-wrap gap-1">
          {["Product Design", "Web Apps", "Systems"].map((skill) => (
            <span
              key={skill}
              className="text-[8.5px] px-1.5 py-0.5 rounded bg-white/10 text-white/80 border border-white/10"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Mini project card mockup */}
      <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5 flex items-center justify-between">
        <div className="space-y-1 flex-1">
          <div className="h-1.5 w-24 rounded bg-white/50" />
          <div className="h-1 w-16 rounded bg-white/25" />
        </div>
        <div className="flex gap-1.5">
          {["#ea6311", "#10b981", "#6366f1"].map((c) => (
            <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Miniature of the folio design (ink-and-paper editorial aesthetic). */
function FolioMini() {
  return (
    <div
      className="h-full w-full p-5 flex flex-col justify-between select-none relative overflow-hidden"
      style={{ background: "#F4F1EA" }}
    >
      {/* Top Editorial Masthead */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-medium leading-none" style={{ fontFamily: SERIF, color: "#211D15" }}>
            A. Freelancer
          </p>
          <span
            className="text-[9px] italic"
            style={{ fontFamily: SERIF, color: "#6E6656" }}
          >
            Editorial Folio
          </span>
        </div>
        <span aria-hidden className="block h-px w-full mt-2" style={{ background: "#D8D0BE" }} />
      </div>

      {/* Story / Experience Snippet */}
      <div className="space-y-2">
        <p className="text-[9px] italic" style={{ fontFamily: SERIF, color: "#6E6656" }}>
          Selected Works & Craft
        </p>
        <div className="space-y-1.5">
          <div className="h-1.5 w-4/5 rounded-sm" style={{ background: "#C8BFA9" }} />
          <div className="h-1.5 w-3/5 rounded-sm" style={{ background: "#D6CFBC" }} />
        </div>
      </div>

      {/* Stamped Seals */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          <span
            className="px-2 py-0.5 rounded border text-[8px] font-semibold"
            style={{
              fontFamily: SERIF,
              color: "#211D15",
              borderColor: "#B9AE93",
              background: "#FFFDF8",
              transform: "rotate(-2deg)",
            }}
          >
            Certified
          </span>
          <span
            className="px-2 py-0.5 rounded border text-[8px] font-semibold"
            style={{
              fontFamily: SERIF,
              color: "#211D15",
              borderColor: "#B9AE93",
              background: "#FFFDF8",
              transform: "rotate(1.5deg)",
            }}
          >
            2025 Ed.
          </span>
        </div>
        <span className="text-[8px] italic" style={{ fontFamily: SERIF, color: "#8C8372" }}>
          — Signed
        </span>
      </div>
    </div>
  );
}

function TemplateMini({ chrome }: { chrome: TemplateChrome }) {
  return chrome === "folio" ? <FolioMini /> : <ClassicMini />;
}

/**
 * Portfolio overview — the dashboard root for the report card.
 */
export function PortfolioOverview() {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { data, loading, error, refresh, saveContent, saveSettings } =
    useOwnerReportCard();
  const capacity = usePlanCapacity("portfolios");
  const [creating, setCreating] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  if (loading) {
    return (
      <div className="space-y-6 enter-stagger animate-in fade-in duration-300">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[145px] w-full rounded-2xl bg-[#141518] border border-[#26272d]" />
          ))}
        </div>
        <Skeleton className="h-[210px] w-full rounded-2xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <CardLoadError
        message={error || "Your portfolio could not be loaded from the server."}
        onRetry={() => void refresh()}
      />
    );
  }

  const content: CardContent | undefined = data.content;
  const initialized = Boolean(content?.initialized);

  // Extract human-friendly name and clean handle to avoid exposing raw Clerk IDs (e.g. User_3lht...)
  const rawFirst = clerkUser?.firstName || clerkUser?.fullName?.split(" ")[0] || data.full_name?.split(" ")[0] || "";
  const cleanFirstName = isGeneratedUserId(rawFirst) ? null : rawFirst;

  const rawUsername = clerkUser?.username || data.username || "";
  const cleanSubtitle = isGeneratedUserId(rawUsername)
    ? (clerkUser?.fullName && !isGeneratedUserId(clerkUser.fullName) ? clerkUser.fullName : "Personal Portfolio")
    : `@${rawUsername}`;

  const template = resolveProfileTemplate(data.settings?.theme);

  if (showPicker) {
    return (
      <NewPortfolioPicker
        data={data}
        cleanFirstName={cleanFirstName}
        currentTemplateId={template.id}
        initialized={initialized}
        creating={creating}
        onBack={() => setShowPicker(false)}
        onCreate={(tplId) => void applyTemplate(tplId, data)}
      />
    );
  }

  const isLive = Boolean(data.share?.is_shared);
  const publicUrl = data.username ? `/u/${data.username}` : null;

  const filledSections = [
    content?.bio_paragraphs?.length,
    content?.things_i_do?.length,
    content?.companies?.length,
    content?.work_with_me?.length,
    content?.writings?.length,
    content?.inspirations?.length,
    content?.projects?.length,
    content?.experience?.length,
    content?.certificates?.length,
    content?.quote?.text,
    content?.footer?.signature_name,
  ].filter((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim()))).length;

  return (
    <div className="space-y-6 enter-stagger animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <StatCard
          label="Status"
          value={initialized ? (isLive ? "Live" : "Draft") : "Draft"}
          icon={Globe}
          className="min-h-[145px] p-5"
          rows={[
            initialized
              ? isLive && publicUrl
                ? { text: publicUrl, href: publicUrl, dot: "ok" as const }
                : { text: "Not published", dot: "warn" as const }
              : { text: "Not created yet", dot: "warn" as const },
          ]}
        />
        <StatCard
          label="Template"
          value={initialized ? template.label : "None"}
          icon={Sparkles}
          className="min-h-[145px] p-5"
          rows={[
            {
              text: initialized
                ? template.chrome === "folio"
                  ? "Ink & paper"
                  : "App theme"
                : "Select a design",
              dot: "info" as const,
            },
          ]}
        />
        <StatCard
          label="Sections"
          value={initialized ? filledSections : 0}
          icon={Layers}
          className="min-h-[145px] p-5"
          rows={[{ text: `of 11 filled`, dot: "info" as const }]}
        />
        <StatCard
          label={capacity.label || "Portfolios"}
          value={capacity.used}
          icon={User}
          className="min-h-[145px] p-5"
          rows={[
            {
              text: initialized ? "One per plan" : "1 slot available",
              dot: "ok" as const,
            },
          ]}
        />
      </div>

      {/* Roster header with actions */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <h2 className="text-sm font-medium text-fg">Your portfolio</h2>
        {initialized ? (
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPicker(true)}
              className="rounded-xl border border-line bg-card hover:bg-surface text-fg font-medium shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-accent" /> Change design
            </Button>
            <Button
              size="sm"
              onClick={() => router.push("/dashboard/report-card/home")}
              className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Edit portfolio
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => setShowPicker(true)}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Create portfolio
          </Button>
        )}
      </div>

      {initialized ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
          <CategoryVisualCard
            hidePrefix
            title="Portfolio"
            subtitle={cleanSubtitle}
            onClick={() => router.push("/dashboard/report-card/home")}
            icon={<Sparkles className="w-4 h-4 text-accent" />}
            topRightContent={
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <span
                  className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border capitalize ${
                    isLive
                      ? "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/25"
                      : "bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/25"
                  }`}
                >
                  {isLive ? "Live" : "Draft"}
                </span>
                {isLive && publicUrl && (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 rounded-lg border border-line bg-surface/60 dark:bg-white/5 flex items-center justify-center text-muted hover:text-fg hover:border-line-strong transition-colors cursor-pointer"
                    title="Open public page"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            }
            tags={
              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  title="Click to change template style"
                  className="text-[11px] font-mono font-medium text-orange-700 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/15 hover:bg-orange-500/20 px-2.5 py-0.5 rounded-full border border-orange-500/20 dark:border-orange-500/25 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>{template.label}</span>
                  <span className="text-[10px] text-orange-600/80 dark:text-orange-300/80 font-sans">· Switch style</span>
                </button>
                {!isLive && (
                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    className="text-[11px] font-mono font-medium text-accent bg-accent-soft px-2.5 py-0.5 rounded-full border border-accent/30 hover:border-accent/60 transition-colors cursor-pointer"
                  >
                    Publish
                  </button>
                )}
              </div>
            }
          />
        </div>
      ) : (
        <Card className="rounded-2xl border-dashed border-line bg-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
            <Globe className="w-7 h-7 text-accent" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            No portfolio yet
          </h2>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">
            Pick a design, showcase your experience and certificates, and share
            your story — all hosted on your custom personal portfolio.
          </p>
          <Button
            size="sm"
            onClick={() => setShowPicker(true)}
            className="mt-6 inline-flex bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Create portfolio
          </Button>
        </Card>
      )}

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        share={data.share}
        username={data.username}
        onShareChanged={refresh}
      />
    </div>
  );

  async function applyTemplate(tplId: string, card: ReportCardData) {
    setCreating(tplId);
    try {
      // PRESERVE ALL USER DATA: do not reset with emptyContent!
      const existing = card.content || emptyContent();
      if (!existing.initialized) {
        await saveContent({ ...existing, initialized: true });
      }
      await saveSettings({
        ...(card.settings || { font: "schibsted", accent: "#e7e5e4" }),
        theme: tplId,
      });
      toast.success(initialized ? "Template style switched" : "Portfolio created");
      setShowPicker(false);
      await refresh();
      router.push("/dashboard/report-card/home");
    } catch (err) {
      logHandledError("Update template failed:", err);
      toast.error("Could not update template. Please try again.");
      setCreating(null);
    }
  }
}

/** New Portfolio screen: high-polish template selector. */
function NewPortfolioPicker({
  data,
  cleanFirstName,
  currentTemplateId,
  initialized,
  creating,
  onBack,
  onCreate,
}: {
  data: ReportCardData;
  cleanFirstName: string | null;
  currentTemplateId?: string;
  initialized?: boolean;
  creating: string | null;
  onBack: () => void;
  onCreate: (tplId: string) => void;
}) {
  return (
    <div className="max-w-5xl mx-auto py-2 enter-stagger animate-in fade-in duration-300">
      {/* Top Bar with back action & studio badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-card hover:bg-surface text-muted hover:text-fg text-xs font-medium transition-all shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to overview</span>
        </Button>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-medium uppercase tracking-wider bg-accent-soft text-accent border border-accent/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Design Studio</span>
        </div>
      </div>

      {/* Hero Header */}
      <div className="pb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-fg leading-tight">
          {initialized
            ? "Change portfolio design"
            : cleanFirstName
              ? `Pick a design, ${cleanFirstName}`
              : "Pick a design for your portfolio"}
        </h1>
        <p className="mt-2.5 text-sm sm:text-base text-muted leading-relaxed max-w-2xl">
          {initialized
            ? "Switch your visual style anytime. All your sections, bio, experience, projects, and certificates stay 100% saved and automatically adapt to the new design."
            : "Choose a signature aesthetic for your personal profile. Every design is fully responsive, SEO-optimized, and adapts seamlessly as you customize your content."}
        </p>
      </div>

      {/* High-polish template cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PROFILE_TEMPLATES.map((tpl) => {
          const busy = creating === tpl.id;
          const isFolio = tpl.chrome === "folio";
          const isCurrent = Boolean(initialized && currentTemplateId === tpl.id);

          return (
            <div
              key={tpl.id}
              className={`group relative flex flex-col rounded-3xl border transition-all duration-300 overflow-hidden ${
                isCurrent
                  ? "border-accent ring-2 ring-accent/30 shadow-xl bg-card"
                  : "border-line bg-card hover:border-accent/60 hover:shadow-2xl hover:shadow-black/20"
              }`}
            >
              {/* Template miniature preview area */}
              <div className="h-56 relative border-b border-line bg-[#0c0d10] overflow-hidden flex items-center justify-center p-3">
                <div className="w-full h-full rounded-xl overflow-hidden shadow-md border border-white/5 transition-transform duration-300 group-hover:scale-[1.015]">
                  <TemplateMini chrome={tpl.chrome} />
                </div>
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                  {isCurrent && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 backdrop-blur-md shadow-sm flex items-center gap-1">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-black/60 backdrop-blur-md text-white border border-white/10 shadow-sm">
                    {isFolio ? "Editorial Serif" : "Theme Native"}
                  </span>
                </div>
              </div>

              {/* Template card content */}
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-fg tracking-tight group-hover:text-accent transition-colors">
                      {tpl.label}
                    </h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-surface border border-line text-muted">
                      {isFolio ? "Publication" : "Modern"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs sm:text-[13px] text-muted leading-relaxed">
                    {tpl.blurb}
                  </p>

                  {/* Feature tags */}
                  <div className="flex flex-wrap gap-1.5 pt-3">
                    {isFolio ? (
                      <>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface text-muted border border-line">
                          Warm paper texture
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface text-muted border border-line">
                          Editorial serif fonts
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface text-muted border border-line">
                          Stamped seals
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface text-muted border border-line">
                          App theme synced
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface text-muted border border-line">
                          High contrast
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface text-muted border border-line">
                          Developer focused
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Primary CTA button */}
                <Button
                  type="button"
                  disabled={creating !== null || isCurrent}
                  onClick={() => onCreate(tpl.id)}
                  className={`w-full mt-2 font-semibold shadow-sm transition-all flex items-center justify-center gap-2 ${
                    isCurrent
                      ? "bg-surface border border-line text-muted cursor-default hover:bg-surface"
                      : "bg-accent hover:bg-accent-hi text-accent-fg group-hover:scale-[1.01]"
                  }`}
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                      <span>{initialized ? "Updating style..." : "Creating portfolio..."}</span>
                    </>
                  ) : isCurrent ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Current active design</span>
                    </>
                  ) : (
                    <>
                      <span>{initialized ? `Switch to ${tpl.label}` : `Use ${tpl.label} design`}</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reassurance footer */}
      <div className="mt-8 pt-5 border-t border-dashed border-line flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent shrink-0" />
          <span>Switching designs preserves all your data — bio, work, projects, and certificates are kept automatically.</span>
        </div>
        <span className="font-mono text-[11px] text-faint">Instant live deployment</span>
      </div>
    </div>
  );
}
