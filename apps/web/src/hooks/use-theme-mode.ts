"use client";

import { useEffect, useState } from "react";

/**
 * The app's theme lives as a `.dark` class on <html> (see app/layout.tsx),
 * toggled at runtime by ThemeToggle and persisted in localStorage under
 * "fb-theme". This hook mirrors that class into React state so component
 * libraries that take an explicit `theme` prop (Excalidraw) can follow the
 * app in real time instead of being painted in a fixed colour scheme.
 *
 * A MutationObserver on <html class> catches every toggle regardless of which
 * component fired it, so there is a single source of truth (the DOM class) and
 * no prop-drilling of theme through the tree.
 */
export function useThemeMode(): "light" | "dark" {
  const [mode, setMode] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const read = () =>
      setMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return mode;
}
