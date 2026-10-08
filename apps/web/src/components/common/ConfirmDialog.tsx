"use client";

import * as React from "react";
import { AlertTriangle } from "@/components/animated-icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

  const close = (confirmed: boolean) => {
    if (!pending) return;
    pending.resolve(confirmed);
    setClosing(true);
    setTimeout(() => {
      setPending(null);
      setClosing(false);
    }, 160);
  };

  return (
    <Dialog open={!!pending && !closing} onOpenChange={(open) => close(open)}>
      <DialogContent className="max-w-md">
        {pending && (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3">
                <span
                  className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                    pending.danger ? "bg-danger/10 text-danger" : "bg-accent-soft text-accent"
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <div className="pr-6">
                  <DialogTitle className="text-lg">
                    {pending.title || (pending.danger ? "Are you sure?" : "Please confirm")}
                  </DialogTitle>
                  <DialogDescription className="text-sm mt-1.5 leading-relaxed">
                    {pending.message}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => close(false)}
                className="border-line text-fg"
              >
                {pending.cancelLabel || "Cancel"}
              </Button>
              <Button
                onClick={() => close(true)}
                className={
                  pending.danger
                    ? "bg-danger hover:bg-danger/90 text-white font-semibold shadow-sm"
                    : "bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
                }
              >
                {pending.confirmLabel || (pending.danger ? "Delete" : "Confirm")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
