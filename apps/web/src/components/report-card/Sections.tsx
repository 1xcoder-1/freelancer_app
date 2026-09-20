"use client";

import React, { createElement, useState } from "react";
import { Plus, Trash2, GripVertical, X } from "lucide-react";
import type { SectionItem, WritingItem } from "@/lib/api";
import { ICON_KEYS, ITEM_COLORS, newItemId, resolveIcon } from "./constants";

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
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent-hi"
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
 * Renders a saved icon key from the shared library. This is a plain helper (not a
 * component) so an icon string coming from the DB never turns into a component
 * defined during render.
 */
function glyph(key: string, className: string) {
  return createElement(resolveIcon(key), { className });
}

function IconColorPicker({
  icon,
  color,
  onChange,
}: {
  icon: string;
  color: string;
  onChange: (next: { icon: string; color: string }) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Choose icon & colour"
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm transition-transform hover:scale-105"
        style={{ backgroundColor: color }}
      >
        {glyph(icon, "w-5 h-5")}
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-40 w-64 rounded-2xl bg-card border border-line p-3 shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase text-faint">
              Icon
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-faint hover:text-fg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-8 gap-1">
            {ICON_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ icon: key, color })}
                className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                  key === icon
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface hover:text-fg"
                }`}
              >
                {glyph(key, "w-3.5 h-3.5")}
              </button>
            ))}
          </div>
          <div className="border-t border-dotted border-line my-2.5" />
          <div className="flex items-center gap-2 flex-wrap">
            {ITEM_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => onChange({ icon, color: swatch })}
                title={swatch}
                className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                  swatch === color
                    ? "ring-2 ring-offset-2 ring-fg ring-offset-card"
                    : ""
                }`}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
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
        editing ? "rounded-2xl border border-dashed border-line p-3" : ""
      }`}
    >
      {children}
      {editing && (
        <button
          type="button"
          onClick={onRemove}
          title="Remove item"
          className="mt-2.5 shrink-0 text-faint hover:text-danger transition-colors"
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
    <div className="space-y-3">
      {items.map((item, idx) => {
        return (
          <ItemRowShell
            key={item.id || idx}
            editing={editing}
            onRemove={() => onChange(items.filter((_, i) => i !== idx))}
          >
            {editing ? (
              <IconColorPicker
                icon={item.icon}
                color={item.color}
                onChange={(next) => patch(idx, next)}
              />
            ) : (
              <div
                className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white shadow-sm"
                style={{ backgroundColor: item.color }}
              >
                {glyph(item.icon, "w-5 h-5")}
              </div>
            )}

            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-1.5">
                  <input
                    className="input-line font-semibold"
                    value={item.title}
                    placeholder="Title"
                    onChange={(e) => patch(idx, { title: e.target.value })}
                  />
                  <input
                    className="input-line text-muted"
                    value={item.description}
                    placeholder="One-line description"
                    onChange={(e) =>
                      patch(idx, { description: e.target.value })
                    }
                  />
                  <input
                    className="input-line text-xs text-faint font-mono"
                    value={item.link || ""}
                    placeholder="https://link (optional)"
                    onChange={(e) => patch(idx, { link: e.target.value })}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-baseline gap-x-2 pt-1.5">
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-fg hover:text-accent transition-colors"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <span className="font-semibold text-fg">{item.title}</span>
                  )}
                  <span className="text-faint">·</span>
                  <span className="text-muted">{item.description}</span>
                </div>
              )}
            </div>
          </ItemRowShell>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Companies grid (3 columns in the reference design)
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
      className={`grid gap-5 ${editing ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}
    >
      {items.map((item, idx) => {
        return (
          <div key={item.id || idx} className="group relative">
            {editing ? (
              <div className="flex items-start gap-3 rounded-2xl border border-dashed border-line p-3">
                <IconColorPicker
                  icon={item.icon}
                  color={item.color}
                  onChange={(next) => patch(idx, next)}
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    className="input-line font-semibold"
                    value={item.title}
                    placeholder="Company"
                    onChange={(e) => patch(idx, { title: e.target.value })}
                  />
                  <input
                    className="input-line text-sm text-muted"
                    value={item.description}
                    placeholder="What they do / what you did"
                    onChange={(e) =>
                      patch(idx, { description: e.target.value })
                    }
                  />
                  <input
                    className="input-line text-xs text-faint font-mono"
                    value={item.link || ""}
                    placeholder="https://link (optional)"
                    onChange={(e) => patch(idx, { link: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, i) => i !== idx))}
                  className="mt-2 text-faint hover:text-danger transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: item.color }}
                  >
                    {glyph(item.icon, "w-4.5 h-4.5")}
                  </div>
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-fg hover:text-accent transition-colors"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <span className="font-semibold text-fg">{item.title}</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  {item.description}
                </p>
              </>
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
      {items.map((item, idx) => (
        <div
          key={item.id || idx}
          className={`flex items-center gap-3 ${
            editing
              ? "rounded-2xl border border-dashed border-line p-3"
              : "py-2"
          }`}
        >
          {editing && <GripVertical className="w-4 h-4 text-faint shrink-0" />}
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex flex-col md:flex-row md:items-center gap-1.5">
                <input
                  className="input-line flex-1"
                  value={item.title}
                  placeholder="Article title"
                  onChange={(e) => patch(idx, { title: e.target.value })}
                />
                <input
                  className="input-line md:w-36 font-mono text-xs"
                  value={item.date}
                  placeholder="24-03-2022"
                  onChange={(e) => patch(idx, { date: e.target.value })}
                />
                <input
                  className="input-line md:w-52 font-mono text-xs"
                  value={item.link || ""}
                  placeholder="https://link (optional)"
                  onChange={(e) => patch(idx, { link: e.target.value })}
                />
              </div>
            ) : item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="text-fg hover:text-accent transition-colors truncate block"
              >
                {item.title}
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
              className="shrink-0 text-faint hover:text-danger transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
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
