"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "@/components/animated-icons";
import { cn } from "@/lib/utils";

interface DialogContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextType | undefined>(undefined);

// Skill timing: enter 300ms ease-out, exit is shorter and smaller (150ms).
// The exit is driven by animating to the hidden targets while the panel is
// still mounted, then unmounting after the exit duration — this keeps the
// content rendered through the fade instead of flashing an empty panel.
const ENTER_MS = 300;
const EXIT_MS = 150;

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  // Escape closes the top-most dialog (same contract ConfirmDialog promises).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error("DialogContent must be used within Dialog");

  const { open } = context;
  const reduceMotion = useReducedMotion();

  // Stay mounted briefly after close so the exit animation is visible.
  const [mounted, setMounted] = React.useState(open);
  React.useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (mounted) {
      const t = setTimeout(() => setMounted(false), EXIT_MS + 30);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  if (!mounted) return null;

  // Under reduced motion only the cross-fade runs (no rise, scale or blur).
  const panelVisible = {
    opacity: open ? 1 : 0,
    y: open ? 0 : reduceMotion ? 0 : -12,
    scale: open ? 1 : reduceMotion ? 1 : 0.97,
    filter: open ? "blur(0px)" : reduceMotion ? "blur(0px)" : "blur(4px)",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ pointerEvents: open ? undefined : "none" }}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop — cross-fade both ways */}
      <motion.div
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: (open ? ENTER_MS : EXIT_MS) / 1000, ease: "easeOut" }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => context.onOpenChange(false)}
      />
      {/* Modal Dialog Body — rises in, exits upward and smaller */}
      <motion.div
        initial={false}
        animate={panelVisible}
        transition={{ duration: (open ? ENTER_MS : EXIT_MS) / 1000, ease: "easeOut" }}
        className={cn(
          "dialog-scroll relative z-50 w-full rounded-xl bg-card border border-line p-6 shadow-2xl",
          className
        )}
      >
        <button
          onClick={() => context.onOpenChange(false)}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted hover:text-fg hover:bg-surface transition-colors"
        >
          <X className="w-4 h-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </motion.div>
    </div>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 text-left mb-4", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-lg font-semibold leading-none tracking-tight text-fg", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs text-muted", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 mt-6",
        className
      )}
      {...props}
    />
  );
}
