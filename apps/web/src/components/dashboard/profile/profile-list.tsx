"use client";

import React from "react";
import { Plus, Pencil, Trash2, Loader2, X, Save } from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/** Header row of a list section: count + Add button. */
export function ListHeader({
  count,
  addLabel,
  onAdd,
}: {
  count: number;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="text-xs font-medium text-muted">
        {count === 0
          ? "Nothing here yet"
          : `${count} ${count === 1 ? "entry" : "entries"}`}
      </div>
      <Button
        type="button"
        size="sm"
        onClick={onAdd}
        className="h-8 px-3 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg text-xs font-medium shadow-2xs hover:shadow-xs transition-all gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}

export function EmptyList({ hint }: { hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-bg/60 px-6 py-10 text-center">
      <p className="text-sm text-muted">{hint}</p>
    </div>
  );
}

export function ItemCard({
  icon,
  title,
  subtitle,
  meta,
  description,
  badges,
  statusBadge,
  action,
  onEdit,
  onDelete,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  description?: React.ReactNode;
  badges?: React.ReactNode;
  statusBadge?: React.ReactNode;
  action?: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group rounded-xl border border-line/70 bg-surface/30 hover:bg-surface/50 hover:border-line-strong transition-all duration-150 p-4 sm:p-4.5">
      <div className="flex items-start gap-3.5">
        {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
        <div className="min-w-0 flex-1">
          {/* Top Header Row: Role/Title + Company on left, Date + Actions on right */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-fg tracking-tight">{title}</span>
                {subtitle && (
                  <>
                    <span className="text-muted/40 font-bold">·</span>
                    <span className="text-sm font-medium text-fg/80">{subtitle}</span>
                  </>
                )}
                {statusBadge}
              </div>
            </div>

            {/* Right side: Meta / Date range + Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              {meta && <span className="text-xs text-muted font-medium hidden sm:inline-block">{meta}</span>}
              <div className="flex items-center gap-1">
                {action}
                <button
                  type="button"
                  onClick={onEdit}
                  className="p-1.5 rounded-md text-muted hover:text-fg hover:bg-surface-elevated transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Date on small mobile screens if hidden above */}
          {meta && <div className="text-xs text-muted font-medium sm:hidden mt-1">{meta}</div>}

          {/* Description */}
          {description && (
            <p className="text-xs text-muted/90 leading-relaxed mt-1.5 line-clamp-2 font-normal">
              {description}
            </p>
          )}

          {/* Badges / Chips: Compact, natural spacing, NO horizontal divider line */}
          {badges && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {badges}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Chip({
  children,
  variant = "default",
  icon,
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "accent" | "success" | "muted" | "amber" | "indigo";
  icon?: React.ReactNode;
  className?: string;
}) {
  const variants = {
    default: "bg-surface-elevated/70 border-line text-muted",
    accent: "bg-accent-soft border-accent/20 text-accent font-medium",
    success: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 font-medium",
    muted: "bg-surface/50 border-line text-muted",
    amber: "bg-amber-500/10 border-amber-500/25 text-amber-400 font-medium",
    indigo: "bg-indigo-500/10 border-indigo-500/25 text-indigo-400 font-medium",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-normal transition-colors",
        variants[variant],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Inline expandable form used by every list section (no modal popup). */
export function ListDialog({
  open,
  title,
  saving,
  onClose,
  onSave,
  children,
}: {
  open: boolean;
  title: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -8 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="overflow-hidden mb-6"
        >
          <div className="rounded-2xl border border-line bg-surface/60 backdrop-blur-xs p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3.5 border-b border-line">
              <div className="text-sm font-semibold text-fg font-display tracking-wide">
                {title}
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-surface-elevated transition-colors"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-4">
              {children}
            </div>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg h-8.5 px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onSave}
                disabled={saving}
                className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm rounded-lg h-8.5 px-5 text-xs gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
