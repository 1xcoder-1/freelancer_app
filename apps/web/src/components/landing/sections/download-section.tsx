"use client";

import Link from "next/link";
import { ArrowRight, Globe, Laptop, Smartphone } from "lucide-react";
import { Container, Eyebrow, MkButton, Section } from "@/components/landing/layout";
import { Rise, Stagger, StaggerItem } from "@/components/landing/motion";
import { TextAnimate } from "@/components/ui/text-animate";

/* ========================= DOWNLOAD OPTIONS ========================
   The honest pre-launch download grid: the web app is live today,
   the native companions are in final testing. One card per platform,
   no fake download buttons — status is stated, the live path is first.
=================================================================== */

const platforms = [
  {
    icon: Globe,
    name: "Web app",
    status: "Live",
    live: true,
    desc: "The whole book in your browser — clients, projects, time, invoices and Book AI. Nothing to install, always the latest version.",
    meta: "Any modern browser · starts free",
  },
  {
    icon: Smartphone,
    name: "Android app",
    status: "Final testing",
    live: false,
    desc: "A timer that keeps counting offline, push reminders the moment an invoice moves, and your book in your pocket.",
    meta: "Android 10+ · .apk or store",
  },
  {
    icon: Laptop,
    name: "Windows app",
    status: "Final testing",
    live: false,
    desc: "Global Ctrl+Shift+F quick capture that works from any app, plus the whole book as its own native window.",
    meta: "Windows 10+ · .exe installer",
  },
];

export function DownloadSection() {
  return (
    <Section id="download" className="scroll-mt-24">
      <Container>
        <Stagger className="flex flex-col items-center text-center">
          <StaggerItem>
            <Eyebrow>Download</Eyebrow>
          </StaggerItem>
          <StaggerItem>
            <TextAnimate
              as="h2"
              variant="roll"
              whileInView
              text="Get the book on every screen."
              className="mt-4 text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl lg:text-5xl"
            />
          </StaggerItem>
          <StaggerItem>
            <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">
              Start on the web today — the native companions ship right after
              final testing, and your book syncs across all of them.
            </p>
          </StaggerItem>
        </Stagger>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {platforms.map((p, i) => (
            <Rise key={p.name} delay={i * 0.08}>
              <div className="group relative flex h-full flex-col rounded-[2px] border border-line bg-fg/[0.03] p-6 transition-colors hover:border-fg/20">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-[2px] border border-line bg-surface text-fg/80 transition-colors group-hover:border-brand/40 group-hover:text-brand">
                    <p.icon className="size-5" />
                  </span>
                  <span
                    className={
                      p.live
                        ? "rounded-[2px] border border-brand/40 bg-brand/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-brand"
                        : "rounded-[2px] border border-line px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[#fcbb00]"
                    }
                  >
                    {p.status}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-medium text-fg">{p.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  {p.desc}
                </p>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-muted/60">
                  {p.meta}
                </p>
                <div className="mt-5">
                  {p.live ? (
                    <Link href="/sign-up" className="block">
                      <MkButton className="w-full">
                        Open the web app
                        <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </MkButton>
                    </Link>
                  ) : (
                    <MkButton
                      variant="outline"
                      disabled
                      aria-disabled="true"
                      className="w-full cursor-default opacity-60"
                    >
                      Coming soon
                    </MkButton>
                  )}
                </div>
              </div>
            </Rise>
          ))}
        </div>

        <Rise className="mt-8 text-center">
          <p className="text-sm text-muted">
            No waitlist, no credit card — the web app does everything today,{" "}
            <Link
              href="/sign-up"
              className="whitespace-nowrap font-medium text-brand transition-colors hover:text-brand-light"
            >
              start free →
            </Link>
          </p>
        </Rise>
      </Container>
    </Section>
  );
}
