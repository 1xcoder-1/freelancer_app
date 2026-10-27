"use client";

import * as React from "react";
import { Toaster } from "sonner";

/**
 * Sonner toaster locked to dark theme.
 */
export function AppToaster() {
  return (
    <Toaster
      theme="dark"
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        style: {
          background: "#141416",
          borderRadius: "12px",
          border: "1px solid var(--line, rgba(255, 255, 255, 0.08))",
          boxShadow: "0 14px 36px -4px rgba(0, 0, 0, 0.85)",
          color: "#f4f4f5",
        },
      }}
    />
  );
}
