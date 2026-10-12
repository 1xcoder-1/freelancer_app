"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Eye,
  X,
  Globe,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getMyLinkPage,
  upsertMyLinkPage,
  replaceMyLinkPageItems,
  type LinkPage,
  type LinkPageItemInput,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { LinkPageRender, LINK_TEMPLATES } from "@/components/link-page/templates";
import { LinkPageStatsPanel } from "@/components/link-page/LinkPageStatsPanel";
import { celebrate } from "@/components/common/Celebration";

const SLUG_RE = /^[a-z0-9][a-z0-9.\-]{0,62}[a-z0-9]$/;

interface DraftItem {
  key: string;
  label: string;
  url: string;
  icon: string;
  description: string;
  active: boolean;
}

const EMPTY_ITEM: Omit<DraftItem, "key"> = { label: "", url: "", icon: "", description: "", active: true };

function newKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeUrl(v: string): string {
  const t = v.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export default function LinkPageBuilder() {
  const { getToken } = useAuth();

  const { data: page, loading, refresh } = useApiData<LinkPage | null>(
    "linkpage:my",
    async (token) => getMyLinkPage(token),
    { reportContext: "link-page" }
  );

  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [template, setTemplate] = useState<string>("classic");
  const [published, setPublished] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Seed the editor once the stored page arrives (or with a fresh start).
  const seededRef = useRef(false);
  useEffect(() => {
    if (loading || seededRef.current) return;
    seededRef.current = true;
    if (page) {
      setSlug(page.slug);
      setDisplayName(page.display_name);
      setHeadline(page.headline ?? "");
      setBio(page.bio ?? "");
      setAvatarUrl(page.avatar_url ?? "");
      setTemplate(page.template);
      setPublished(page.published);
      setItems(
        page.items.map((i) => ({
          key: i.id,
          label: i.label,
          url: i.url,
          icon: i.icon ?? "",
          description: i.description ?? "",
          active: i.active !== false,
        }))
      );
    } else {
      const guess = (typeof window !== "undefined" ? window.location.hostname : "").replace(/\W+/g, "-");
      setSlug(guess ? `${guess}-links`.slice(0, 60) : "my-links");
    }
  }, [loading, page]);

  const previewData = useMemo(
    () => ({
      display_name: displayName || "Your Name",
      headline: headline || null,
      bio: bio || null,
      avatar_url: avatarUrl || null,
      items: items.filter((i) => i.active && i.label.trim()).map((i) => ({
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
    if (!SLUG_RE.test(slug.trim().toLowerCase()))
      return "Slug must be 2-64 chars: lowercase letters, numbers, hyphens or dots.";
    if (!displayName.trim()) return "Display name is required.";
    for (const it of items) {
      if (!it.label.trim()) return "Every link needs a label.";
      if (!/^https?:\/\/.+/.test(normalizeUrl(it.url))) return `Link "${it.label}" needs a valid URL.`;
    }
    if (published && items.filter((i) => i.active).length === 0)
      return "Add at least one active link before publishing.";
    return null;
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
      const saved = await upsertMyLinkPage(
        {
          slug: slug.trim().toLowerCase(),
          display_name: displayName.trim(),
          headline: headline.trim() || undefined,
          bio: bio.trim() || undefined,
          avatar_url: avatarUrl.trim() || undefined,
          theme: "default",
          template,
          published: nextPublished,
        },
        token
      );
      const payload: LinkPageItemInput[] = items.map((it) => ({
        label: it.label.trim(),
        url: normalizeUrl(it.url),
        icon: it.icon.trim() || undefined,
        description: it.description.trim() || undefined,
        active: it.active,
      }));
      if (payload.length > 0 || saved.items.length > 0) {
        await replaceMyLinkPageItems(payload, token);
      }
      setPublished(nextPublished);
      invalidateCache("linkpage:my");
      invalidateCache("linkpage:stats:7");
      invalidateCache("linkpage:stats:30");
      invalidateCache("linkpage:stats:90");
      await refresh(true);
      return true;
    } catch (e) {
      console.error("Failed to save link page:", e);
      toast.error(e instanceof Error ? e.message : "Could not save link page");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${slug}` : `/p/${slug}`;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">Link Page</h1>
            <span
              className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                published ? "bg-ok/10 text-ok border-ok/30" : "bg-surface text-muted border-line"
              }`}
            >
              {published ? "Published" : "Draft"}
            </span>
          </div>
          <p className="text-muted text-sm mt-1">
            Your own Linktree-style page at <span className="font-mono text-xs">/p/{slug || "your-handle"}</span> — fill in your links, pick a template and publish.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh(true)}
            disabled={loading}
            className="border-line text-fg w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {published && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center p-2 rounded-xl border border-line bg-bg hover:bg-surface text-muted hover:text-fg text-xs h-9"
              title="Open published page"
            >
              <ExternalLink className="w-4 h-4 mr-1.5" /> Open
            </a>
          )}
          <Button
            size="sm"
            onClick={() => persist(published).then((ok) => ok && toast.success("Link page saved"))}
            disabled={saving}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          {published ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => persist(false).then((ok) => ok && toast.success("Link page unpublished"))}
              disabled={saving}
              className="border-line text-fg"
            >
              <X className="w-3.5 h-3.5 mr-1.5" /> Unpublish
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() =>
                persist(true).then((ok) => {
                  if (ok) {
                    toast.success("Link page is live");
                    celebrate("Page published");
                  }
                })
              }
              disabled={saving}
              className="bg-ok/90 hover:bg-ok text-white font-semibold shadow-sm"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" /> Publish
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: editor */}
        <div className="lg:col-span-7 space-y-5">
          {/* Identity */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-info" />
              <h2 className="text-sm font-medium text-fg">Identity</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Public handle (slug)</label>
                <div className="flex items-center gap-0">
                  <span className="h-10 inline-flex items-center px-3 rounded-l-xl border border-r-0 border-line bg-surface/70 text-muted text-xs font-mono whitespace-nowrap">
                    /p/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9.\-]/g, ""))}
                    className="w-full h-10 px-3.5 rounded-r-xl border border-line bg-surface/50 text-fg text-sm font-mono focus:border-accent focus:bg-card focus:outline-none transition-all"
                    placeholder="alex-works"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Display name <span className="text-accent">*</span></label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Headline</label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Freelance product engineer"
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">Avatar URL (optional)</label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://…/me.jpg"
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-fg block">Short bio</label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="One or two lines visitors see under your name."
                className="w-full p-3 rounded-xl border border-line bg-surface/50 text-fg placeholder:text-muted/60 text-xs sm:text-sm focus:border-accent focus:bg-card focus:outline-none transition-all resize-y"
              />
            </div>
          </Card>

          {/* Template picker */}
          <Card className="p-5 sm:p-6 rounded-2xl border border-line bg-card space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-1 border-b border-line/50">
              <h2 className="text-sm font-medium text-fg">Template</h2>
              <span className="text-[11px] font-mono text-muted tracking-wider">6 designs</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {LINK_TEMPLATES.map((t) => {
                const activeT = template === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTemplate(t.key)}
                    className={`text-left rounded-xl border p-3 transition-all cursor-pointer ${
                      activeT
                        ? "border-accent ring-2 ring-accent/25 bg-accent-soft/40"
                        : "border-line bg-surface/50 hover:border-line-strong"
                    }`}
                  >
                    <div className="h-14 rounded-lg overflow-hidden border border-line/60 mb-2 pointer-events-none">
                      <div className="origin-top-left scale-[0.22] w-[455%]">
                        <LinkPageRender template={t.key} inert data={{ display_name: "A B", headline: "Headline", items: [
                          { id: "1", label: "Portfolio", url: "#", icon: null, description: null },
                          { id: "2", label: "Booking", url: "#", icon: null, description: null },
                        ] }} />
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-fg">{t.name}</div>
                    <div className="text-[10px] text-muted mt-0.5 leading-snug">{t.blurb}</div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Links editor */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-fg">Links ({items.length})</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setItems((prev) => [...prev, { key: newKey(), ...EMPTY_ITEM }])}
                className="border-line text-fg"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add link
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-faint text-center py-6">
                No links yet — add Portfolio, Booking, GitHub, Buy me a coffee… whatever you want on one page.
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((it, idx) => (
                  <div key={it.key} className={`rounded-xl border p-3.5 space-y-2.5 ${it.active ? "border-line bg-surface/40" : "border-line/60 bg-surface/20 opacity-60"}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={it.icon}
                        onChange={(e) => updateItem(it.key, { icon: e.target.value.slice(0, 8) })}
                        placeholder="🙂"
                        title="Emoji icon (optional)"
                        className="w-12 h-9 shrink-0 px-1 text-center rounded-lg border border-line bg-bg text-fg text-sm focus:border-accent focus:outline-none"
                      />
                      <input
                        type="text"
                        value={it.label}
                        onChange={(e) => updateItem(it.key, { label: e.target.value })}
                        placeholder="Label — e.g. My Portfolio"
                        className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-line bg-bg text-fg text-sm focus:border-accent focus:outline-none"
                      />
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                          className="p-1.5 rounded-lg text-faint hover:text-fg hover:bg-surface disabled:opacity-30" title="Move up">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}
                          className="p-1.5 rounded-lg text-faint hover:text-fg hover:bg-surface disabled:opacity-30" title="Move down">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => removeItem(it.key)}
                          className="p-1.5 rounded-lg text-faint hover:text-danger hover:bg-danger/10" title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={it.url}
                      onChange={(e) => updateItem(it.key, { url: e.target.value })}
                      placeholder="https://…"
                      className="w-full h-9 px-3 rounded-lg border border-line bg-bg text-fg text-xs font-mono focus:border-accent focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={it.description}
                        onChange={(e) => updateItem(it.key, { description: e.target.value })}
                        placeholder="Short description (optional)"
                        className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-line bg-bg text-fg text-xs focus:border-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => updateItem(it.key, { active: !it.active })}
                        className={`shrink-0 h-9 px-3 rounded-lg border text-xs font-medium transition-all ${
                          it.active ? "bg-accent-soft text-accent border-accent/30" : "bg-surface text-muted border-line"
                        }`}
                      >
                        {it.active ? "Visible" : "Hidden"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: sticky live preview */}
        <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-6">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted">Live Preview</span>
            <span className="text-[11px] font-mono text-muted">{LINK_TEMPLATES.find((t) => t.key === template)?.name}</span>
          </div>
          <Card className="rounded-2xl border-line bg-card p-3 shadow-xs overflow-hidden">
            <div className="rounded-xl overflow-hidden border border-line/60 max-h-[620px] overflow-y-auto">
              <LinkPageRender template={template} data={previewData} inert />
            </div>
          </Card>
          {published && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full h-10 rounded-xl border border-line bg-surface/60 text-fg text-xs font-medium hover:border-line-strong transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" /> {publicUrl}
            </a>
          )}
        </div>
      </div>

      {/* Analytics dashboard */}
      <LinkPageStatsPanel />
    </div>
  );
}
