"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  Pencil,
  Share2,
  Link2,
  Save,
  X,
  Layers,
  Sparkles,
  Trash2,
  Check,
} from "lucide-react";
import type { CardContent, CardSettings, ReportCardData } from "@/lib/api";
import {
  CARD_TABS,
  CardTab,
  emptyContent,
  fontCssVar,
  isEmptyContent,
  starterTemplate,
  blankInspirationItem,
  blankProjectItem,
} from "./constants";
import { SettingsPopover } from "./SettingsPopover";
import { ShareDialog } from "./ShareDialog";
import { StatsPanel } from "./StatsPanel";
import {
  CompanyGrid,
  DottedDivider,
  FooterSection,
  InspirationList,
  ItemList,
  ProjectGrid,
  QuoteSection,
  SectionShell,
  WritingList,
  blankSectionItem,
  blankWritingItem,
} from "./Sections";

interface ReportCardProps {
  data: ReportCardData;
  variant: "owner" | "public";
  activeTab: CardTab;
  /** Route prefix of this card surface: /dashboard/report-card or /u/<username> */
  basePath: string;
  /** Share token forwarded to sibling pages on the public view */
  shareToken?: string | null;
  onRefresh: () => void;
  onSaveContent: (content: CardContent) => Promise<void>;
  onSaveSettings: (settings: CardSettings) => Promise<void>;
}

