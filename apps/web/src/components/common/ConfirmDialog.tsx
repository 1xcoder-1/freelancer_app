"use client";

import * as React from "react";
import { AlertTriangle, AlertCircle } from "@/components/animated-icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red button for destructive actions (delete, remove). */
  danger?: boolean;
}

type PendingRequest = ConfirmOptions & { resolve: (confirmed: boolean) => void };

// Module-level hook: the host registers itself here, callers just ask.
let requestConfirm: ((req: PendingRequest) => void) | null = null;

/**
 * In-app replacement for window.confirm(). Resolves true when the user
 * presses the confirm button, false on cancel/backdrop/Escape.
 * If no host is mounted (e.g. server context), falls back safely to false.
 */
export function confirmDialog(options: string | ConfirmOptions): Promise<boolean> {
  const opts = typeof options === "string" ? { message: options } : options;
  return new Promise<boolean>((resolve) => {
    if (!requestConfirm) {
      resolve(false);
      return;
    }
    requestConfirm({ ...opts, resolve });
  });
}

export function ConfirmDialogHost() {
  const [pending, setPending] = React.useState<PendingRequest | null>(null);
  // Stays true while the panel plays its 150ms exit, so the content is
  // still rendered as it fades (no empty-panel flash).
  const [closing, setClosing] = React.useState(false);

  React.useEffect(() => {
    requestConfirm = (req) => setPending(req);
    return () => {
      requestConfirm = null;
    };
  }, []);

  const close = React.useCallback((confirmed: boolean) => {
    if (!pending) return;
    pending.resolve(confirmed);
    setClosing(true);
    setTimeout(() => {
      setPending(null);
      setClosing(false);
    }, 160);
  }, [pending]);

  // Pressing Enter confirms the dialog immediately
  React.useEffect(() => {
    if (!pending || closing) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        close(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [pending, closing, close]);

  return (
    <Dialog open={!!pending && !closing} onOpenChange={(open) => close(open)}>
      <DialogContent className="max-w-md p-6 sm:p-7 rounded-2xl border-line/80 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        {pending && (
          <>
            {/* Top specular highlight edge */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

            <DialogHeader className="relative">
              <div className="flex items-start gap-3.5 sm:gap-4">
                <div className="relative shrink-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200 ${
                      pending.danger
                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                        : "bg-accent/10 border-accent/20 text-accent"
                    }`}
                  >
                    {pending.danger ? (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-accent" />
                    )}
                  </div>
                </div>

                <div className="pr-6 space-y-1.5 flex-1 min-w-0">
                  <DialogTitle className="font-display text-lg font-bold text-fg tracking-tight leading-snug">
                    {pending.title || (pending.danger ? "Are you sure?" : "Please confirm")}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted leading-relaxed">
                    {pending.message}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <DialogFooter className="relative mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={() => close(false)}
                className="w-full sm:w-auto inline-flex items-center justify-center h-9 px-4 rounded-lg border border-line bg-surface/60 hover:bg-surface text-xs font-medium text-fg shadow-xs hover:border-line-strong transition-all active:scale-[0.97] cursor-pointer"
              >
                {pending.cancelLabel || "Cancel"}
              </button>

              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className={`w-full sm:w-auto inline-flex items-center justify-center h-9 px-4 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] cursor-pointer shadow-xs ${
                  pending.danger
                    ? "bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/40"
                    : "bg-accent hover:bg-accent-hi text-accent-fg"
                }`}
              >
                {pending.confirmLabel || (pending.danger ? "Delete" : "Confirm")}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
