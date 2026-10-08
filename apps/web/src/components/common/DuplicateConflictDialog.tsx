"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { UserRound, Mail, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import type { DuplicatePersonConflict } from "@/lib/api";

/* ------------------------------------------------------------------
   The 409 "already exists" pop-menu, redesigned as a record preview
   instead of a plain text alert. Content enters in staged chunks
   (avatar → record card → actions, 100ms apart, better-ui values).
   Same resolver contract as ConfirmDialog: module-level host, callers
   just ask.
------------------------------------------------------------------- */

export type DuplicateResolution =
  | { action: "none" } // stay on the form (cancelled)
  | { action: "retry" } // resubmit with allow_duplicate: true
  | { action: "open"; path: string }; // navigate to the existing record

type Pending = {
  conflict: DuplicatePersonConflict;
  resolve: (r: DuplicateResolution) => void;
};

let requestConflict: ((p: Pending) => void) | null = null;

export function askDuplicateConflict(
  conflict: DuplicatePersonConflict
): Promise<DuplicateResolution> {
  return new Promise<DuplicateResolution>((resolve) => {
    if (!requestConflict) {
      resolve({ action: "none" });
      return;
    }
    requestConflict({ conflict, resolve });
  });
}

const item = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

export function DuplicateConflictDialogHost() {
  const [pending, setPending] = React.useState<Pending | null>(null);
  // Stays true while the panel plays its 150ms exit, so the content is
  // still rendered as it fades (no empty-panel flash).
  const [closing, setClosing] = React.useState(false);

  React.useEffect(() => {
    requestConflict = (p) => setPending(p);
    return () => {
      requestConflict = null;
    };
  }, []);

  const close = (resolution: DuplicateResolution) => {
    if (!pending) return;
    pending.resolve(resolution);
    setClosing(true);
    setTimeout(() => {
      setPending(null);
      setClosing(false);
    }, 160);
  };

  const conflict = pending?.conflict;
  const openPath = conflict
    ? `/dashboard/${conflict.kind}s/${conflict.person.id}`
    : "";
  const strict = Boolean(conflict?.strict);
  const label = conflict?.kind === "client" ? "client" : "lead";
  const matched =
    conflict?.match === "phone" ? "phone number" : conflict?.match === "email" ? "email" : "name";
  const initial = conflict?.person.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <Dialog open={!!conflict && !closing} onOpenChange={(o) => !o && close({ action: "none" })}>
      <DialogContent className="max-w-md">
        {conflict && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
            className="space-y-5"
          >
            {/* Avatar with a single soft ring ping — "we found this record" */}
            <motion.div variants={item} className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <span className="absolute inset-0 rounded-full bg-accent/25 motion-safe:animate-ping [animation-iteration-count:2] [animation-duration:1.2s]" />
                <span className="relative w-12 h-12 rounded-full bg-accent-soft border border-accent/40 text-accent flex items-center justify-center font-display text-lg font-bold">
                  {initial}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted">
                  {strict ? "Already in your book" : "Possible duplicate"}
                </p>
                <h2 className="font-display text-lg font-semibold text-fg tracking-tight truncate">
                  {conflict.person.name}
                </h2>
              </div>
            </motion.div>

            {/* Existing-record preview chip */}
            <motion.div variants={item}>
              <div className="rounded-xl border border-line bg-surface/50 p-4 space-y-2.5">
                <p className="text-[11px] text-muted leading-relaxed">
                  {strict
                    ? `One email can only be one person. This ${label} already exists — open the record and edit it there.`
                    : `A ${label} with the same ${matched} already exists. If these are different people, add this one anyway.`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {conflict.person.email && (
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-fg bg-card border border-line rounded-full px-3 py-1.5">
                      <Mail className="w-3 h-3 text-muted" />
                      <span className="max-w-[180px] truncate">{conflict.person.email}</span>
                    </span>
                  )}
                  {conflict.person.company && (
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-fg bg-card border border-line rounded-full px-3 py-1.5">
                      <Building2 className="w-3 h-3 text-muted" />
                      <span className="max-w-[140px] truncate">{conflict.person.company}</span>
                    </span>
                  )}
                  {!conflict.person.email && !conflict.person.company && (
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-fg bg-card border border-line rounded-full px-3 py-1.5">
                      <UserRound className="w-3 h-3 text-muted" />
                      Existing {label} record
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Actions in their own row (preview-page convention) */}
            <motion.div variants={item} className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                onClick={() => close({ action: "none" })}
                className="press sm:order-1 inline-flex items-center justify-center h-10 px-4 rounded-lg border border-line bg-card text-fg text-sm font-semibold hover:bg-surface cursor-pointer"
              >
                {strict ? "Stay here" : "Cancel"}
              </button>
              {strict ? (
                <button
                  onClick={() => close({ action: "open", path: openPath })}
                  className="press inline-flex items-center justify-center h-10 px-4 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg text-sm font-semibold shadow-sm cursor-pointer"
                >
                  Open existing
                </button>
              ) : (
                <button
                  onClick={() => close({ action: "retry" })}
                  className="press inline-flex items-center justify-center h-10 px-4 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg text-sm font-semibold shadow-sm cursor-pointer"
                >
                  Add anyway
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
