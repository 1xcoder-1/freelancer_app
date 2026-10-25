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
          borderRadius: "12px",
          border: "1px solid var(--line, rgba(128,128,128,0.2))",
        },
      }}
    />
  );
}
