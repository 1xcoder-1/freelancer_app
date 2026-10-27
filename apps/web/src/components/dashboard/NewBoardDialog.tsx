"use client";

import React, { useEffect, useRef } from "react";
import { Loader2, PenLine } from "@/components/animated-icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface NewBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creating: boolean;
  onCreate: (name: string) => void;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  placeholder?: string;
}

export function NewBoardDialog({
  open,
  onOpenChange,
  creating,
  onCreate,
  title = "New Board",
  description = "Create a blank canvas to sketch ideas and workflows.",
  icon,
  placeholder = "e.g. Brand redesign moodboard",
}: NewBoardDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Select the prefilled name once the enter animation settles, so typing
  // replaces it in one stroke instead of appending mid-word.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.select(), 320);
    return () => clearTimeout(t);
  }, [open]);

  const submit = () => {
    if (creating) return;
    onCreate(inputRef.current?.value.trim() || "Untitled board");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 sm:p-7 rounded-2xl border border-line bg-[#161617] shadow-2xl overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

        <DialogHeader className="relative">
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-accent/10 border-accent/20 shrink-0">
              {icon ?? <PenLine className="w-5 h-5 text-accent" />}
            </div>
            <div className="pr-6 space-y-1 flex-1 min-w-0">
              <DialogTitle className="font-display text-lg font-bold text-fg tracking-tight leading-snug">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted leading-normal">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="relative mt-3 space-y-1.5">
          <label htmlFor="new-board-name" className="text-xs font-medium text-muted">
            Board name
          </label>
          <input
            ref={inputRef}
            id="new-board-name"
            autoFocus
            defaultValue="Untitled board"
            maxLength={255}
            disabled={creating}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/80 hover:bg-surface text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all selection:bg-accent/30 selection:text-fg"
          />
        </div>

        <DialogFooter className="relative mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={creating}
            className="w-full sm:w-auto inline-flex items-center justify-center h-9 px-4 rounded-lg border border-line bg-surface/60 hover:bg-surface text-xs font-medium text-fg shadow-xs hover:border-line-strong transition-all active:scale-[0.97] cursor-pointer disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={creating}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg text-xs font-semibold shadow-xs transition-all active:scale-[0.97] cursor-pointer disabled:opacity-60"
          >
            {creating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PenLine className="w-3.5 h-3.5" />
            )}
            {creating ? "Creating…" : "Create board"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
