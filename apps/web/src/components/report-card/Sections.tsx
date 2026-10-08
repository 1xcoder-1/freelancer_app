"use client";

import React, { createElement, useState, useMemo } from "react";
import type { SectionItem, WritingItem, QuoteItem, FooterContent, ProjectItem } from "@/lib/api";
import { ICON_KEYS, ITEM_COLORS, newItemId, resolveIcon, blankInspirationItem, blankProjectItem } from "./constants";
import { BRAND_SVGS, COMPANY_PRESETS, type CompanyPreset } from "./brand-logos";
import {
  Plus,
  Trash2,
  GripVertical,
  X,
  Search,
  ExternalLink,
  Globe,
  Sparkles,
  Image as ImageIcon,
  Check,
  FolderGit2,
  Layers,
  Code2,
  Palette,
  Smartphone,
  Tag,
  ArrowUpRight,
} from "@/components/animated-icons";

// ----------------------------------------------------------------------------
// Shared primitives
// ----------------------------------------------------------------------------
export function SectionShell({
  label,
  editing,
  onAdd,
  addLabel = "Add item",
  children,
}: {
  label: string;
  editing?: boolean;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-10">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-faint">
          {label}
        </p>
        {editing && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent-hi transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {addLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export function DottedDivider() {
  return <div className="border-t border-dotted border-line-strong mt-10" />;
}

/**
 * Universal logo & icon glyph renderer:
 * 1. Custom image if logo_url is provided
 * 2. Authentic Brand SVG if icon matches brand library (Cursor, Replit, Neon, etc.)
 * 3. Lucide vector icon from ICON_LIBRARY
 */
export function BrandGlyph({
  icon,
  logoUrl,
  className = "w-4.5 h-4.5",
}: {
  icon: string;
  logoUrl?: string | null;
  className?: string;
}) {
  if (logoUrl && (logoUrl.startsWith("http") || logoUrl.startsWith("data:") || logoUrl.startsWith("/"))) {
    return (
      <img
        src={logoUrl}
        alt={icon || "logo"}
        className={`${className} object-contain rounded-sm`}
        onError={(e) => {
          // Fallback if image fails
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  const normalizedKey = (icon || "").toLowerCase().trim();
  const BrandSvg = BRAND_SVGS[normalizedKey];
  if (BrandSvg) {
    return <BrandSvg className={className} />;
  }

  return createElement(resolveIcon(icon), { className });
}

// ----------------------------------------------------------------------------
// Interactive Logo & Company Preset Picker with Live Search
// ----------------------------------------------------------------------------
function LogoAndIconPicker({
  icon,
  color,
  logoUrl,
  isCompanySection = false,
  onChange,
  onSelectPreset,
}: {
  icon: string;
  color: string;
  logoUrl?: string | null;
  isCompanySection?: boolean;
  onChange: (next: { icon: string; color: string; logo_url?: string | null }) => void;
  onSelectPreset?: (preset: CompanyPreset) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"companies" | "icons" | "custom">(
    isCompanySection ? "companies" : "icons"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [customUrlInput, setCustomUrlInput] = useState(logoUrl || "");

  React.useEffect(() => {
    setCustomUrlInput(logoUrl || "");
  }, [logoUrl]);

  const filteredPresets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return COMPANY_PRESETS;
    return COMPANY_PRESETS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.keywords?.some((k) => k.includes(q))
    );
  }, [searchQuery]);

  const handleSelectPreset = (preset: CompanyPreset) => {
    if (onSelectPreset) {
      onSelectPreset(preset);
    } else {
      onChange({
        icon: preset.icon,
        color: preset.color,
        logo_url: null,
      });
    }
    setOpen(false);
  };

  const handleSaveCustomUrl = () => {
    const trimmed = customUrlInput.trim();
    onChange({
      icon: "globe",
      color: color,
      logo_url: trimmed || null,
    });
    setOpen(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Click to search logos, change color or icon"
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform hover:scale-105 cursor-pointer ring-1 ring-white/10"
        style={{ backgroundColor: color }}
      >
        <BrandGlyph icon={icon} logoUrl={logoUrl} className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-50 w-80 md:w-96 rounded-2xl bg-card border border-line p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in-50 zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-surface border border-line text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("companies")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  activeTab === "companies"
                    ? "bg-card text-fg shadow-xs"
                    : "text-muted hover:text-fg"
                }`}
              >
                Brand Logos
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("icons")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  activeTab === "icons"
                    ? "bg-card text-fg shadow-xs"
                    : "text-muted hover:text-fg"
                }`}
              >
                Icons
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("custom")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  activeTab === "custom"
                    ? "bg-card text-fg shadow-xs"
                    : "text-muted hover:text-fg"
                }`}
              >
                Custom URL
              </button>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-faint hover:text-fg hover:bg-surface transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab: Brand Logos with Live Search */}
          {activeTab === "companies" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 25+ companies (Cursor, Replit, Neon...)"
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-line text-xs text-fg placeholder:text-faint focus:outline-hidden focus:border-accent"
                />
              </div>

              <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
                {filteredPresets.map((preset) => {
                  const isSelected = icon === preset.icon;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                        isSelected
                          ? "bg-accent-soft border border-accent/30 text-fg"
                          : "hover:bg-surface text-muted hover:text-fg"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-white shadow-xs"
                          style={{ backgroundColor: preset.color }}
                        >
                          <BrandGlyph icon={preset.icon} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-fg truncate">
                            {preset.name}
                          </p>
                          <p className="text-[11px] text-faint truncate">
                            {preset.category}
                          </p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
                    </button>
                  );
                })}
                {filteredPresets.length === 0 && (
                  <p className="text-xs text-faint text-center py-4 italic">
                    No matching companies found. Try a different search or use the Icons tab.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tab: General Icons & Color Swatches */}
          {activeTab === "icons" && (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-faint mb-1.5">
                  Pick Icon
                </p>
                <div className="grid grid-cols-8 gap-1 max-h-36 overflow-y-auto p-1">
                  {ICON_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        onChange({ icon: key, color, logo_url: null });
                        setOpen(false);
                      }}
                      className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        key === icon && !logoUrl
                          ? "bg-accent-soft text-accent ring-1 ring-accent"
                          : "text-muted hover:bg-surface hover:text-fg"
                      }`}
                    >
                      <BrandGlyph icon={key} className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-dotted border-line pt-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-faint mb-1.5">
                  Tile Color
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {ITEM_COLORS.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => onChange({ icon, color: swatch, logo_url: logoUrl })}
                      title={swatch}
                      className={`w-6 h-6 rounded-full transition-transform hover:scale-110 cursor-pointer ${
                        swatch === color
                          ? "ring-2 ring-offset-2 ring-fg ring-offset-card"
                          : ""
                      }`}
                      style={{ backgroundColor: swatch }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab: Custom Image Logo URL */}
          {activeTab === "custom" && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-fg block mb-1">
                  Direct Logo URL (PNG, SVG, JPG)
                </label>
                <input
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSaveCustomUrl();
                    }
                  }}
                  placeholder="https://example.com/logo.svg"
                  className="w-full px-3 py-1.5 rounded-lg bg-surface border border-line text-xs text-fg placeholder:text-faint focus:outline-hidden focus:border-accent"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleSaveCustomUrl}
                  className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg text-xs font-semibold transition-all cursor-pointer"
                >
                  Save Logo URL
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ItemRowShell({
  editing,
  onRemove,
  children,
}: {
  editing?: boolean;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`group flex items-start gap-4 ${
        editing ? "rounded-2xl border border-dashed border-line p-3.5 bg-surface/30" : ""
      }`}
    >
      {children}
      {editing && (
        <button
          type="button"
          onClick={onRemove}
          title="Remove item"
          className="mt-2.5 shrink-0 text-faint hover:text-danger transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Vertical list sections (Things I do / Work with me)
// ----------------------------------------------------------------------------
export function ItemList({
  items,
  editing,
  onChange,
}: {
  items: SectionItem[];
  editing?: boolean;
  onChange: (next: SectionItem[]) => void;
}) {
  const patch = (idx: number, part: Partial<SectionItem>) => {
    onChange(items.map((item, i) => (i === idx ? { ...item, ...part } : item)));
  };

  if (!items.length) {
    return (
      <p className="text-sm text-faint italic">
        Nothing here yet
        {editing ? " — use “Add item” to write your first one." : "."}
      </p>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-7">
      {items.map((item, idx) => {
        const hasValidLink = Boolean(item.link && item.link.trim().length > 0);

        if (editing) {
          return (
            <div
              key={item.id || idx}
              className="group rounded-2xl border border-dashed border-line p-4 bg-surface/30 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <LogoAndIconPicker
                    icon={item.icon}
                    color={item.color}
                    logoUrl={item.logo_url}
                    onChange={(next) => patch(idx, next)}
                    onSelectPreset={(preset) => {
                      patch(idx, {
                        icon: preset.icon,
                        color: preset.color,
                        logo_url: null,
                        title: item.title ? item.title : preset.name,
                        description: item.description ? item.description : preset.description,
                        link: item.link ? item.link : preset.link,
                      });
                    }}
                  />
                  <input
                    className="input-line font-semibold text-[15px] flex-1"
                    value={item.title}
                    placeholder="Title (e.g. Design Engineering and Taste)"
                    onChange={(e) => patch(idx, { title: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, i) => i !== idx))}
                  title="Remove item"
                  className="p-1.5 rounded-lg text-faint hover:text-danger hover:bg-surface transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <textarea
                rows={2}
                className="input-line text-muted text-[13.5px] leading-relaxed resize-y"
                value={item.description}
                placeholder="Description (e.g. I break down designs, talk about developing design taste...)"
                onChange={(e) => patch(idx, { description: e.target.value })}
              />

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-medium text-fg flex items-center gap-1">
                    <Globe className="w-3 h-3 text-accent" />
                    Destination Link <span className="text-accent font-bold">* Required</span>
                  </span>
                </div>
                <input
                  className={`input-line text-xs font-mono ${
                    !hasValidLink
                      ? "border-amber-500/50 bg-amber-500/5 text-amber-200 placeholder:text-amber-400/50"
                      : "text-fg"
                  }`}
                  value={item.link || ""}
                  placeholder="https://your-website.com (Required)"
                  required
                  onChange={(e) => patch(idx, { link: e.target.value })}
                />
              </div>
            </div>
          );
        }

        // View Mode: 100% Match with reference screenshot
        return (
          <div key={item.id || idx} className="group/item">
            {/* Top row: Squircle 3D Icon Badge + Title */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] sm:rounded-[9px] flex items-center justify-center text-white shadow-xs shrink-0 border border-white/20 transition-transform group-hover/item:scale-105"
                style={{
                  backgroundColor: item.color || "#84cc16",
                  backgroundImage: `linear-gradient(135deg, ${item.color || "#84cc16"} 0%, rgba(0,0,0,0.2) 100%)`,
                }}
              >
                <BrandGlyph
                  icon={item.icon}
                  logoUrl={item.logo_url}
                  className="w-4 h-4 text-white drop-shadow-xs"
                />
              </div>

              {item.link ? (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[16px] sm:text-[17px] leading-tight text-fg hover:text-accent transition-colors flex items-center gap-1.5 tracking-tight"
                >
                  <span>{item.title}</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover/item:opacity-100 transition-opacity text-accent shrink-0" />
                </a>
              ) : (
                <h3 className="font-semibold text-[16px] sm:text-[17px] leading-tight text-fg tracking-tight">
                  {item.title}
                </h3>
              )}
            </div>

            {/* Bottom row: Description flush underneath */}
            {item.description ? (
              <p className="mt-1.5 text-[14px] sm:text-[14.5px] leading-relaxed text-muted font-normal">
                {item.description}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Companies grid (3 columns in reference design) with Brand Logo support
// ----------------------------------------------------------------------------
export function CompanyGrid({
  items,
  editing,
  onChange,
}: {
  items: SectionItem[];
  editing?: boolean;
  onChange: (next: SectionItem[]) => void;
}) {
  const patch = (idx: number, part: Partial<SectionItem>) => {
    onChange(items.map((item, i) => (i === idx ? { ...item, ...part } : item)));
  };

  if (!items.length) {
    return (
      <p className="text-sm text-faint italic">
        Nothing here yet
        {editing ? " — add the companies you've worked with." : "."}
      </p>
    );
  }

  return (
    <div
      className={`grid gap-y-6 gap-x-8 ${
        editing
          ? "grid-cols-1 md:grid-cols-2"
          : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
      }`}
    >
      {items.map((item, idx) => {
        const hasValidLink = Boolean(item.link && item.link.trim().length > 0);

        return (
          <div key={item.id || idx} className="group relative">
            {editing ? (
              <div className="flex items-start gap-3 rounded-2xl border border-dashed border-line p-3.5 bg-surface/30">
                <LogoAndIconPicker
                  icon={item.icon}
                  color={item.color}
                  logoUrl={item.logo_url}
                  isCompanySection={true}
                  onChange={(next) => patch(idx, next)}
                  onSelectPreset={(preset) => {
                    patch(idx, {
                      icon: preset.icon,
                      color: preset.color,
                      logo_url: null,
                      title: preset.name,
                      description: preset.description,
                      link: preset.link,
                    });
                  }}
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    className="input-line font-semibold text-[14px]"
                    value={item.title}
                    placeholder="Company Name (e.g. Cursor, Neon)"
                    onChange={(e) => patch(idx, { title: e.target.value })}
                  />
                  <input
                    className="input-line text-xs text-muted"
                    value={item.description}
                    placeholder="What they do / what you did"
                    onChange={(e) =>
                      patch(idx, { description: e.target.value })
                    }
                  />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-medium text-fg flex items-center gap-1">
                        <Globe className="w-3 h-3 text-accent" />
                        Company URL <span className="text-accent font-bold">* Required</span>
                      </span>
                    </div>
                    <input
                      className={`input-line text-xs font-mono ${
                        !hasValidLink
                          ? "border-amber-500/50 bg-amber-500/5 text-amber-200 placeholder:text-amber-400/50"
                          : "text-fg"
                      }`}
                      value={item.link || ""}
                      placeholder="https://company.com (Required)"
                      required
                      onChange={(e) => patch(idx, { link: e.target.value })}
                    />
                    {!hasValidLink && (
                      <p className="text-[10px] text-amber-400">
                        * Required: Add company link (e.g. https://cursor.com)
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, i) => i !== idx))}
                  className="mt-1 text-faint hover:text-danger transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-white shadow-xs"
                    style={{ backgroundColor: item.color }}
                  >
                    <BrandGlyph icon={item.icon} logoUrl={item.logo_url} className="w-4.5 h-4.5" />
                  </div>
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="group/link inline-flex items-center gap-1 font-semibold text-[14.5px] text-fg hover:text-accent transition-colors"
                    >
                      <span>{item.title}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity text-accent" />
                    </a>
                  ) : (
                    <span className="font-semibold text-[14.5px] text-fg">{item.title}</span>
                  )}
                </div>
                <p className="mt-2 text-[13px] text-muted leading-relaxed">
                  {item.description}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Writing list (title left, date right)
// ----------------------------------------------------------------------------
export function WritingList({
  items,
  editing,
  onChange,
}: {
  items: WritingItem[];
  editing?: boolean;
  onChange: (next: WritingItem[]) => void;
}) {
  const patch = (idx: number, part: Partial<WritingItem>) => {
    onChange(items.map((item, i) => (i === idx ? { ...item, ...part } : item)));
  };

  if (!items.length) {
    return (
      <p className="text-sm text-faint italic">
        Nothing here yet{editing ? " — add your first article." : "."}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item, idx) => {
        const hasValidLink = Boolean(item.link && item.link.trim().length > 0);

        return (
          <div
            key={item.id || idx}
            className={`flex items-center gap-3 ${
              editing
                ? "rounded-2xl border border-dashed border-line p-3.5 bg-surface/30"
                : "py-2"
            }`}
          >
            {editing && <GripVertical className="w-4 h-4 text-faint shrink-0" />}
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <input
                    className="input-line flex-1 text-sm font-medium"
                    value={item.title}
                    placeholder="Article title"
                    onChange={(e) => patch(idx, { title: e.target.value })}
                  />
                  <input
                    className="input-line md:w-32 font-mono text-xs"
                    value={item.date}
                    placeholder="24-03-2022"
                    onChange={(e) => patch(idx, { date: e.target.value })}
                  />
                  <input
                    className={`input-line md:w-56 font-mono text-xs ${
                      !hasValidLink
                        ? "border-amber-500/50 bg-amber-500/5 text-amber-200 placeholder:text-amber-400/50"
                        : "text-fg"
                    }`}
                    value={item.link || ""}
                    placeholder="https://article-url.com (Required)"
                    required
                    onChange={(e) => patch(idx, { link: e.target.value })}
                  />
                </div>
              ) : item.link ? (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group/link inline-flex items-center gap-1.5 text-fg hover:text-accent transition-colors truncate block"
                >
                  <span className="truncate">{item.title}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity text-accent" />
                </a>
              ) : (
                <span className="text-fg truncate block">{item.title}</span>
              )}
            </div>
            {!editing && (
              <span className="shrink-0 text-[11px] font-mono text-faint">
                {item.date}
              </span>
            )}
            {editing && (
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="shrink-0 text-faint hover:text-danger transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Factory helpers used by the "Add" buttons
// ----------------------------------------------------------------------------
export function blankSectionItem(): SectionItem {
  return {
    id: newItemId(),
    title: "",
    description: "",
    link: "",
    icon: "zap",
    color: ITEM_COLORS[0],
    logo_url: null,
  };
}

export function blankWritingItem(): WritingItem {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  return {
    id: newItemId(),
    title: "",
    date: `${dd}-${mm}-${today.getFullYear()}`,
    link: "",
  };
}

// ----------------------------------------------------------------------------
// Inspiration List (100% pixel-perfect match with reference design)
// ----------------------------------------------------------------------------
export function InspirationList({
  items,
  introParagraphs,
  editing,
  onAdd,
  onChange,
  onIntroChange,
}: {
  items: SectionItem[];
  introParagraphs?: string[];
  editing?: boolean;
  onAdd?: () => void;
  onChange: (next: SectionItem[]) => void;
  onIntroChange?: (nextIntro: string[]) => void;
}) {
  const patch = (idx: number, part: Partial<SectionItem>) => {
    onChange(items.map((item, i) => (i === idx ? { ...item, ...part } : item)));
  };

  const defaultIntro = [
    "A list of all the people that I look up to, websites that I admire, tools that I use and everything else that follows.",
    "I will keep on updating this list as I find more inspiration.",
  ];

  const currentIntro = introParagraphs && introParagraphs.length > 0 ? introParagraphs : defaultIntro;

  return (
    <div className="pt-10 sm:pt-11">
      {/* Small clean section heading like About section */}
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-faint">
          Influences
        </p>
        {editing && onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent-hi transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add inspiration
          </button>
        )}
      </div>

      {/* Intro Text Paragraphs */}
      {editing ? (
        <div className="rounded-2xl border border-dashed border-line p-4 bg-surface/30 space-y-3 mb-7">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-faint">
              Inspiration Intro Text
            </span>
            <button
              type="button"
              onClick={() => onIntroChange?.([...currentIntro, ""])}
              className="text-xs font-semibold text-accent hover:text-accent-hi transition-colors cursor-pointer"
            >
              + Add Paragraph
            </button>
          </div>
          {currentIntro.map((paragraph, pIdx) => (
            <div key={pIdx} className="flex items-start gap-2">
              <textarea
                rows={2}
                className="input-line text-[14px] leading-relaxed flex-1 resize-y"
                value={paragraph}
                placeholder="Write intro paragraph..."
                onChange={(e) => {
                  const updated = [...currentIntro];
                  updated[pIdx] = e.target.value;
                  onIntroChange?.(updated);
                }}
              />
              {currentIntro.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const updated = currentIntro.filter((_, i) => i !== pIdx);
                    onIntroChange?.(updated);
                  }}
                  className="p-1 text-faint hover:text-danger transition-colors cursor-pointer mt-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 mb-7 sm:mb-8 text-[15px] sm:text-[15.5px] leading-relaxed text-muted font-normal">
          {currentIntro.map((paragraph, pIdx) => (
            <p key={pIdx}>{paragraph}</p>
          ))}
        </div>
      )}

      {/* Dotted Divider directly below intro text */}
      <div className="border-t border-dotted border-line-strong my-8 sm:my-9" />

      {/* Inspiration Item Rows */}
      {items.length === 0 && !editing ? (
        <p className="text-sm text-faint italic pt-2">
          No inspiration entries yet.
        </p>
      ) : (
        <div className="space-y-4 sm:space-y-4.5">
          {items.map((item, idx) => {
            const hasValidLink = Boolean(item.link && item.link.trim().length > 0);

            if (editing) {
              return (
                <div
                  key={item.id || idx}
                  className="rounded-2xl border border-dashed border-line p-4 bg-surface/30 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <LogoAndIconPicker
                        icon={item.icon}
                        color={item.color}
                        logoUrl={item.logo_url}
                        isCompanySection={true}
                        onChange={(next) => patch(idx, next)}
                        onSelectPreset={(preset) => {
                          patch(idx, {
                            icon: preset.icon,
                            color: preset.color,
                            logo_url: null,
                            title: item.title ? item.title : preset.name,
                            description: item.description ? item.description : preset.description,
                            link: item.link ? item.link : preset.link,
                          });
                        }}
                      />
                      <input
                        className="input-line font-medium text-[15px] flex-1"
                        value={item.title}
                        placeholder="Name / Brand (e.g. Klack, Shadcn UI)"
                        onChange={(e) => patch(idx, { title: e.target.value })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onChange(items.filter((_, i) => i !== idx))}
                      className="p-1.5 rounded-lg text-faint hover:text-danger hover:bg-surface transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    className="input-line text-muted text-[13.5px] leading-relaxed"
                    value={item.description}
                    placeholder="Short description / tagline (e.g. Neat product and website)"
                    onChange={(e) => patch(idx, { description: e.target.value })}
                  />

                  <div className="space-y-1">
                    <span className="text-[11px] font-mono text-muted flex items-center gap-1">
                      <Globe className="w-3 h-3 text-accent" />
                      Destination Link URL
                    </span>
                    <input
                      className={`input-line text-xs font-mono ${
                        !hasValidLink
                          ? "border-amber-500/50 bg-amber-500/5 text-amber-200 placeholder:text-amber-400/50"
                          : "text-fg"
                      }`}
                      value={item.link || ""}
                      placeholder="https://example.com"
                      onChange={(e) => patch(idx, { link: e.target.value })}
                    />
                  </div>
                </div>
              );
            }

            // View Mode: 100% exact match with image
            return (
              <div
                key={item.id || idx}
                className="group/insp flex items-center gap-3.5 transition-opacity"
              >
                {/* Square/Squircle Logo */}
                <div
                  className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 border border-line/70 bg-surface/80 overflow-hidden shadow-2xs transition-transform group-hover/insp:scale-105"
                  style={{
                    backgroundColor: item.color || "#18181b",
                  }}
                >
                  <BrandGlyph
                    icon={item.icon}
                    logoUrl={item.logo_url}
                    className="w-4.5 h-4.5 text-fg"
                  />
                </div>

                {/* Name · Tagline on single line */}
                <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-[15px] sm:text-[15.5px] leading-normal min-w-0">
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-fg hover:text-accent transition-colors flex items-center gap-1 group-hover/insp:text-accent"
                    >
                      <span>{item.title}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover/insp:opacity-100 transition-opacity text-accent shrink-0" />
                    </a>
                  ) : (
                    <span className="font-medium text-fg">{item.title}</span>
                  )}
                  <span className="text-muted/50 select-none">·</span>
                  <span className="text-muted font-normal">{item.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Projects Section with Category Filters & Freelance Portfolios
// ----------------------------------------------------------------------------
export const PROJECT_CATEGORIES = [
  "All",
  "Web Dev",
  "App Dev",
  "UI/UX Design",
  "Graphic Design",
  "AI Tools",
] as const;

export function ProjectGrid({
  items,
  introParagraphs,
  editing,
  onAdd,
  onChange,
  onIntroChange,
}: {
  items: ProjectItem[];
  introParagraphs?: string[];
  editing?: boolean;
  onAdd?: () => void;
  onChange: (next: ProjectItem[]) => void;
  onIntroChange?: (nextIntro: string[]) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const patch = (idx: number, part: Partial<ProjectItem>) => {
    onChange(items.map((item, i) => (i === idx ? { ...item, ...part } : item)));
  };

  const defaultIntro = [
    "Selected freelance and personal projects across Web Development, Mobile Apps, UI/UX Design, and Graphic Design.",
    "Each project is crafted with high attention to detail, performance, and user experience.",
  ];

  const currentIntro = introParagraphs && introParagraphs.length > 0 ? introParagraphs : defaultIntro;

  const filteredItems = useMemo(() => {
    if (selectedCategory === "All") return items;
    return items.filter(
      (item) => (item.category || "").toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [items, selectedCategory]);

  return (
    <div className="pt-10 sm:pt-11">
      {/* Small clean section heading like About section */}
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-faint">
          Works
        </p>
        {editing && onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent-hi transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add project
          </button>
        )}
      </div>

      {/* Intro Text */}
      {editing ? (
        <div className="rounded-2xl border border-dashed border-line p-4 bg-surface/30 space-y-3 mb-7">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-faint">
              Projects Intro Text
            </span>
            <button
              type="button"
              onClick={() => onIntroChange?.([...currentIntro, ""])}
              className="text-xs font-semibold text-accent hover:text-accent-hi transition-colors cursor-pointer"
            >
              + Add Paragraph
            </button>
          </div>
          {currentIntro.map((paragraph, pIdx) => (
            <div key={pIdx} className="flex items-start gap-2">
              <textarea
                rows={2}
                className="input-line text-[14px] leading-relaxed flex-1 resize-y"
                value={paragraph}
                placeholder="Write intro paragraph..."
                onChange={(e) => {
                  const updated = [...currentIntro];
                  updated[pIdx] = e.target.value;
                  onIntroChange?.(updated);
                }}
              />
              {currentIntro.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const updated = currentIntro.filter((_, i) => i !== pIdx);
                    onIntroChange?.(updated);
                  }}
                  className="p-1 text-faint hover:text-danger transition-colors cursor-pointer mt-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 mb-7 sm:mb-8 text-[15px] sm:text-[15.5px] leading-relaxed text-muted font-normal">
          {currentIntro.map((paragraph, pIdx) => (
            <p key={pIdx}>{paragraph}</p>
          ))}
        </div>
      )}

      {/* Dotted Divider directly below intro text */}
      <div className="border-t border-dotted border-line-strong my-8 sm:my-9" />

      {/* Category Filter Pills (View Mode) */}
      {!editing && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-6 scrollbar-none">
          {PROJECT_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  active
                    ? "bg-fg text-bg shadow-xs"
                    : "bg-surface border border-line text-muted hover:text-fg hover:border-line-strong"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Project Cards Grid */}
      {filteredItems.length === 0 && !editing ? (
        <p className="text-sm text-faint italic py-4">
          No projects found in this category.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {filteredItems.map((item, idx) => {
            const hasValidLink = Boolean(item.link && item.link.trim().length > 0);

            if (editing) {
              return (
                <div
                  key={item.id || idx}
                  className="rounded-2xl border border-dashed border-line p-4 bg-surface/30 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <LogoAndIconPicker
                          icon={item.icon}
                          color={item.color}
                          logoUrl={item.logo_url}
                          onChange={(next) => patch(idx, next)}
                        />
                        <input
                          className="input-line font-semibold text-[15px] flex-1"
                          value={item.title}
                          placeholder="Project Title"
                          onChange={(e) => patch(idx, { title: e.target.value })}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => onChange(items.filter((_, i) => i !== idx))}
                        className="p-1 text-faint hover:text-danger transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-mono text-muted block mb-1">
                          Category
                        </label>
                        <select
                          className="input-line text-xs w-full bg-surface"
                          value={item.category || "Web Dev"}
                          onChange={(e) => patch(idx, { category: e.target.value })}
                        >
                          {PROJECT_CATEGORIES.filter((c) => c !== "All").map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-muted block mb-1">
                          Year
                        </label>
                        <input
                          className="input-line text-xs font-mono w-full"
                          value={item.year || ""}
                          placeholder="2024"
                          onChange={(e) => patch(idx, { year: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-muted block mb-1">
                        Destination Link
                      </label>
                      <input
                        className={`input-line text-xs font-mono w-full ${
                          !hasValidLink
                            ? "border-amber-500/50 bg-amber-500/5 text-amber-200 placeholder:text-amber-400/50"
                            : "text-fg"
                        }`}
                        value={item.link || ""}
                        placeholder="https://example.com"
                        onChange={(e) => patch(idx, { link: e.target.value })}
                      />
                    </div>

                    <textarea
                      rows={2}
                      className="input-line text-muted text-[13px] leading-relaxed w-full resize-y"
                      value={item.description}
                      placeholder="Project description and impact..."
                      onChange={(e) => patch(idx, { description: e.target.value })}
                    />

                    <div>
                      <label className="text-[10px] font-mono text-muted block mb-1">
                        Tags (comma-separated)
                      </label>
                      <input
                        className="input-line text-xs font-mono w-full"
                        value={(item.tags || []).join(", ")}
                        placeholder="Next.js, TypeScript, Figma"
                        onChange={(e) =>
                          patch(idx, {
                            tags: e.target.value
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            }

            // View Mode
            return (
              <div
                key={item.id || idx}
                className="group relative rounded-2xl border border-line/80 bg-card/60 p-4 sm:p-5 hover:border-line-strong hover:bg-surface/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-[8px] flex items-center justify-center text-white shrink-0 border border-white/10 shadow-xs"
                        style={{
                          backgroundColor: item.color || "#3b82f6",
                          backgroundImage: `linear-gradient(135deg, ${item.color || "#3b82f6"} 0%, rgba(0,0,0,0.2) 100%)`,
                        }}
                      >
                        <BrandGlyph icon={item.icon} logoUrl={item.logo_url} className="w-4 h-4 text-white" />
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-surface border border-line text-[11px] font-mono text-muted">
                        {item.category || "Freelance"}
                      </span>
                    </div>

                    {item.year && (
                      <span className="text-[11px] font-mono text-faint shrink-0">
                        {item.year}
                      </span>
                    )}
                  </div>

                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-[16px] text-fg hover:text-accent transition-colors group/title"
                    >
                      <span className="group-hover/title:underline underline-offset-4 decoration-dotted">
                        {item.title}
                      </span>
                      <ArrowUpRight className="w-4 h-4 text-muted group-hover/title:text-accent transition-transform group-hover/title:translate-x-0.5 group-hover/title:-translate-y-0.5" />
                    </a>
                  ) : (
                    <h3 className="font-semibold text-[16px] text-fg">
                      {item.title}
                    </h3>
                  )}

                  {item.description && (
                    <p className="mt-2 text-[13.5px] leading-relaxed text-muted font-normal">
                      {item.description}
                    </p>
                  )}
                </div>

                {item.tags && item.tags.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-dotted border-line/60 flex items-center gap-1.5 flex-wrap">
                    {item.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-2 py-0.5 rounded-md bg-surface/80 text-[10.5px] font-mono text-muted"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Motivational Quote & Thoughts Section
// ----------------------------------------------------------------------------
export function QuoteSection({
  quote,
  editing,
  onChange,
}: {
  quote?: QuoteItem | null;
  editing?: boolean;
  onChange: (next: QuoteItem | null) => void;
}) {
  const emojis = ["⚡", "✨", "🔥", "💡", "🎯", "🚀", "💎", "🌟", "🧠", "🌱", "🛠️", "☕", "❤️", "🏆"];

  if (!quote && !editing) {
    return null;
  }

  const currentQuote: QuoteItem = quote || {
    text: "",
    author: "",
    emoji: "⚡",
  };

  return (
    <SectionShell
      label="Motivational Thoughts & Creed"
      editing={editing}
      addLabel={quote ? undefined : "Add quote"}
      onAdd={() =>
        onChange({
          text: "Ship quality code, stay curious, and build things that genuinely help people move faster.",
          author: "Daily Manifesto",
          emoji: "⚡",
        })
      }
    >
      {editing ? (
        <div className="rounded-2xl border border-dashed border-line p-4 bg-surface/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-faint">Icon Mood</span>
              <div className="flex items-center gap-1">
                {emojis.slice(0, 7).map((emo) => (
                  <button
                    key={emo}
                    type="button"
                    onClick={() => onChange({ ...currentQuote, emoji: emo })}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-transform cursor-pointer ${
                      currentQuote.emoji === emo
                        ? "bg-accent-soft ring-1 ring-accent scale-110"
                        : "hover:bg-surface"
                    }`}
                  >
                    {emo}
                  </button>
                ))}
              </div>
            </div>
            {quote && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-xs text-faint hover:text-danger flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove quote
              </button>
            )}
          </div>

          <textarea
            rows={2}
            className="input-line text-[15px] italic leading-relaxed w-full resize-y"
            value={currentQuote.text}
            placeholder="Write an inspirational quote, mindset tip, or daily manifesto..."
            onChange={(e) => onChange({ ...currentQuote, text: e.target.value })}
          />

          <input
            className="input-line text-xs font-mono text-muted w-full"
            value={currentQuote.author}
            placeholder="Author / Attribution (e.g. Steve Jobs, Personal Motto, Daily Creed)"
            onChange={(e) => onChange({ ...currentQuote, author: e.target.value })}
          />
        </div>
      ) : (
        <div className="relative rounded-2xl border border-line/80 bg-card/60 p-5 md:p-6 backdrop-blur-xs transition-all hover:border-line-strong group">
          <div className="flex items-start gap-3.5">
            <span className="text-2xl select-none shrink-0 mt-0.5">
              {currentQuote.emoji || "⚡"}
            </span>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-[15px] md:text-[16px] italic text-fg/90 leading-relaxed">
                “{currentQuote.text}”
              </p>
              {currentQuote.author && (
                <p className="text-xs font-mono text-muted/80 tracking-wide">
                  — {currentQuote.author}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </SectionShell>
  );
}

// ----------------------------------------------------------------------------
// Footer section with editable signature and attribution links
// ----------------------------------------------------------------------------
export function FooterSection({
  footer,
  displayName,
  editing,
  onChange,
}: {
  footer?: FooterContent | null;
  displayName: string;
  editing?: boolean;
  onChange: (next: FooterContent | null) => void;
}) {
  const defaultSignature = (displayName || "").split(" ")[0] || "Freelancer";
  const currentFooter: FooterContent = {
    signature_name: footer?.signature_name || defaultSignature,
    code_link: footer?.code_link || "https://github.com",
    video_link: footer?.video_link || "https://youtube.com",
    inspired_by_name: footer?.inspired_by_name || "Akash Bhadange",
    inspired_by_link: footer?.inspired_by_link || "https://bhadangeakash.com",
  };

  return (
    <div>
      <div className="pt-6">
        <DottedDivider />
      </div>

      {editing ? (
        <div className="pt-6 pb-4">
          <div className="rounded-2xl border border-dashed border-line p-4 bg-surface/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-faint">
                Footer & Signature Settings
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-muted block mb-1">
                  Signature Handwritten Name
                </label>
                <input
                  className="input-line text-sm font-medium"
                  value={currentFooter.signature_name}
                  placeholder="e.g. Manu"
                  onChange={(e) =>
                    onChange({ ...currentFooter, signature_name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-muted block mb-1">
                  Inspired By Creator Name
                </label>
                <input
                  className="input-line text-sm"
                  value={currentFooter.inspired_by_name}
                  placeholder="e.g. Akash Bhadange"
                  onChange={(e) =>
                    onChange({
                      ...currentFooter,
                      inspired_by_name: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-muted block mb-1">
                  Code Destination Link URL
                </label>
                <input
                  className="input-line text-xs font-mono"
                  value={currentFooter.code_link}
                  placeholder="https://github.com/..."
                  onChange={(e) =>
                    onChange({ ...currentFooter, code_link: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-muted block mb-1">
                  Video Destination Link URL
                </label>
                <input
                  className="input-line text-xs font-mono"
                  value={currentFooter.video_link}
                  placeholder="https://youtube.com/..."
                  onChange={(e) =>
                    onChange({ ...currentFooter, video_link: e.target.value })
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-mono text-muted block mb-1">
                  Inspired By Profile / Website URL
                </label>
                <input
                  className="input-line text-xs font-mono"
                  value={currentFooter.inspired_by_link}
                  placeholder="https://bhadangeakash.com"
                  onChange={(e) =>
                    onChange({
                      ...currentFooter,
                      inspired_by_link: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <footer className="pt-6 pb-4 text-center space-y-2">
          <p
            className="text-[34px] sm:text-[38px] leading-tight text-fg/90 select-none tracking-wide"
            style={{ fontFamily: "var(--font-signature), 'Caveat', cursive" }}
          >
            {currentFooter.signature_name}
          </p>
          <div className="space-y-1 text-[13.5px] leading-relaxed text-muted">
            <p>
              Built by yours truly. Here&apos;s the{" "}
              <a
                href={currentFooter.code_link || "https://github.com"}
                target="_blank"
                rel="noreferrer"
                className="text-fg font-normal border-b border-dotted border-fg/60 hover:text-accent hover:border-accent transition-colors pb-px"
              >
                code
              </a>{" "}
              and{" "}
              <a
                href={currentFooter.video_link || "https://youtube.com"}
                target="_blank"
                rel="noreferrer"
                className="text-fg font-normal border-b border-dotted border-fg/60 hover:text-accent hover:border-accent transition-colors pb-px"
              >
                video
              </a>{" "}
              explaining it.
            </p>
            <p>
              Website heavily inspired by{" "}
              <a
                href={
                  currentFooter.inspired_by_link ||
                  "https://bhadangeakash.com"
                }
                target="_blank"
                rel="noreferrer"
                className="text-fg font-normal border-b border-dotted border-fg/60 hover:text-accent hover:border-accent transition-colors pb-px"
              >
                {currentFooter.inspired_by_name || "Akash Bhadange"}
              </a>
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
