"use client";

import * as React from "react";
import { Toaster } from "sonner";

/**
 * Sonner toaster that follows the app's dark/light theme (the <html> class
 * toggled before paint and by ThemeToggle), not the OS setting.
 */
export function AppToaster() {
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");

  React.useEffect(() => {
    const sync = () =>
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Toaster
      theme={theme}
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
