"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/common/ThemeToggle";

const navLinks = [
  { label: "Features", href: "/features" },
  { label: "AI Copilot", href: "/ai" },
  { label: "Architecture", href: "/architecture" },
  { label: "About", href: "/about" },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-line bg-bg/90 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="w-6 h-6 rounded-md bg-accent flex items-center justify-center text-accent-fg text-[11px] font-black font-mono">
            fb
          </span>
          <span className="font-display font-bold text-[15px] text-fg tracking-tight">
            freelance<span className="text-accent">book</span>
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-muted">
          {navLinks.map((link) => (
            <Link key={link.label} href={link.href} className="hover:text-fg transition-colors">
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle />

          <SignedOut>
            <Link href="/sign-in" className="hidden sm:inline-flex">
              <span className="text-[13px] font-medium text-muted hover:text-fg transition-colors px-2">
                Sign in
              </span>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="rounded-md font-semibold">
                Get Started
              </Button>
            </Link>
          </SignedOut>

          <SignedIn>
            <Link href="/dashboard">
              <Button size="sm" variant="outline" className="rounded-md font-semibold">
                Dashboard
              </Button>
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-muted hover:text-fg hover:bg-surface transition-colors"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-line bg-bg px-4 py-4 space-y-1"
          >
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-md text-sm font-medium text-muted hover:text-fg hover:bg-surface"
              >
                {link.label}
              </Link>
            ))}
            <SignedOut>
              <div className="pt-3 border-t border-line grid grid-cols-2 gap-3">
                <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full rounded-md">
                    Sign In
                  </Button>
                </Link>
                <Link href="/sign-up" onClick={() => setMobileMenuOpen(false)}>
                  <Button size="sm" className="w-full rounded-md">
                    Get Started
                  </Button>
                </Link>
              </div>
            </SignedOut>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
