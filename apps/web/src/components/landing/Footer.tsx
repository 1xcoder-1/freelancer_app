import Link from "next/link";
import { Github, Linkedin, Twitter } from "@/components/animated-icons";

/* ------------------------------------------------------------------
   Footer — superset.sh footer grammar: hairline top border, brand
   column with socials + copyright, link columns on the right.
------------------------------------------------------------------- */

const columns = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Book AI", href: "/features#ai" },
      { label: "Live demo", href: "/dashboard" },
      { label: "Sign up", href: "/sign-up" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Architecture", href: "/architecture" },
      { label: "About", href: "/about" },
      { label: "Manifesto", href: "/about" },
      { label: "Changelog", href: "/about" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "/about" },
      { label: "Terms", href: "/about" },
      { label: "Security", href: "/architecture" },
    ],
  },
];

const socials = [
  { icon: Github, href: "https://github.com", label: "GitHub" },
  { icon: Twitter, href: "https://x.com", label: "X / Twitter" },
  { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-bg">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-14 sm:py-20">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:gap-x-16">
          {/* Brand column */}
          <div className="col-span-2 flex flex-col gap-6 md:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-fg transition-colors hover:text-fg/80 w-max"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="size-4" aria-hidden>
                <path d="M0 0h5v5H0zM5.5 0h5v5h-5zM11 0h5v5h-5zM0 5.5h5v5H0zM0 11h5v5H0zM5.5 11h5v5h-5zM11 5.5h5v5h-5z" />
              </svg>
              <span className="font-semibold tracking-tight text-[15px]">
                freelance<span className="text-brand">book</span>
              </span>
            </Link>

            <div className="-ml-2 flex items-center gap-2">
              {socials.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="text-muted hover:text-fg transition-colors p-1 sm:p-2"
                  >
                    <Icon className="size-5" />
                  </a>
                );
              })}
            </div>

            <p className="text-sm text-muted">
              © 2026 Freelance Book
            </p>

            <p className="text-sm text-muted max-w-xs leading-relaxed">
              The calm operating system for independent freelancers —
              clients, time and money in one book.
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.heading} className="flex flex-col gap-4">
              <p className="text-sm font-medium text-fg">{col.heading}</p>
              <ul className="flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-fg"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
