"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, ArrowDown } from "lucide-react";
import {
  ArrowLeft,
  ArrowUp,
  Plus,
  Trash2,
  ExternalLink,
  Eye,
  Globe,
  Sparkles,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  createLinkPage,
  updateLinkPage,
  replaceMyLinkPageItems,
  type LinkPage,
  type LinkPageItemInput,
} from "@/lib/api";
import { invalidateCache } from "@/hooks/use-api-data";
import { LinkPageRender, LINK_TEMPLATES } from "@/components/link-page/templates";
import { LinkPageThumb } from "@/components/link-page/LinkPageThumb";
import { celebrate } from "@/components/common/Celebration";
import { AvatarUploader } from "@/components/link-page/AvatarUploader";

const SLUG_RE = /^[a-z0-9][a-z0-9.\-]{0,62}[a-z0-9]$/;

interface DraftItem {
  key: string;
  label: string;
  url: string;
  icon: string;
  description: string;
  active: boolean;
  showDetails?: boolean;
}

const EMPTY_ITEM: Omit<DraftItem, "key"> = {
  label: "",
  url: "",
  icon: "",
  description: "",
  active: true,
  showDetails: false,
};

function newKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeUrl(v: string): string {
  const t = v.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function guessSlug(): string {
  if (typeof window === "undefined") return "my-links";
  const guess = window.location.hostname.replace(/\W+/g, "-");
  return guess ? `${guess}-links`.slice(0, 60) : "my-links";
}

/**
 * Professional, streamlined Link Page Editor.
 * Built strictly following /impeccable operate standards:
 * - Direct image compression & Cloudinary storage (no manual URL input).
 * - Focused, intuitive identity inputs without redundant fields.
 * - Progressive disclosure on link items to eliminate clutter.
 * - Authentic mobile device preview.
 * - Full real-time synchronization with backend API and database.
 */
export function LinkPageBuilder({ mode, page }: { mode: "new" | "edit"; page?: LinkPage }) {
  const { getToken } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(page?.display_name ?? page?.name ?? "");
  const [slug, setSlug] = useState(page?.slug ?? guessSlug());
  const [headline, setHeadline] = useState(page?.headline ?? "");
  const [bio, setBio] = useState(page?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(page?.avatar_url ?? "");
  const [template, setTemplate] = useState<string>(page?.template ?? "classic");
  const [published, setPublished] = useState(page?.published ?? false);
  const [items, setItems] = useState<DraftItem[]>(
    page?.items.map((i) => ({
      key: i.id,
      label: i.label,
      url: i.url,
      icon: i.icon ?? "",
      description: i.description ?? "",
      active: i.active !== false,
      showDetails: Boolean(i.icon || i.description),
    })) ?? []
  );
  const [saving, setSaving] = useState(false);

  const previewData = useMemo(
    () => ({
      display_name: displayName || "Your Name",
      headline: headline || null,
      bio: bio || null,
      avatar_url: avatarUrl || null,
      items: items
        .filter((i) => i.active && i.label.trim())
        .map((i) => ({
          id: i.key,
          label: i.label.trim(),
          url: normalizeUrl(i.url),
          icon: i.icon.trim() || null,
          description: i.description.trim() || null,
        })),
    }),
    [displayName, headline, bio, avatarUrl, items]
  );

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

  const validate = (): string | null => {
    if (!displayName.trim()) return "Please enter your profile display name.";
    if (!SLUG_RE.test(slug.trim().toLowerCase()))
      return "URL handle must be 2-64 chars: lowercase letters, numbers, hyphens or dots.";
    for (const it of items) {
      if (!it.label.trim()) return "Every link needs a title.";
      if (!/^https?:\/\/.+/.test(normalizeUrl(it.url)))
        return `Link "${it.label}" needs a valid URL (e.g. https://...).`;
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

  const persist = async (nextPublished: boolean): Promise<boolean> => {
    const err = validate();
    if (err) {
      toast.error(err);
      return false;
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
        published: nextPublished,
      };

      const saved = page
        ? await updateLinkPage(page.id, fields, token)
        : await createLinkPage(fields, token);

      const payload: LinkPageItemInput[] = items.map((it) => ({
        label: it.label.trim(),
        url: normalizeUrl(it.url),
        icon: it.icon.trim() || undefined,
        description: it.description.trim() || undefined,
        active: it.active,
      }));

      if (payload.length > 0 || saved.items.length > 0) {
        await replaceMyLinkPageItems(saved.id, payload, token);
      }

      setPublished(nextPublished);
      invalidateLinkCaches();

      if (mode === "new") {
        router.replace(`/dashboard/link-page/${saved.id}`);
      }
      return true;
    } catch (e) {
      console.error("Failed to save link page:", e);
      toast.error(e instanceof Error ? e.message : "Could not save link page");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/p/${slug}` : `/p/${slug}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
      {/* Top Header Bar — Clean Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="space-y-1">
          <Link
            href={mode === "edit" && page?.id ? `/dashboard/link-page/${page.id}` : "/dashboard/link-page"}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{mode === "edit" ? "Back to link page" : "Back to link pages"}</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-fg">
              {mode === "new" ? "Create Link Page" : "Edit Link Page"}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${
                published
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-surface text-muted border-line"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  published ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-muted"
                }`}
              />
              {published ? "Live" : "Draft"}
            </span>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {published && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-xl border border-line bg-surface/50 hover:bg-surface text-xs text-fg font-medium transition-colors"
              title="Open public page"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View live</span>
            </a>
          )}

          {published ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                persist(false).then((ok) => ok && toast.success("Page unpublished to draft"))
              }
              disabled={saving}
              className="h-9 px-3.5 rounded-xl border-line text-muted hover:text-fg hover:bg-surface text-xs font-medium"
            >
              Unpublish
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() =>
                persist(true).then((ok) => {
                  if (ok) {
                    toast.success("Page is now live!");
                    celebrate("Page published");
                  }
                })
              }
              disabled={saving}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm transition-all"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Publish
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={() =>
              persist(published).then((ok) => ok && toast.success("Changes saved"))
            }
            disabled={saving}
            className="h-9 px-4 rounded-xl bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm transition-all"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Editor Controls */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Identity & Profile Section */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-line/40">
              <Globe className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-fg tracking-tight">Profile & Identity</h2>
            </div>

            {/* Photo / Avatar Uploader with Client Compression & Cloudinary Storage */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg block">Profile Photo / Logo</label>
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
                  Display name <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  disabled={saving}
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/40 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>

              {/* Public URL Handle */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Public handle (slug) <span className="text-accent">*</span>
                </label>
                <div className="flex items-center">
                  <span className="h-10 inline-flex items-center px-3 rounded-l-xl border border-r-0 border-line bg-surface/60 text-muted text-xs font-mono select-none">
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
                    className="w-full h-10 px-3 rounded-r-xl border border-line bg-surface/40 text-fg text-sm font-mono placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg block">Headline / Role</label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Freelance Product Designer & Consultant"
                disabled={saving}
                className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/40 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all"
              />
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg block">Bio</label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A brief intro displayed under your name on the public page."
                disabled={saving}
                className="w-full p-3 rounded-xl border border-line bg-surface/40 text-fg placeholder:text-muted/60 text-xs sm:text-sm focus:border-accent focus:bg-card focus:outline-none transition-all resize-y"
              />
            </div>
          </Card>

          {/* 2. Theme & Template Selector */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line/40">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-semibold text-fg tracking-tight">Template Design</h2>
              </div>
              <span className="text-[11px] font-mono text-muted">
                {LINK_TEMPLATES.length} templates
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {LINK_TEMPLATES.map((t) => {
                const isSelected = template === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTemplate(t.key)}
                    className={`text-left rounded-xl border p-3 transition-all cursor-pointer select-none group ${
                      isSelected
                        ? "border-accent ring-2 ring-accent/20 bg-accent/5 shadow-xs"
                        : "border-line/70 bg-surface/30 hover:border-line-strong hover:bg-surface/50"
                    }`}
                  >
                    <LinkPageThumb
                      template={t.key}
                      boxW={104}
                      boxH={54}
                      className="rounded-lg border border-line/50 mb-2.5 mx-auto transition-transform group-hover:scale-[1.02]"
                      data={{
                        display_name: "Preview",
                        headline: "Design",
                        items: [
                          { id: "1", label: "Work", url: "#", icon: null, description: null },
                          { id: "2", label: "Contact", url: "#", icon: null, description: null },
                        ],
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-fg">{t.name}</span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted mt-0.5 line-clamp-1">{t.blurb}</p>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* 3. Links Manager */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-line/40">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-fg tracking-tight">Links</h2>
                <span className="text-xs font-mono text-muted bg-surface/80 px-2 py-0.5 rounded-md border border-line/60">
                  {items.length}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setItems((prev) => [...prev, { key: newKey(), ...EMPTY_ITEM }])
                }
                className="h-8 text-xs rounded-xl border-line hover:border-line-strong text-fg font-medium"
              >
                <Plus className="w-3.5 h-3.5 mr-1 text-accent" />
                <span>Add link</span>
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-xs font-medium text-fg">No links added yet</p>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Add links to your portfolio, consultation booking, calendar, GitHub, or social profiles.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setItems((prev) => [...prev, { key: newKey(), ...EMPTY_ITEM }])
                  }
                  className="mt-2 text-xs rounded-xl border-line text-accent"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Add your first link</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it, idx) => (
                  <div
                    key={it.key}
                    className={`rounded-xl border p-3.5 space-y-3 transition-colors ${
                      it.active
                        ? "border-line bg-surface/30"
                        : "border-line/50 bg-surface/10 opacity-60"
                    }`}
                  >
                    {/* Top Row: Title, URL & Quick Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      {/* Reorder Buttons */}
                      <div className="flex items-center gap-0.5 shrink-0 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => moveItem(idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface/80 disabled:opacity-20 cursor-pointer transition-colors"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(idx, 1)}
                          disabled={idx === items.length - 1}
                          className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface/80 disabled:opacity-20 cursor-pointer transition-colors"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Title Input */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={it.label}
                          onChange={(e) => updateItem(it.key, { label: e.target.value })}
                          placeholder="Link title (e.g. Book a Consultation)"
                          className="w-full h-9 px-3 rounded-lg border border-line bg-card text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:outline-none transition-all"
                        />
                      </div>

                      {/* URL Input */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={it.url}
                          onChange={(e) => updateItem(it.key, { url: e.target.value })}
                          placeholder="https://cal.com/..."
                          className="w-full h-9 px-3 rounded-lg border border-line bg-card text-fg text-xs font-mono placeholder:text-muted/60 focus:border-accent focus:outline-none transition-all"
                        />
                      </div>

                      {/* Status Toggle & Delete */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => updateItem(it.key, { active: !it.active })}
                          className={`h-9 px-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                            it.active
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-surface text-muted border-line"
                          }`}
                        >
                          {it.active ? "Visible" : "Hidden"}
                        </button>

                        <button
                          type="button"
                          onClick={() => removeItem(it.key)}
                          className="p-2 rounded-lg text-muted hover:text-danger hover:bg-danger/10 cursor-pointer transition-colors"
                          title="Delete link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Optional Details (Emoji Icon & Subtitle) */}
                    <div>
                      {it.showDetails ? (
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-line/30">
                          <div className="sm:col-span-3">
                            <input
                              type="text"
                              value={it.icon}
                              onChange={(e) =>
                                updateItem(it.key, { icon: e.target.value.slice(0, 8) })
                              }
                              placeholder="Emoji icon (e.g. 🗓️)"
                              className="w-full h-8 px-2.5 rounded-lg border border-line bg-card text-fg text-xs focus:border-accent focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-8">
                            <input
                              type="text"
                              value={it.description}
                              onChange={(e) =>
                                updateItem(it.key, { description: e.target.value })
                              }
                              placeholder="Subtitle or short note (optional)"
                              className="w-full h-8 px-2.5 rounded-lg border border-line bg-card text-fg text-xs focus:border-accent focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-1 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => updateItem(it.key, { showDetails: false })}
                              className="p-1 text-muted hover:text-fg text-xs"
                              title="Collapse details"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateItem(it.key, { showDetails: true })}
                          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-fg transition-colors"
                        >
                          <ChevronDown className="w-3 h-3" />
                          <span>Add icon or subtitle</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Authentic Mobile Phone Live Preview */}
        <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-6">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-fg">Live Mobile Preview</span>
            <span className="text-[11px] font-mono text-muted">
              {LINK_TEMPLATES.find((t) => t.key === template)?.name}
            </span>
          </div>

          {/* Smartphone Frame */}
          <div className="w-full max-w-[340px] mx-auto rounded-[40px] border-[5px] border-line/90 bg-bg shadow-2xl p-2 relative overflow-hidden transition-all">
            {/* Dynamic Notch / Speaker Bar */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-4 bg-line/80 rounded-full z-20 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-black/40 mr-2" />
              <span className="w-8 h-1 rounded-full bg-black/30" />
            </div>

            {/* Inner Phone Viewport */}
            <div className="rounded-[32px] overflow-hidden border border-line/40 max-h-[560px] overflow-y-auto no-scrollbar pt-6 pb-4">
              <LinkPageRender template={template} data={previewData} inert />
            </div>
          </div>

          {/* Full Preview Link */}
          {mode === "edit" && page?.id && (
            <Link
              href={`/dashboard/link-page/preview/${page.id}`}
              className="flex items-center justify-center gap-1.5 w-full h-9 rounded-xl border border-line bg-surface/40 hover:bg-surface text-fg text-xs font-medium transition-all"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Open full preview</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