export function ReportCard({
  data,
  variant,
  activeTab,
  basePath,
  shareToken,
  onRefresh,
  onSaveContent,
  onSaveSettings,
}: ReportCardProps) {
  const { user: clerkUser } = useUser();
  const isOwner = variant === "owner";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CardContent>(
    data.content || emptyContent(),
  );
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [shareOpen, setShareOpen] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const draftRef = useRef<CardContent>(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Sync draft from data.content when not actively editing
  useEffect(() => {
    if (!editing) {
      setDraft(data.content || emptyContent());
      draftRef.current = data.content || emptyContent();
    }
  }, [data.content, editing]);

  const dirty = useMemo(
    () =>
      JSON.stringify(draft) !== JSON.stringify(data.content || emptyContent()),
    [draft, data.content],
  );

  // Styling travels with the share link: "include styling" off => plain theme
  const styled = isOwner || data.share?.include_styling !== false;
  const accent = styled ? data.settings?.accent || "#e7e5e4" : "var(--accent)";
  const fontFamily = styled
    ? fontCssVar(data.settings?.font || "schibsted")
    : undefined;

  const displayName =
    clerkUser?.fullName || data.full_name || data.username || "Freelancer";
  const avatarUrl = isOwner
    ? clerkUser?.imageUrl || data.avatar_url || ""
    : data.avatar_url || "";

  const tabHref = (tab: CardTab) => {
    const path = tab === "home" ? basePath : `${basePath}/${tab}`;
    if (!isOwner && shareToken)
      return `${path}?token=${encodeURIComponent(shareToken)}`;
    return path;
  };

  const setSection = <K extends keyof CardContent>(
    key: K,
    value: CardContent[K],
  ) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      draftRef.current = next;
      return next;
    });
  };

  const saveToServer = useCallback(
    async (contentToSave: CardContent, exitEditMode: boolean = false) => {
      setSaving(true);
      setSaveStatus("saving");
      try {
        await onSaveContent(contentToSave);
        setSaveStatus("saved");
        if (exitEditMode) {
          setEditing(false);
        }
        setTimeout(() => setSaveStatus("idle"), 2500);
      } catch (err) {
        console.error("Save error:", err);
        setSaveStatus("idle");
      } finally {
        setSaving(false);
      }
    },
    [onSaveContent],
  );

  const handleSaveClick = async () => {
    await saveToServer(draftRef.current, true);
  };

  // Real-time debounced auto-save (saves 1.8s after typing stops during edit)
  useEffect(() => {
    if (!editing || !dirty) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveToServer(draftRef.current, false);
      } catch (err) {
        console.error("Auto-save error:", err);
      }
    }, 1800);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [draft, editing, dirty, saveToServer]);

  // Global Ctrl + S / Cmd + S / Ctrl + Alt keyboard shortcut (VS Code style instant save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const isKeyS = e.key.toLowerCase() === "s" || e.code === "KeyS";

      // Triggers on Ctrl+S, Cmd+S, Ctrl+Alt, Ctrl+Alt+S
      if (
        (isCtrlOrCmd && isKeyS) ||
        (isCtrlOrCmd && isAlt) ||
        (isAlt && isKeyS)
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (isOwner) {
          // Cancel any pending debounce timer since we're saving immediately
          if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
            autoSaveTimeoutRef.current = null;
          }
          saveToServer(draftRef.current, false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true, passive: false });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isOwner, saveToServer]);

  const handleDiscard = () => {
    setDraft(data.content || emptyContent());
    draftRef.current = data.content || emptyContent();
    setEditing(false);
  };

  const startEditing = () => {
    const initial = data.content || emptyContent();
    setDraft(initial);
    draftRef.current = initial;
    setEditing(true);
  };

  const installTemplate = async () => {
    const template = starterTemplate();
    setDraft(template);
    draftRef.current = template;
    setEditing(true);
    await onSaveContent(template);
  };

  const clearAll = async () => {
    const blank = emptyContent();
    setDraft(blank);
    draftRef.current = blank;
    await onSaveContent(blank);
  };

  const content = editing ? draft : data.content || emptyContent();
  const showEmptyState = isOwner && !editing && isEmptyContent(data.content);

  const bio = (
    <SectionShell
      label="About"
      editing={editing && activeTab === "home"}
      addLabel="Add paragraph"
      onAdd={() =>
        setSection("bio_paragraphs", [...(content.bio_paragraphs || []), ""])
      }
    >
      {editing && activeTab === "home" ? (
        <div className="space-y-3">
          <input
            className="input-line text-sm"
            value={content.name_aka}
            placeholder="aka nickname (optional, shown next to your name)"
            onChange={(e) => setSection("name_aka", e.target.value)}
          />
          {(content.bio_paragraphs || []).map((para, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <textarea
                rows={2}
                className="input-line resize-y text-[15px] leading-relaxed"
                value={para}
                placeholder="Write a paragraph about you, your work and what you share."
                onChange={(e) =>
                  setSection(
                    "bio_paragraphs",
                    (content.bio_paragraphs || []).map((p, i) =>
                      i === idx ? e.target.value : p,
                    ),
                  )
                }
              />
              <button
                type="button"
                title="Remove paragraph"
                className="mt-2 text-faint hover:text-danger transition-colors"
                onClick={() =>
                  setSection(
                    "bio_paragraphs",
                    (content.bio_paragraphs || []).filter((_, i) => i !== idx),
                  )
                }
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {!(content.bio_paragraphs || []).length && (
            <p className="text-sm text-faint italic">
              Nothing written yet — use “Add paragraph” to introduce yourself.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {(content.bio_paragraphs || []).map((para, idx) => (
            <p key={idx} className="text-[15px] leading-relaxed text-muted">
              {para}
            </p>
          ))}
          {!showEmptyState && !(content.bio_paragraphs || []).length && (
            <p className="text-[15px] leading-relaxed text-faint italic">
              No intro written yet.
            </p>
          )}
        </div>
      )}
    </SectionShell>
  );

  const thingsSection = (
    <SectionShell
      label="Things I focus on"
      editing={editing}
      addLabel="Add focus area"
      onAdd={() =>
        setSection("things_i_do", [
          ...(content.things_i_do || []),
          blankSectionItem(),
        ])
      }
    >
      <ItemList
        items={content.things_i_do || []}
        editing={editing}
        onChange={(next) => setSection("things_i_do", next)}
      />
    </SectionShell>
  );

  const companiesSection = (
    <SectionShell
      label="Companies I've worked with"
      editing={editing}
      addLabel="Add company"
      onAdd={() =>
        setSection("companies", [
          ...(content.companies || []),
          blankSectionItem(),
        ])
      }
    >
      <CompanyGrid
        items={content.companies || []}
        editing={editing}
        onChange={(next) => setSection("companies", next)}
      />
    </SectionShell>
  );

  const workSection = (
    <SectionShell
      label="Work with me"
      editing={editing}
      addLabel="Add option"
      onAdd={() =>
        setSection("work_with_me", [
          ...(content.work_with_me || []),
          blankSectionItem(),
        ])
      }
    >
      <ItemList
        items={content.work_with_me || []}
        editing={editing}
        onChange={(next) => setSection("work_with_me", next)}
      />
    </SectionShell>
  );

  const writingSection = (
    <SectionShell
      label="Writing"
      editing={editing}
      addLabel="Add article"
      onAdd={() =>
        setSection("writings", [
          ...(content.writings || []),
          blankWritingItem(),
        ])
      }
    >
      <WritingList
        items={content.writings || []}
        editing={editing}
        onChange={(next) => setSection("writings", next)}
      />
    </SectionShell>
  );

  const inspirationSection = (
    <InspirationList
      items={
        content.inspirations && content.inspirations.length > 0
          ? content.inspirations
          : starterTemplate().inspirations || []
      }
      introParagraphs={
        content.inspiration_intro && content.inspiration_intro.length > 0
          ? content.inspiration_intro
          : starterTemplate().inspiration_intro
      }
      editing={editing}
      onAdd={() =>
        setSection("inspirations", [
          ...(content.inspirations && content.inspirations.length > 0
            ? content.inspirations
            : starterTemplate().inspirations || []),
          blankInspirationItem(),
        ])
      }
      onChange={(next) => setSection("inspirations", next)}
      onIntroChange={(nextIntro) => setSection("inspiration_intro", nextIntro)}
    />
  );

  const projectSection = (
    <ProjectGrid
      items={
        content.projects && content.projects.length > 0
          ? content.projects
          : starterTemplate().projects || []
      }
      introParagraphs={
        content.projects_intro && content.projects_intro.length > 0
          ? content.projects_intro
          : starterTemplate().projects_intro
      }
      editing={editing}
      onAdd={() =>
        setSection("projects", [
          ...(content.projects && content.projects.length > 0
            ? content.projects
            : starterTemplate().projects || []),
          blankProjectItem(),
        ])
      }
      onChange={(next) => setSection("projects", next)}
      onIntroChange={(nextIntro) => setSection("projects_intro", nextIntro)}
    />
  );

  const statsSection = (
    <StatsPanel
      accent={accent}
      currentStreak={data.current_streak || 0}
      maxStreak={data.max_streak || 0}
      activeDaysCount={data.active_days_count || 0}
      viewsCount={data.views_count || 0}
      deliveryStats={data.delivery_stats}
      heatmap={data.heatmap || []}
    />
  );

  const quoteSection = (
    <QuoteSection
      quote={content.quote}
      editing={editing}
      onChange={(next) => setSection("quote", next)}
    />
  );

  const footerSection = (
    <FooterSection
      footer={content.footer}
      displayName={displayName}
      editing={editing}
      onChange={(next) => setSection("footer", next)}
    />
  );

  return (
    <div
      className="min-h-screen bg-bg text-fg pb-10 selection:bg-accent/25"
      style={{ fontFamily }}
    >
      <div className="max-w-3xl mx-auto px-6 lg:px-0 pt-10">
        {/* Header: Clerk avatar + real name (live) + owner controls */}
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] object-cover border border-line bg-surface shrink-0"
              />
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] bg-surface border border-line flex items-center justify-center font-bold text-muted text-xs uppercase shrink-0">
                {(displayName || "?").charAt(0)}
              </div>
            )}
            <h1 className="text-[22px] sm:text-[24px] leading-tight font-medium text-fg break-words flex items-center flex-wrap gap-x-2">
              <span className="font-semibold text-fg">{displayName}</span>
              {content.name_aka ? (
                <span className="font-normal text-muted/70">
                  aka{" "}
                  <span className="font-semibold text-fg italic">
                    {content.name_aka}
                  </span>
                </span>
              ) : null}
            </h1>
          </div>

          {isOwner && (
            <div className="flex items-center gap-2 shrink-0">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={handleSaveClick}
                    disabled={saving}
                    title="Save changes to database (Ctrl+S or Ctrl+Alt)"
                    className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hi transition-all cursor-pointer shadow-xs disabled:opacity-70"
                  >
                    {saveStatus === "saved" ? (
                      <Check className="w-4 h-4 text-emerald-300" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saveStatus === "saving" ? (
                      "Saving..."
                    ) : saveStatus === "saved" ? (
                      "Saved"
                    ) : (
                      <>
                        Save <span className="text-[10px] opacity-75 font-mono">Ctrl+Alt</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-surface border border-line text-fg text-xs font-semibold hover:border-line-strong transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-surface border border-line hover:border-line-strong text-fg text-xs font-semibold transition-all cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
              )}

              <button
                type="button"
                onClick={() => setShareOpen(true)}
                title={
                  data.share?.is_shared
                    ? "Share link active (click to copy or manage)"
                    : "Share report card"
                }
                className={`w-10 h-10 rounded-xl bg-surface border hover:border-line-strong flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  data.share?.is_shared
                    ? "border-accent/50 text-accent"
                    : "border-line text-fg"
                }`}
              >
                {data.share?.is_shared ? (
                  <Link2 className="w-4 h-4 text-accent" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </button>

              <SettingsPopover
                settings={
                  data.settings || { font: "schibsted", accent: "#e7e5e4" }
                }
                onChange={(next) => onSaveSettings(next)}
              />
            </div>
          )}
        </header>

        {/* Page navigation — each entry is a real route */}
        <nav className="mt-5 flex items-center gap-5 text-[15px]">
          {CARD_TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <Link
                key={tab.id}
                href={tabHref(tab.id)}
                className={
                  active
                    ? "text-fg font-medium border-b border-dotted border-fg/60 pb-0.5"
                    : "text-muted hover:text-fg transition-colors"
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Empty state for a brand-new account */}
        {showEmptyState && (
          <div className="mt-10 rounded-2xl border border-dashed border-line-strong bg-card/40 p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-surface border border-line flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-base font-semibold text-fg">
              Your report card is empty
            </h2>
            <p className="text-sm text-muted mt-1.5 max-w-md mx-auto leading-relaxed">
              Nothing is pre-filled. Install the starter layout and edit it, or
              write every section yourself — then hit Share to publish a public
              link.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-surface border border-line hover:border-line-strong text-fg text-xs font-semibold transition-all"
              >
                <Pencil className="w-4 h-4" />
                Start writing
              </button>
              <button
                type="button"
                onClick={installTemplate}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-accent hover:bg-accent-hi text-accent-fg text-xs font-semibold transition-all"
              >
                <Layers className="w-4 h-4" />
                Install template
              </button>
            </div>
          </div>
        )}

        {/* Page bodies */}
        {activeTab === "home" && !showEmptyState && (
          <>
            {bio}
            <DottedDivider />
            {thingsSection}
            <DottedDivider />
            {companiesSection}
            <DottedDivider />
            {workSection}
            <DottedDivider />
            {statsSection}
            <DottedDivider />
            {quoteSection}
          </>
        )}

        {activeTab === "inspiration" && inspirationSection}

        {activeTab === "projects" && projectSection}

        {activeTab === "sponsor" && (
          <>
            {workSection}
            <DottedDivider />
            {bio}
          </>
        )}

        {/* Footer (100% editable real-time signature & attribution) */}
        {footerSection}
      </div>

      {isOwner && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          share={data.share}
          username={data.username}
          fullName={displayName}
          onShareChanged={onRefresh}
        />
      )}
    </div>
  );
}
