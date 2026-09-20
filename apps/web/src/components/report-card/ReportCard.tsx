"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  Pencil,
  Share2,
  Save,
  X,
  Layers,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { CardContent, CardSettings, ReportCardData } from "@/lib/api";
import {
  CARD_TABS,
  CardTab,
  emptyContent,
  fontCssVar,
  isEmptyContent,
  starterTemplate,
} from "./constants";
import { SettingsPopover } from "./SettingsPopover";
import { ShareDialog } from "./ShareDialog";
import { StatsPanel } from "./StatsPanel";
import {
  CompanyGrid,
  DottedDivider,
  ItemList,
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
  const [shareOpen, setShareOpen] = useState(false);

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
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveContent(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraft(data.content || emptyContent());
    setEditing(false);
  };

  // The draft is only ever read while editing, so it is seeded from the server
  // content at the moment editing starts (event handler, no render-time sync).
  const startEditing = () => {
    setDraft(data.content || emptyContent());
    setEditing(true);
  };

  const installTemplate = async () => {
    const template = starterTemplate();
    setDraft(template);
    setEditing(true);
    await onSaveContent(template);
  };

  const clearAll = async () => {
    const blank = emptyContent();
    setDraft(blank);
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
      label="Things I do"
      editing={editing}
      addLabel="Add thing"
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

  return (
    <div
      className="min-h-screen bg-bg text-fg pb-24 selection:bg-accent/25"
      style={{ fontFamily }}
    >
      <div className="max-w-3xl mx-auto px-6 lg:px-0 pt-10">
        {/* Header: Clerk avatar + real name (live) + owner controls */}
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-10 h-10 rounded-lg object-cover border border-line shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-surface border border-line flex items-center justify-center font-bold text-muted uppercase shrink-0">
                {(displayName || "?").charAt(0)}
              </div>
            )}
            <h1 className="text-[26px] leading-tight font-semibold text-fg truncate">
              {displayName}
              {content.name_aka ? (
                <span className="text-muted font-normal italic">
                  {" "}
                  aka <span className="italic">{content.name_aka}</span>
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
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hi transition-all disabled:opacity-40"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : dirty ? "Save" : "Saved"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-surface border border-line text-fg text-xs font-semibold hover:border-line-strong transition-all"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    title="Clear everything and start from scratch"
                    className="inline-flex items-center h-10 px-3 rounded-xl bg-surface border border-line text-danger text-xs font-semibold hover:border-danger/40 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-surface border border-line hover:border-line-strong text-fg text-xs font-semibold transition-all"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
              )}

              <button
                type="button"
                onClick={() => setShareOpen(true)}
                title="Share report card"
                className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-surface border border-line hover:border-line-strong text-fg text-xs font-semibold transition-all"
              >
                <Share2 className="w-4 h-4" />
                Share
                {data.share?.is_shared && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-ok"
                    title="Link is live"
                  />
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
            {statsSection}
          </>
        )}

        {activeTab === "inspiration" && (
          <>
            {companiesSection}
            <DottedDivider />
            {thingsSection}
          </>
        )}

        {activeTab === "blog" && writingSection}

        {activeTab === "sponsor" && (
          <>
            {workSection}
            <DottedDivider />
            {bio}
          </>
        )}

        {/* Footer (reference design) */}
        <DottedDivider />
        <footer className="pt-10 text-center space-y-1.5">
          <p
            className="text-2xl italic text-fg/80"
            style={{ fontFamily: "var(--font-schibsted)" }}
          >
            {(displayName || "").split(" ")[0]}
          </p>
          <p className="text-[13px] text-muted">
            Built by yours truly
            {content.things_i_do?.[0]?.link ? (
              <>
                {" — "}
                <a
                  href={content.things_i_do[0].link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-fg underline decoration-dotted underline-offset-4 hover:text-accent"
                >
                  see my work
                </a>
              </>
            ) : null}
            {isOwner ? (
              <>
                {" · "}
                <Link
                  href={tabHref("sponsor")}
                  className="text-fg underline decoration-dotted underline-offset-4 hover:text-accent"
                >
                  work with me
                </Link>
              </>
            ) : null}
          </p>
          <p className="text-[12px] text-faint">
            Report card powered by{" "}
            <Link
              href="/"
              className="text-fg underline decoration-dotted underline-offset-4 hover:text-accent"
            >
              Freelance Book
            </Link>
          </p>
        </footer>
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
