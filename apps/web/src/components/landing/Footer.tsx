import Link from "next/link";
import { Github, Linkedin, Twitter } from "@/components/animated-icons";

/* ------------------------------------------------------------------
   Footer — sits under the CTA panel and echoes it: brand column with
   the orange book badge, uppercase mono column headings, hairline
   bottom bar. Same grammar, deliberately quieter than the panel.
------------------------------------------------------------------- */

const columns = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Book AI", href: "/features#ai" },
      { label: "Download", href: "/download" },
      { label: "Sign up", href: "/sign-up" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Getting started", href: "/docs/getting-started" },
      { label: "Testimonials", href: "/#reviews" },
    ],
  },
  {
    heading: "Social",
    links: [
      { label: "GitHub", href: "https://github.com", icon: Github },
      { label: "X / Twitter", href: "https://x.com", icon: Twitter },
      { label: "LinkedIn", href: "https://linkedin.com", icon: Linkedin },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-bg">
      <div className="mx-auto max-w-7xl px-6 pb-10 pt-4 sm:px-8 sm:pb-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr] md:gap-x-16">
          {/* Brand column */}
          <div className="col-span-2 flex flex-col gap-6 md:col-span-1">
            <Link
              href="/"
              className="inline-flex w-max items-center gap-2.5 text-fg transition-colors hover:text-fg/80"
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
              <span className="text-base font-semibold tracking-tight">
                Freelance<span className="text-brand"> Book</span>
              </span>
            </Link>

            <p className="max-w-xs text-sm leading-relaxed text-muted">
              The calm operating system for independent freelancers —
              clients, time and money in one book.
            </p>

            <p className="font-mono text-xs uppercase tracking-widest text-muted/70">
              Built for independent freelancers
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.heading} className="flex flex-col gap-4">
              <p className="font-mono text-xs uppercase tracking-widest text-muted/70">
                {col.heading}
              </p>
              <ul className="flex flex-col gap-3">
                {col.links.map((link) => {
                  const Icon = "icon" in link ? link.icon : null;
                  return (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        target={"icon" in link ? "_blank" : undefined}
                        rel={"icon" in link ? "noopener noreferrer" : undefined}
                        className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
                      >
                        {Icon && <Icon className="size-4" />}
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-line/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">© 2026 Freelance Book. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link
              href="/privacy"
              className="text-sm text-muted transition-colors hover:text-fg"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-muted transition-colors hover:text-fg"
            >
              Terms of Service
            </Link>
          </div>
          <p className="text-sm text-muted/70">
            Free to start · No credit card required
          </p>
        </div>
      </div>
    </footer>
  );
}
