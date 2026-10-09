// Next.js convention: this file MUST live at src/app/not-found.tsx.
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Rise } from "@/components/landing/motion";
import { Container, LandingShell, MkButton } from "@/components/landing/layout";

const modules = [
  {
    href: "/features",
    title: "Features",
    sub: "CRM, Time & Invoices",
    glyph: "01",
  },
  {
    href: "/architecture",
    title: "Architecture",
    sub: "Stack & Monorepo",
    glyph: "02",
  },
  {
    href: "/features#ai",
    title: "Book AI",
    sub: "AI Freelance Copilot",
    glyph: "03",
  },
  {
    href: "/about",
    title: "About Us",
    sub: "Story & Manifesto",
    glyph: "04",
  },
];

export default function NotFound() {
  return (
    <LandingShell>
      <Navbar />

      <main className="flex-1">
        <Container className="flex flex-1 flex-col items-center justify-center py-24 text-center sm:py-32">
          <Rise className="flex flex-col items-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-[2px] border border-line bg-fg/[0.03] px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-brand-light">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
              </span>
              404 — Page Not Found
            </div>

            <h1 className="max-w-xl text-4xl font-medium tracking-tight leading-[1.1] text-fg sm:text-5xl">
              This page isn&apos;t in the book.
            </h1>

            <p className="mt-5 max-w-md text-base font-light text-muted sm:text-lg">
              The page you are looking for may have been moved or does not exist. Explore
              the popular modules below:
            </p>

            <div className="mt-9 grid w-full max-w-lg grid-cols-2 gap-2.5 text-left">
              {modules.map((m) => (
                <Link
                  key={m.title}
                  href={m.href}
                  className="rounded-[2px] border border-fg/10 bg-fg/[0.03] p-4 transition-colors hover:border-fg/20"
                >
                  <div className="mb-2 font-mono text-[10px] text-brand-light">{m.glyph}</div>
                  <div className="text-[13px] font-medium text-fg">{m.title}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{m.sub}</div>
                </Link>
              ))}
            </div>

            <Link href="/" className="mt-10">
              <MkButton>Return to Home</MkButton>
            </Link>
          </Rise>
        </Container>
      </main>

      <Footer />
    </LandingShell>
  );
}
