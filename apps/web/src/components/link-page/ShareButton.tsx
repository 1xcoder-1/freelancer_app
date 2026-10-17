"use client";

import { useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";

/* Desktop chrome share button (fixed top-right, like the reference layout).
   Self-contained feedback — the public page has no toast provider mounted,
   so "copied" flips the icon for 2s instead of raising a toast. */
export function ShareButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const share = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // User dismissed the share sheet / clipboard was denied — nothing to show.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      aria-label="Share this page"
      title="Share this page"
      className="hidden md:inline-flex fixed top-6 right-6 z-40 w-10 h-10 rounded-full bg-black/35 backdrop-blur-md text-white items-center justify-center hover:bg-black/55 transition-colors cursor-pointer"
    >
      {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
    </button>
  );
}
