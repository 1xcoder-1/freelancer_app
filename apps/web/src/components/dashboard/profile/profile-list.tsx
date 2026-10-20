"use client";

import React from "react";
import { Plus, Pencil, Trash2, Loader2 } from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";

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
    <div className="flex items-center justify-between gap-4 mb-5">
      <div className="text-xs font-semibold text-muted">
        {count === 0
          ? "Nothing here yet"
          : `${count} ${count === 1 ? "entry" : "entries"}`}
      </div>
      <Button
        size="sm"
        onClick={onAdd}
        className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm rounded-full gap-1.5"
      >
        <Plus className="w-4 h-4" />
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
  title,
  subtitle,
  badges,
  onEdit,
  onDelete,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group rounded-2xl border border-line bg-bg px-5 py-4 hover:border-line-strong transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-fg truncate">{title}</div>
          {subtitle && <div className="text-xs text-muted mt-1">{subtitle}</div>}
          {badges && <div className="flex flex-wrap gap-1.5 mt-2">{badges}</div>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent-soft transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent-soft border border-accent/20 text-[11px] font-semibold text-fg">
      {children}
    </span>
  );
}

/** Small modal form used by every list section. */
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="text-sm font-semibold text-fg font-display tracking-wide">
          {title}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4">
          {children}
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-full">
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm rounded-full"
          >
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
