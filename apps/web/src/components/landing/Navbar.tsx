"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { Menu, X } from "@/components/animated-icons";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Header — masterji.co grammar. At rest: full-width, fully
   transparent. Past ~100px of scroll the bar springs into a
   floating glass pill: width 80%, shifted 20px down, translucent
   bg with 10px backdrop blur and a layered floating shadow.

   fixed + h-16 spacer instead of sticky: body has overflow-y:auto,
   which silently disables sticky pinning for the whole landing shell.
------------------------------------------------------------------- */

const navLinks = [
  { label: "Features", href: "/features" },
  { label: "Architecture", href: "/architecture" },
  { label: "About", href: "/about" },
  { label: "Live demo", href: "/dashboard" },
];

const GLASS_BG = "rgba(22, 22, 23, 0.8)";
const GLASS_SHADOW =
  "0px 0px 24px rgba(0,0,0,0.55), 0px 1px 1px rgba(0,0,0,0.5), 0px 0px 0px 1px rgba(255,255,255,0.07), 0px 16px 68px rgba(0,0,0,0.45), 0px 1px 0px rgba(255,255,255,0.05) inset";
const CLEAR_SHADOW =
  "0px 0px 24px rgba(0,0,0,0), 0px 1px 1px rgba(0,0,0,0), 0px 0px 0px 1px rgba(255,255,255,0), 0px 16px 68px rgba(0,0,0,0), 0px 1px 0px rgba(255,255,255,0) inset";

const glassMorph = (floating: boolean) => ({
  width: floating ? "80%" : "100%",
  y: floating ? 20 : 0,
  backgroundColor: floating ? GLASS_BG : "rgba(22, 22, 23, 0)",
  backdropFilter: floating ? "blur(10px)" : "blur(0px)",
  boxShadow: floating ? GLASS_SHADOW : CLEAR_SHADOW,
});

const glassSpring = { type: "spring" as const, stiffness: 120, damping: 28 };

function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("group flex items-center gap-2.5", className)}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-b from-brand-light to-brand-dark text-white shadow-[0_2px_12px_rgba(210,86,17,0.4)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-[18px]"
          aria-hidden
        >
          <path d="M12 6.6C10.4 5.1 8.4 4.5 5.9 4.5c-1 0-2 .1-2.9.4v13.5c.9-.3 1.9-.4 2.9-.4 2.5 0 4.5.6 6.1 2.1 1.6-1.5 3.6-2.1 6.1-2.1 1 0 2 .1 2.9.4V4.9c-.9-.3-1.9-.4-2.9-.4-2.5 0-4.5.6-6.1 2.1z" />
          <path d="M12 6.6v13.5" />
        </svg>
      </span>
      <span className="text-base font-semibold tracking-tight text-fg">
        Freelance<span className="text-brand"> Book</span>
      </span>
    </Link>
  );
}

/** Pill CTA with the orbiting star-border glow (masterji.co "Start"). */
function StarPill({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative inline-block overflow-hidden rounded-full",
        className
      )}
      style={{ padding: "1.5px 0" }}
    >
      <span
        aria-hidden
        className="animate-star-movement-bottom pointer-events-none absolute bottom-[-11px] right-[-250%] z-0 h-[50%] w-[300%] rounded-full opacity-70"
        style={{
          background: "radial-gradient(circle, var(--accent), transparent 10%)",
          animationDuration: "5s",
        }}
      />
      <span
        aria-hidden
        className="animate-star-movement-top pointer-events-none absolute left-[-250%] top-[-10px] z-0 h-[50%] w-[300%] rounded-full opacity-70"
        style={{
          background: "radial-gradient(circle, var(--accent), transparent 10%)",
          animationDuration: "5s",
        }}
      />
      <span className="relative z-10 rounded-full border border-neutral-950 bg-gradient-to-b from-neutral-400 to-white px-4 py-1.5 text-center text-sm font-medium text-gray-900 transition-all duration-200 group-hover:brightness-110 group-hover:shadow-md">
        {children}
      </span>
    </Link>
  );
}

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const [floating, setFloating] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setFloating(y > 100));

  return (
    <>
      <div aria-hidden className="h-16" />
      <header className="fixed inset-x-0 top-0 z-50 lg:px-6">
        {/* Desktop bar — transparent at rest, floating glass pill on scroll */}
        <motion.div
          animate={glassMorph(floating)}
          transition={glassSpring}
          className="relative z-[60] mx-auto hidden w-full max-w-7xl flex-row items-center justify-between self-start rounded-full p-4 lg:flex"
        >
          <Wordmark className="z-10" />

          <nav className="absolute inset-0 hidden flex-1 flex-row items-center justify-center space-x-2 text-sm font-medium lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="relative px-4 py-2 text-muted transition-colors duration-200 hover:text-fg"
              >
                <span className="relative z-20">{link.label}</span>
              </Link>
            ))}
          </nav>

          <div className="z-10 flex items-center gap-3.5">
            <SignedOut>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-muted transition-colors hover:text-fg"
              >
                Sign in
              </Link>
              <StarPill href="/sign-up">Get started</StarPill>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-muted transition-colors hover:text-fg"
              >
                Dashboard
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </motion.div>

        {/* Mobile bar — same transparent-to-glass morph */}
        <motion.div
          animate={glassMorph(floating)}
          transition={glassSpring}
          className="relative z-50 mx-auto flex w-full flex-col items-center justify-between py-4 lg:hidden"
        >
          <div className="flex w-full flex-row items-center justify-between px-4 sm:px-6">
            <Wordmark />
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1 text-fg transition-colors hover:text-fg/80"
                aria-label="Open menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="lg:hidden overflow-hidden border-t border-line bg-bg"
            >
              <div className="space-y-1 px-4 py-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-fg"
                  >
                    {link.label}
                  </Link>
                ))}
                <SignedOut>
                  <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
                    <Link
                      href="/sign-in"
                      onClick={() => setMobileMenuOpen(false)}
                      className="inline-flex items-center justify-center rounded-full border border-line bg-bg px-3 py-2 text-sm text-fg transition-colors hover:bg-surface"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/sign-up"
                      onClick={() => setMobileMenuOpen(false)}
                      className="inline-flex items-center justify-center rounded-full bg-fg px-3 py-2 text-sm font-medium text-bg transition-colors hover:bg-brand hover:text-white"
                    >
                      Get started
                    </Link>
                  </div>
                </SignedOut>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
