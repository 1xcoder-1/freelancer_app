"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  ArrowDown,
  Heading,
  Loader2,
  Palette,
  GripVertical,
} from "lucide-react";
import {
  ArrowLeft,
  ArrowUp,
  Plus,
  Trash2,
  ExternalLink,
  Eye,
  Link2,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createLinkPage,
  updateLinkPage,
  replaceMyLinkPageItems,
  createLinkPagePreviewToken,
  type LinkPage,
  type LinkPageItemInput,
} from "@/lib/api";
import { useLivePreviewPublisher, type PreviewPageState } from "@/hooks/use-live-preview";
import { invalidateCache } from "@/hooks/use-api-data";
import { LINK_TEMPLATES, DEFAULT_BACKGROUND_OVERLAY, itemRole, isSocialItem } from "@/components/link-page/templates";
import { ThemePreviewCard } from "@/components/link-page/ThemePreviewCard";
import { celebrate } from "@/components/common/Celebration";
import { AvatarUploader } from "@/components/link-page/AvatarUploader";
import { BackgroundUploader } from "@/components/link-page/BackgroundUploader";
import { StockPhotoPicker } from "@/components/link-page/StockPhotoPicker";
import {
  PLATFORM_PRESETS,
  PlatformIconRenderer,
  detectPlatformFromUrl,
  type PlatformPreset,
} from "@/components/link-page/PlatformIcons";
import { logHandledError } from "@/lib/log-error";

const SLUG_RE = /^[a-z0-9][a-z0-9.\-]{0,62}[a-z0-9]$/;

interface DraftItem {
  key: string;
  label: string;
  url: string;
  icon: string;
  description: string;
  active: boolean;
  showDetails?: boolean;
  isHeading?: boolean;
  /** Owner's render choice for platform links: "icon" (round social row) or "card" (full bar). */
  display?: "icon" | "card";
}

const EMPTY_LINK_ITEM: Omit<DraftItem, "key"> = {
  label: "",
  url: "",
  icon: "globe",
  description: "",
  active: true,
  showDetails: false,
  isHeading: false,
};

const EMPTY_HEADING_ITEM: Omit<DraftItem, "key"> = {
  label: "Section Title",
  url: "https://#header",
  icon: "heading",
  description: "",
  active: true,
  showDetails: false,
  isHeading: true,
};

function newKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeUrl(v: string): string {
  const t = v.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^mailto:/i.test(t)) return t;
  return `https://${t}`;
}

function guessSlug(): string {
  if (typeof window === "undefined") return "my-links";
  const guess = window.location.hostname.replace(/\W+/g, "-");
  return guess ? `${guess}-links`.slice(0, 60) : "my-links";
}

