"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie } from "@/components/animated-icons";

export function CookieBanner() {
  const [show, setShow] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Public link pages are visitor-facing; the consent prompt is app chrome.
    if (pathname?.startsWith("/p/")) return;
    const consent = localStorage.getItem("freelance_book_cookie_consent");
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  const handleAccept = () => {
    localStorage.setItem("freelance_book_cookie_consent", "accepted");
    setShow(false);
  };

  const handleDecline = () => {
    localStorage.setItem("freelance_book_cookie_consent", "declined");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-sm z-50 rounded-[2px] border border-line bg-card/95 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md text-fg"
        >
          <div className="p-4">
            <div className="flex items-center gap-2">
              <Cookie className="size-3.5 shrink-0 text-muted" />
              <h4 className="text-[13px] font-medium text-fg">
                We value your privacy
              </h4>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Essential cookies keep you signed in and remember your preferences.
              No third-party ad tracking.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleAccept}
                className="flex-1 cursor-pointer border border-line bg-fg px-3 py-1.5 text-xs font-medium text-bg transition-colors hover:bg-brand hover:text-white"
              >
                Accept all
              </button>
              <button
                onClick={handleDecline}
                className="cursor-pointer border border-line bg-bg px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-surface"
              >
                Necessary only
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
