"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, Globe, Loader2, RotateCcw, Trash2 } from "@/components/animated-icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CustomSelect } from "@/components/ui/custom-select";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import type { PlannerShare } from "@/lib/api";

interface PlannerShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current share state; a falsy token means the board is not shared yet. */
  share: PlannerShare | null;
  onEnable: (expiresIso: string | null) => Promise<void>;
  onRotate: () => Promise<void>;
  onDisable: () => Promise<void>;
}

type ExpiryChoice = "never" | "1h" | "24h" | "7d" | "30d";

const EXPIRY_OPTIONS: { value: ExpiryChoice; label: string }[] = [
  { value: "never", label: "Never expires" },
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

function expiryToIso(choice: ExpiryChoice): string | null {
  if (choice === "never") return null;
  const hours = choice === "1h" ? 1 : choice === "24h" ? 24 : choice === "7d" ? 24 * 7 : 24 * 30;
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

export function PlannerShareDialog({
  open,
  onOpenChange,
  share,
  onEnable,
  onRotate,
  onDisable,
}: PlannerShareDialogProps) {
  const [expiry, setExpiry] = useState<ExpiryChoice>("never");
  const [busy, setBusy] = useState(false);

  const shared = !!share?.share_token;
  const shareUrl =
    shared && typeof window !== "undefined"
      ? `${window.location.origin}/planner/share/${share!.share_token}`
      : "";

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const copyLink = () => {
    void navigator.clipboard?.writeText(shareUrl).then(
      () => toast.success("Read-only link copied"),
      () => toast.error(shareUrl)
    );
  };

  const removeLink = async () => {
    const ok = await confirmDialog({
      title: "Remove share link?",
      message: "Anyone with the link will immediately lose access to this board.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await run(onDisable);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-w-md p-6 sm:p-7 rounded-2xl border border-line bg-[#161617] shadow-2xl overflow-visible scrollbar-none"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none rounded-t-2xl" />

        <DialogHeader className="relative">
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-accent/10 border-accent/20 shrink-0">
              <Globe className="w-5 h-5 text-accent" />
            </div>
            <div className="pr-6 space-y-1.5 flex-1 min-w-0">
              <DialogTitle className="font-display text-lg font-bold text-fg tracking-tight leading-snug">
                Share board
              </DialogTitle>
              <DialogDescription className="text-sm text-muted leading-relaxed">
                Create a public link to share a read-only view of this board with anyone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {shared ? (
          <div className="relative mt-2 space-y-4">
            <div>
              <p className="text-xs font-semibold text-fg mb-1.5">Share link</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0 rounded-lg border border-line bg-surface/60 px-3 h-10">
                  <Globe className="w-4 h-4 text-muted shrink-0" />
                  <span className="truncate text-sm text-muted font-mono">{shareUrl}</span>
                </div>
                <button
                  type="button"
                  onClick={copyLink}
                  title="Copy link"
                  className="shrink-0 w-10 h-10 rounded-lg border border-line bg-surface/60 hover:bg-surface hover:border-line-strong text-muted hover:text-fg inline-flex items-center justify-center transition-all active:scale-[0.97] cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => window.open(shareUrl, "_blank", "noopener")}
                  title="Open link in a new tab"
                  className="shrink-0 w-10 h-10 rounded-lg border border-line bg-surface/60 hover:bg-surface hover:border-line-strong text-muted hover:text-fg inline-flex items-center justify-center transition-all active:scale-[0.97] cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
              {share!.expires_at && (
                <p className="text-[11px] text-faint mt-1.5">
                  Expires {new Date(share!.expires_at).toLocaleString()}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-faint">
                Anyone with this link can view the board — they can never edit it.
              </p>
              <button
                type="button"
                onClick={() => void run(onRotate)}
                disabled={busy}
                title="Revoke this link and mint a fresh one — the old URL stops working"
                className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line bg-surface/60 hover:bg-surface text-[11px] font-medium text-muted hover:text-fg transition-all active:scale-[0.97] cursor-pointer disabled:opacity-60"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                New link
              </button>
            </div>

            <div className="space-y-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => void removeLink()}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/40 text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remove Share Link
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-full inline-flex items-center justify-center h-10 rounded-lg border border-line bg-surface/60 hover:bg-surface text-sm font-medium text-fg transition-all active:scale-[0.98] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="relative mt-2 space-y-4">
            <div className="rounded-xl border border-line bg-surface/60 px-6 py-7 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface border border-line flex items-center justify-center mb-3.5">
                <Globe className="w-7 h-7 text-faint" />
              </div>
              <p className="text-sm font-semibold text-fg">This board is not shared yet</p>
              <p className="text-xs text-muted mt-1 max-w-[260px] leading-relaxed">
                Create a share link to let anyone view this board read-only
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-fg mb-1.5">Link Expiration</p>
              <CustomSelect
                value={expiry}
                onChange={(v) => setExpiry(v as ExpiryChoice)}
                options={EXPIRY_OPTIONS}
                buttonClassName="w-full h-10 bg-surface/60"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={busy}
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-line bg-surface/60 hover:bg-surface text-xs font-medium text-fg shadow-xs hover:border-line-strong transition-all active:scale-[0.97] cursor-pointer disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void run(() => onEnable(expiryToIso(expiry)))}
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg text-xs font-semibold shadow-xs transition-all active:scale-[0.97] cursor-pointer disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
                Create
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