export function LinkPageBuilder({ mode, page }: { mode: "new" | "edit"; page?: LinkPage }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const { publish } = useLivePreviewPublisher(page?.id);

  // Navigation tab: "links" | "appearance"
  const [activeTab, setActiveTab] = useState<"links" | "appearance">("links");

  // Profile fields
  const [displayName, setDisplayName] = useState(page?.display_name ?? page?.name ?? "");
  const [slug, setSlug] = useState(page?.slug ?? guessSlug());
  const [headline, setHeadline] = useState(page?.headline ?? "");
  const [bio, setBio] = useState(page?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(page?.avatar_url ?? "");
  const [template, setTemplate] = useState<string>(page?.template ?? "paper");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(page?.background_image_url ?? "");
  const [backgroundOverlay, setBackgroundOverlay] = useState<number>(
    page?.background_overlay ?? DEFAULT_BACKGROUND_OVERLAY
  );
  const [published, setPublished] = useState(page?.published ?? false);

  // Active icon picker key for the specific card
  const [pickingIconKey, setPickingIconKey] = useState<string | null>(null);

  // Items
  const [items, setItems] = useState<DraftItem[]>(
    page?.items.map((i) => {
      const heading = itemRole(i) === "header";
      return {
        key: i.id,
        label: i.label,
        url: i.url,
        icon: i.icon ?? (heading ? "heading" : "globe"),
        description: i.description ?? "",
        active: i.active !== false,
        showDetails: Boolean(i.icon || i.description),
        isHeading: heading,
        display: i.display === "icon" || i.display === "card" ? i.display : undefined,
      };
    }) ?? []
  );
  const [saving, setSaving] = useState(false);

  const updateItem = (key: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const removeItem = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key));

  const moveItem = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handlePickPlatform = (key: string, preset: PlatformPreset) => {
    const currentItem = items.find((i) => i.key === key);
    const isPlaceholderTitle =
      !currentItem?.label ||
      currentItem.label.startsWith("Title") ||
      currentItem.label === "Link title" ||
      PLATFORM_PRESETS.some((p) => p.name === currentItem.label);

    updateItem(key, {
      icon: preset.icon,
      label: isPlaceholderTitle ? preset.name : currentItem.label,
    });
    setPickingIconKey(null);
  };

  const handleUrlChange = (key: string, newUrl: string) => {
    const currentItem = items.find((i) => i.key === key);
    const detected = detectPlatformFromUrl(newUrl);

    if (detected) {
      const isPlaceholderTitle =
        !currentItem?.label ||
        currentItem.label.startsWith("Title") ||
        currentItem.label === "Link title" ||
        PLATFORM_PRESETS.some((p) => p.name === currentItem.label);

      updateItem(key, {
        url: newUrl,
        icon: detected.icon,
        label: isPlaceholderTitle ? detected.name : currentItem?.label,
      });
    } else {
      updateItem(key, { url: newUrl });
    }
  };

  const validate = (): string | null => {
    if (!displayName.trim()) return "Please enter your profile display name in Appearance.";
    if (!SLUG_RE.test(slug.trim().toLowerCase()))
      return "URL handle must be 2-64 chars: lowercase letters, numbers, hyphens or dots.";
    for (const it of items) {
      if (!it.label.trim()) return "Every link or section heading needs a title.";
      if (!it.isHeading) {
        const norm = normalizeUrl(it.url);
        if (!/^https?:\/\/.+/.test(norm) && !/^mailto:.+/.test(norm)) {
          return `Link "${it.label}" needs a valid URL (e.g. https://...).`;
        }
      }
    }
    if (published && items.filter((i) => i.active).length === 0)
      return "Add at least one active link before publishing.";
    return null;
  };

  const invalidateLinkCaches = () => {
    invalidateCache("linkpage:my");
    invalidateCache("linkpage:stats:7");
    invalidateCache("linkpage:stats:30");
    invalidateCache("linkpage:stats:90");
    if (page?.id) {
      invalidateCache(`linkpage:stats:${page.id}:7`);
      invalidateCache(`linkpage:stats:${page.id}:30`);
      invalidateCache(`linkpage:stats:${page.id}:90`);
    }
  };

  const persist = async (nextPublished: boolean): Promise<string | null> => {
    const err = validate();
    if (err) {
      toast.error(err);
      return null;
    }
    setSaving(true);
    try {
      const token = (await getToken()) || undefined;
      const cleanDisplay = displayName.trim();
      const fields = {
        name: cleanDisplay,
        slug: slug.trim().toLowerCase(),
        display_name: cleanDisplay,
        headline: headline.trim() || undefined,
        bio: bio.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        theme: "default",
        template,
        background_image_url: backgroundImageUrl.trim() || null,
        background_overlay: backgroundImageUrl.trim() ? backgroundOverlay : null,
        published: nextPublished,
      };

      const saved = page
        ? await updateLinkPage(page.id, fields, token)
        : await createLinkPage(fields, token);

      const payload: LinkPageItemInput[] = items.map((it) => ({
        label: it.label.trim(),
        url: it.isHeading ? "" : normalizeUrl(it.url),
        item_type: it.isHeading ? "header" : "link",
        icon: it.isHeading ? undefined : it.icon.trim() || undefined,
        description: it.isHeading ? undefined : it.description.trim() || undefined,
        display: it.isHeading ? undefined : it.display ?? undefined,
        active: it.active,
      }));

      if (payload.length > 0 || saved.items.length > 0) {
        await replaceMyLinkPageItems(saved.id, payload, token);
      }

      setPublished(nextPublished);
      invalidateLinkCaches();

      if (nextPublished && !published) {
        toast.success("Link page published live!");
        celebrate("Link page published");
      } else {
        toast.success("Changes saved successfully");
      }

      if (mode === "new" && !page) {
        router.replace(`/dashboard/link-page/${saved.id}`);
      }
      return saved.id;
    } catch (e) {
      logHandledError("Failed to save link page:", e);
      toast.error(e instanceof Error ? e.message : "Could not save link page");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Open the live preview at /p/{slug}?preview={token} in another tab — same
  // UI as the published page, fed by the editor's WebSocket stream instead of
  // published data.
  const handleOpenPreviewPage = async () => {
    // Open the tab synchronously during the user gesture so the popup
    // blocker doesn't intercept; navigate it once the token arrives.
    const previewTab = typeof window !== "undefined" ? window.open("", "_blank") : null;
    const tabBlocked = () => {
      previewTab?.close();
      toast.error("Please allow pop-ups for this site to open the preview.");
    };
    try {
      if (!page?.id) {
        const savedId = await persist(published);
        if (!savedId) {
          previewTab?.close();
          return;
        }
        const { token } = await createLinkPagePreviewToken(savedId, (await getToken()) || undefined);
        if (previewTab) {
          previewTab.location.href = `/p/${slug.trim().toLowerCase()}?preview=${encodeURIComponent(token)}`;
        } else {
          tabBlocked();
        }
        return;
      }

      // Persist quietly in the background; the WS stream carries unsaved edits.
      void persist(published);
      const { token } = await createLinkPagePreviewToken(page.id, (await getToken()) || undefined);
      if (previewTab) {
        previewTab.location.href = `/p/${slug.trim().toLowerCase()}?preview=${encodeURIComponent(token)}`;
      } else {
        tabBlocked();
      }
    } catch (e) {
      logHandledError("Preview launch failed:", e);
      previewTab?.close();
      toast.error("Could not open the preview. Please try again.");
    }
  };

  // Stream the draft to any open preview tab (debounced; the publisher hook
  // also flushes the latest snapshot the moment its socket becomes ready).
  const draftState: PreviewPageState = useMemo(
    () => ({
      display_name: displayName.trim() || "Your page",
      headline: headline.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      template,
      background_image_url: backgroundImageUrl.trim() || null,
      background_overlay: backgroundImageUrl.trim() ? backgroundOverlay : null,
      items: items.map((it) => ({
        id: it.key,
        label: it.label.trim() || "Untitled",
        url: it.isHeading ? "" : normalizeUrl(it.url),
        item_type: it.isHeading ? "header" : "link",
        icon: it.isHeading ? null : it.icon.trim() || null,
        description: it.isHeading ? null : it.description.trim() || null,
        image_url: null,
        display: it.isHeading ? null : it.display ?? null,
        active: it.active,
      })),
    }),
    [displayName, headline, bio, avatarUrl, template, backgroundImageUrl, backgroundOverlay, items]
  );

  useEffect(() => {
    if (!page?.id) return;
    const t = setTimeout(() => publish(draftState), 300);
    return () => clearTimeout(t);
  }, [draftState, publish, page?.id]);

  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/p/${slug}` : `/p/${slug}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-28">
      {/* 1. Header Bar with Tabs, Open Preview Page Button, and Save */}
      <div className="sticky top-0 z-30 bg-bg/95 backdrop-blur-md border-b border-line -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 transition-all shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-7xl mx-auto">
          {/* Left: Back, Page Title, and Public Link */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={mode === "edit" && page?.id ? `/dashboard/link-page/${page.id}` : "/dashboard/link-page"}
              className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-line bg-surface/40 hover:bg-surface text-muted hover:text-fg transition-colors shrink-0"
              title="Return to link pages"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="min-w-0">
              <h1 className="font-display text-sm sm:text-base font-semibold tracking-tight text-fg truncate leading-tight">
                {displayName || (mode === "new" ? "New Link Page" : "Edit Link Page")}
              </h1>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-mono text-muted hover:text-fg transition-colors"
                title="Open live link"
              >
                <span>/p/{slug || "slug"}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>
            </div>
          </div>

          {/* Center: Clean Segmented Tab Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-surface border border-line self-start sm:self-center">
            <button
              type="button"
              onClick={() => setActiveTab("links")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === "links"
                  ? "bg-card text-fg shadow-xs border border-line/60 font-semibold"
                  : "text-muted hover:text-fg"
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Links</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface/80 text-muted">
                {items.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("appearance")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === "appearance"
                  ? "bg-card text-fg shadow-xs border border-line/60 font-semibold"
                  : "text-muted hover:text-fg"
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Appearance</span>
            </button>
          </div>

          {/* Right: Actions (Draft/Live Pill, Preview, Save) */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {/* Live / Draft Switch */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-surface border border-line text-xs">
              <button
                type="button"
                onClick={() => setPublished(false)}
                disabled={saving}
                className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                  !published
                    ? "bg-card text-fg font-medium shadow-xs border border-line/60"
                    : "text-muted hover:text-fg"
                }`}
              >
                Draft
              </button>
              <button
                type="button"
                onClick={() => setPublished(true)}
                disabled={saving}
                className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  published
                    ? "bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30"
                    : "text-muted hover:text-fg"
                }`}
              >
                {published && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                <span>Live</span>
              </button>
            </div>

            {/* PREVIEW BUTTON: Opens the dedicated preview page in another browser tab */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenPreviewPage}
              disabled={saving}
              className="h-8.5 px-3 rounded-xl border border-line bg-surface/40 hover:bg-surface text-fg font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer hover:border-line-strong"
              title="Open preview page in new tab"
            >
              <Eye className="w-3.5 h-3.5 text-muted" />
              <span>Preview</span>
            </Button>

            {/* Save Button */}
            <Button
              type="button"
              size="sm"
              onClick={() => persist(published)}
              disabled={saving}
              className={`h-8.5 px-4 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer min-w-[90px] ${
                published
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-zinc-100 hover:bg-white text-zinc-950 dark:bg-zinc-100 dark:text-zinc-950 font-semibold"
              }`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save</span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Workspace (Clean, centered, spacious full-width editor) */}
      <div className="max-w-2xl mx-auto space-y-5">
        {activeTab === "links" ? (
          /* TAB 1: LINKS & HEADINGS (Clean, High-Contrast Linktree Style) */
          <div className="space-y-4">
            {/* Primary Action Button Bar */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [{ key: newKey(), ...EMPTY_LINK_ITEM }, ...prev])
                }
                className="flex-1 h-10 px-5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add link</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [{ key: newKey(), ...EMPTY_HEADING_ITEM }, ...prev])
                }
                className="flex-1 h-10 px-5 rounded-xl border border-line bg-card hover:bg-surface text-fg font-medium text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
              >
                <Heading className="w-3.5 h-3.5 text-muted" />
                <span>Add header</span>
              </button>
            </div>

            {/* Items List */}
            {items.length === 0 ? (
              <div className="rounded-2xl border border-line/60 bg-surface/20 p-8 sm:p-10 text-center space-y-3 max-w-lg mx-auto my-4">
                <div className="w-10 h-10 rounded-xl bg-surface border border-line/70 flex items-center justify-center mx-auto text-muted shadow-2xs">
                  <Link2 className="w-5 h-5 text-muted" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-fg">No links added yet</h3>
                  <p className="text-xs text-muted max-w-xs mx-auto">
                    Add your first link or section header above to customize your public page.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it, idx) => {
                  /* Section Heading Card */
                  if (it.isHeading) {
                    return (
                      <Card
                        key={it.key}
                        className="rounded-2xl border border-line bg-surface/30 p-3 flex items-center justify-between gap-3 shadow-2xs hover:border-line-strong transition-colors"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-surface border border-line flex items-center justify-center text-xs font-bold text-muted shrink-0 select-none">
                            H
                          </span>
                          <input
                            type="text"
                            value={it.label}
                            onChange={(e) => updateItem(it.key, { label: e.target.value })}
                            placeholder="Section title (e.g. Portfolio, Connect)"
                            className="w-full text-xs font-semibold text-fg bg-transparent border-b border-transparent hover:border-line focus:border-line-strong focus:outline-none pb-0.5 transition-colors placeholder:text-muted/40"
                          />
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveItem(idx, -1)}
                            disabled={idx === 0}
                            className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface disabled:opacity-20 cursor-pointer"
                            title="Move up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(idx, 1)}
                            disabled={idx === items.length - 1}
                            className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface disabled:opacity-20 cursor-pointer"
                            title="Move down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(it.key)}
                            className="p-1 rounded-md text-muted hover:text-danger hover:bg-danger/10 cursor-pointer ml-1"
                            title="Delete heading"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </Card>
                    );
                  }

                  /* Regular Link Card (Bento/Linktree Standard) */
                  const isPickingIcon = pickingIconKey === it.key;
                  const autoRoutesToIcon = isSocialItem({
                    id: it.key,
                    label: it.label,
                    url: it.url,
                    icon: it.icon,
                    item_type: "link",
                  });

                  return (
                    <Card
                      key={it.key}
                      className={`relative rounded-2xl border p-3.5 transition-all duration-150 ${
                        it.active
                          ? "border-line bg-card hover:border-line-strong shadow-2xs"
                          : "border-line/40 bg-surface/20 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Drag Handle */}
                        <div className="pt-2 text-muted/30 hover:text-muted shrink-0 cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Platform Icon Badge (Click to open floating icon squircle popover) */}
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() => setPickingIconKey(isPickingIcon ? null : it.key)}
                            className="w-10 h-10 rounded-xl border border-line bg-surface/50 hover:bg-surface hover:border-line-strong flex items-center justify-center text-fg transition-all cursor-pointer shadow-2xs group"
                            title="Click to choose platform icon"
                          >
                            <PlatformIconRenderer icon={it.icon} className="w-4.5 h-4.5 transition-transform group-hover:scale-110" />
                          </button>

                          {/* Floating Compact Icon Picker Popover */}
                          {isPickingIcon && (
                            <div className="absolute top-12 left-0 z-50 w-72 rounded-2xl border border-line bg-card/95 backdrop-blur-xl p-3 shadow-2xl space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-line/60">
                                <span className="font-semibold text-fg">Select platform</span>
                                <button
                                  type="button"
                                  onClick={() => setPickingIconKey(null)}
                                  className="text-muted hover:text-fg text-[11px] cursor-pointer"
                                >
                                  Done
                                </button>
                              </div>

                              {/* Compact 6-col Icon Squircle Grid */}
                              <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto scrollbar-hide p-0.5">
                                {PLATFORM_PRESETS.map((preset) => (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => handlePickPlatform(it.key, preset)}
                                    className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                                      it.icon === preset.icon
                                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-400 ring-2 ring-emerald-500/20"
                                        : "border-line/60 bg-surface/50 hover:bg-surface hover:border-line-strong hover:scale-105 text-fg"
                                    }`}
                                    title={preset.name}
                                  >
                                    <PlatformIconRenderer icon={preset.icon} className="w-4 h-4" />
                                  </button>
                                ))}
                              </div>

                              {/* Custom emoji or text icon */}
                              <div className="pt-1 flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={it.icon}
                                  onChange={(e) => updateItem(it.key, { icon: e.target.value })}
                                  placeholder="Or custom emoji / icon"
                                  className="w-full h-7 px-2 text-xs rounded-lg border border-line bg-surface/40 text-fg placeholder:text-muted/50 focus:border-line-strong focus:outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Title & URL Inputs */}
                        <div className="flex-1 min-w-0 space-y-1 pt-0.5">
                          {/* Title input */}
                          <input
                            type="text"
                            value={it.label}
                            onChange={(e) => updateItem(it.key, { label: e.target.value })}
                            placeholder="Link title"
                            className="w-full text-sm font-semibold text-fg bg-transparent border-b border-transparent hover:border-line/60 focus:border-line-strong focus:outline-none pb-0.5 transition-colors placeholder:text-muted/40"
                          />

                          {/* URL Input (Smart auto-detection updates icon and title on paste!) */}
                          <input
                            type="text"
                            value={it.url}
                            onChange={(e) => handleUrlChange(it.key, e.target.value)}
                            placeholder="https://..."
                            className="w-full text-xs font-mono text-muted hover:text-fg focus:text-fg bg-transparent border-b border-transparent hover:border-line/40 focus:border-line-strong focus:outline-none pb-0.5 transition-colors placeholder:text-muted/30"
                          />

                          {/* Expandable Subtitle Field */}
                          {it.showDetails && (
                            <div className="pt-1 animate-in fade-in duration-100">
                              <input
                                type="text"
                                value={it.description}
                                onChange={(e) => updateItem(it.key, { description: e.target.value })}
                                placeholder="Subtitle or note (optional)"
                                className="w-full text-[11px] text-muted bg-transparent border-b border-transparent hover:border-line/40 focus:border-line-strong focus:outline-none pb-0.5 transition-colors placeholder:text-muted/30"
                              />
                            </div>
                          )}
                        </div>

                        {/* Right Actions: display mode, Subtitle trigger, reorder, iOS switch, delete */}
                        <div className="flex items-center gap-2 shrink-0 pt-1">
                          {/* Icon vs Card — how this platform link renders on the page */}
                          {(autoRoutesToIcon || it.display) && (
                            <div
                              className="inline-flex items-center rounded-lg border border-line bg-surface/60 p-0.5"
                              title="Show this link as a round icon in the social row, or as a full card"
                            >
                              <button
                                type="button"
                                onClick={() => updateItem(it.key, { display: "icon" })}
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                                  it.display !== "card"
                                    ? "bg-card text-fg shadow-xs border border-line/60"
                                    : "text-muted hover:text-fg"
                                }`}
                              >
                                Icon
                              </button>
                              <button
                                type="button"
                                onClick={() => updateItem(it.key, { display: "card" })}
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                                  it.display === "card"
                                    ? "bg-card text-fg shadow-xs border border-line/60"
                                    : "text-muted hover:text-fg"
                                }`}
                              >
                                Card
                              </button>
                            </div>
                          )}

                          {/* Subtitle toggle */}
                          <button
                            type="button"
                            onClick={() => updateItem(it.key, { showDetails: !it.showDetails })}
                            className={`text-[11px] font-medium transition-colors cursor-pointer ${
                              it.showDetails ? "text-fg" : "text-muted hover:text-fg"
                            }`}
                            title="Add subtitle"
                          >
                            {it.showDetails ? "Subtitle" : "+ Note"}
                          </button>

                          {/* Reorder Buttons */}
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => moveItem(idx, -1)}
                              disabled={idx === 0}
                              className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface disabled:opacity-20 cursor-pointer"
                              title="Move up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveItem(idx, 1)}
                              disabled={idx === items.length - 1}
                              className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface disabled:opacity-20 cursor-pointer"
                              title="Move down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* iOS Style Switch */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={it.active}
                            onClick={() => updateItem(it.key, { active: !it.active })}
                            className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                              it.active ? "bg-emerald-500" : "bg-line-strong"
                            }`}
                            title={it.active ? "Visible on live page" : "Hidden from live page"}
                          >
                            <span
                              className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                                it.active ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => removeItem(it.key)}
                            className="p-1 rounded-md text-muted hover:text-danger hover:bg-danger/10 cursor-pointer"
                            title="Delete link"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* TAB 2: APPEARANCE & THEMES */
          <div className="space-y-6">
            {/* Profile Information */}
            <Card className="p-5 sm:p-6 rounded-2xl border border-line bg-card space-y-5 shadow-xs">
              <div className="pb-3 border-b border-line/40">
                <h2 className="text-sm font-semibold text-fg tracking-tight">Profile</h2>
                <p className="text-xs text-muted mt-0.5">
                  Public details shown at the top of your link page
                </p>
              </div>

              {/* Profile Photo Uploader */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-fg block">Profile photo</label>
                <AvatarUploader
                  value={avatarUrl}
                  onChange={setAvatarUrl}
                  displayName={displayName}
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Display Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-fg block">
                    Display name <span className="text-muted text-[10px] font-normal">(Required)</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alex Morgan"
                    disabled={saving}
                    className="w-full h-9.5 px-3 rounded-xl border border-line bg-surface/30 text-fg text-sm placeholder:text-muted/50 focus:border-line-strong focus:bg-card focus:outline-none transition-all"
                  />
                </div>

                {/* Handle (Slug) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-fg block">
                    Page URL <span className="text-muted text-[10px] font-normal">(Handle)</span>
                  </label>
                  <div className="flex items-center rounded-xl border border-line bg-surface/30 overflow-hidden focus-within:border-line-strong focus-within:bg-card transition-all">
                    <span className="h-9.5 inline-flex items-center px-3 bg-surface/60 border-r border-line text-muted text-xs font-mono select-none">
                      /p/
                    </span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) =>
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9.\-]/g, ""))
                      }
                      placeholder="alex-morgan"
                      disabled={saving}
                      className="w-full h-9.5 px-3 bg-transparent text-fg text-xs font-mono placeholder:text-muted/50 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Headline */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Headline</label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Freelance Product Designer & Consultant"
                  disabled={saving}
                  className="w-full h-9.5 px-3 rounded-xl border border-line bg-surface/30 text-fg text-sm placeholder:text-muted/50 focus:border-line-strong focus:bg-card focus:outline-none transition-all"
                />
              </div>

              {/* Bio */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Bio</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Brief introduction displayed under your headline."
                  disabled={saving}
                  className="w-full p-3 rounded-xl border border-line bg-surface/30 text-fg placeholder:text-muted/50 text-xs sm:text-sm focus:border-line-strong focus:bg-card focus:outline-none transition-all resize-y"
                />
              </div>
            </Card>

            {/* Themes Selection */}
            <Card className="p-5 sm:p-6 rounded-2xl border border-line bg-card space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-line/40">
                <div>
                  <h2 className="text-sm font-semibold text-fg tracking-tight">Theme</h2>
                  <p className="text-xs text-muted mt-0.5">
                    Select the visual style for your link tree
                  </p>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-surface text-muted border border-line/50">
                  {LINK_TEMPLATES.length} styles
                </span>
              </div>

              {/* Theme Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {LINK_TEMPLATES.map((t) => (
                  <ThemePreviewCard
                    key={t.key}
                    template={t}
                    isSelected={template === t.key}
                    onSelect={() => setTemplate(t.key)}
                  />
                ))}
              </div>
            </Card>

            {/* Background Photo */}
            <Card className="p-5 sm:p-6 rounded-2xl border border-line bg-card space-y-4 shadow-xs">
              <div className="pb-3 border-b border-line/40">
                <h2 className="text-sm font-semibold text-fg tracking-tight">Background photo</h2>
                <p className="text-xs text-muted mt-0.5">
                  Optional full-bleed image behind your page
                </p>
              </div>

              <BackgroundUploader
                value={backgroundImageUrl}
                onChange={setBackgroundImageUrl}
                disabled={saving}
              />

              <StockPhotoPicker
                onSelect={(url) => setBackgroundImageUrl(url)}
                disabled={saving}
              />

              {backgroundImageUrl && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-fg">Dim overlay</label>
                    <span className="text-[11px] font-mono text-muted">
                      {Math.round(backgroundOverlay * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(backgroundOverlay * 100)}
                    onChange={(e) => setBackgroundOverlay(Number(e.target.value) / 100)}
                    className="w-full accent-emerald-500 cursor-pointer"
                    aria-label="Background dim overlay"
                  />
                  <p className="text-[11px] text-muted">
                    Darkens the photo so your links stay readable.
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
