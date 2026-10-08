"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie } from "@/components/animated-icons";

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("freelance_book_cookie_consent");
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

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
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.4 }}
          className="fixed bottom-6 left-6 right-6 md:left-6 md:right-auto md:max-w-md z-50 p-5 rounded-xl bg-card border border-line shadow-2xl backdrop-blur-2xl text-fg"
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl bg-accent-soft border border-accent/20 text-accent flex items-center justify-center flex-shrink-0">
              <Cookie className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-fg">We value your privacy</h4>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                We use essential cookies to maintain your login session and enhance your freelance dashboard experience. No third-party ad tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-line">
            <button
              onClick={handleAccept}
              className="flex-1 py-2 px-3 rounded-xl bg-accent hover:bg-accent-hi text-accent-fg font-bold text-xs transition-all shadow-sm cursor-pointer text-center"
            >
              Accept All
            </button>
            <button
              onClick={handleDecline}
              className="py-2 px-3 rounded-xl bg-bg hover:bg-surface border border-line text-fg font-semibold text-xs transition-all cursor-pointer text-center"
            >
              Necessary Only
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
