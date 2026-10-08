import Link from "next/link";
import { Github, Linkedin, Twitter } from "@/components/animated-icons";

const columns = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Book AI", href: "/ai" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Architecture", href: "/architecture" },
      { label: "About", href: "/about" },
      { label: "Live Demo", href: "/dashboard" },
      { label: "Changelog", href: "/about" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/about" },
      { label: "Terms of Service", href: "/about" },
      { label: "Cookie Policy", href: "/about" },
      { label: "License", href: "/about" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-14">
          {/* Brand column */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <span className="w-6 h-6 rounded-md bg-accent flex items-center justify-center text-accent-fg text-[11px] font-black font-mono">
                fb
              </span>
              <span className="font-display font-bold text-[15px] text-fg tracking-tight">
                freelance<span className="text-accent">book</span>
              </span>
            </Link>
            <p className="text-[13px] text-muted leading-relaxed max-w-xs mb-6">
              The calm, fast operating system for independent freelancers.
              Capture, orchestrate and bill — in seconds.
            </p>
            <div className="flex items-center gap-2">
              {[
                { icon: Github, href: "https://github.com", label: "GitHub" },
                { icon: Twitter, href: "https://x.com", label: "X / Twitter" },
                { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="w-8 h-8 rounded-md border border-line bg-card flex items-center justify-center text-muted hover:text-fg hover:border-line-strong transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.heading}>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-faint mb-4">
                {col.heading}
              </div>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-[13px] text-muted hover:text-fg transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Mono meta bottom bar */}
        <div className="pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-wider text-faint">
          <span>© 2026 Freelance Book&nbsp;&nbsp;·&nbsp;&nbsp;Built for independents</span>
          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-fg transition-colors">Privacy</Link>
            <Link href="/about" className="hover:text-fg transition-colors">Terms</Link>
            <Link href="/features" className="hover:text-fg transition-colors">Status</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
