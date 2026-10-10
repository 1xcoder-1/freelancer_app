"use client";

import Link from "next/link";
import { ArrowDown, Laptop, Smartphone } from "lucide-react";
import { Container, Eyebrow, RadialGlow, Section } from "@/components/landing/layout";
import { MacLid } from "@/components/landing/laptop";
import { MobileTimerScreen } from "@/components/landing/mobile-app";
import { ClientsView } from "@/components/landing/app";
import { ScaledMock } from "@/components/landing/app";
import { Rise, Stagger, StaggerItem } from "@/components/landing/motion";

/* ========================= DOWNLOAD SECTION ========================
   "Your book on every screen": a mini MacBook preview with the real
   clients panel overlapping a phone running the native timer screen,
   beside honest pre-launch download tiles.
=================================================================== */

function DownloadTile({
  icon: Icon,
  name,
  meta,
  note,
}: {
  icon: React.ElementType;
  name: string;
  meta: string;
  note: string;
}) {
  return (
    <div
      aria-disabled="true"
      className="group relative flex items-center gap-4 overflow-hidden rounded-[2px] border border-line bg-card px-5 py-4 transition-colors hover:border-brand/40"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand/[0.05] to-transparent opacity-0 transition-opacity group-hover:opacity-100"
      />
      <span className="relative flex size-12 shrink-0 items-center justify-center rounded-[2px] border border-line bg-surface text-fg/80 transition-colors group-hover:border-brand/40 group-hover:text-brand">
        <Icon className="size-5" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="block text-[15px] font-medium text-fg">{name}</span>
          <span className="rounded-[2px] border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[#fcbb00]">
            Soon
          </span>
        </span>
        <span className="mt-0.5 block text-[13px] leading-5 text-muted">
          {meta} — {note}
        </span>
      </span>
      <ArrowDown className="relative size-4 shrink-0 text-muted/40" aria-hidden />
    </div>
  );
}

export function DownloadSection() {
  return (
    <Section id="download" className="scroll-mt-24">
      <Container>
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <Rise className="relative overflow-x-clip">
            <RadialGlow />
            <div className="relative z-10 flex min-h-[440px] items-center justify-center py-6 sm:min-h-[520px]">
              <div className="flex scale-[0.62] items-end sm:scale-[0.82] lg:scale-100">
                <MacLid className="z-0 w-[560px] shrink-0 shadow-[0_30px_70px_-24px_rgba(0,0,0,0.85)]">
                  <ScaledMock designWidth={860} designHeight={470}>
                    <div className="bg-[#0e0e0f] px-6 py-5 text-[#f0efed]">
                      <ClientsView compact />
                    </div>
                  </ScaledMock>
                </MacLid>
                <div
                  className="relative z-10 -ml-24 shrink-0 pb-2"
                  style={{
                    boxShadow:
                      "0 0 0 2px #090909, 0 0 0 3px #141517, 0 30px 80px -20px rgba(0,0,0,0.8)",
                    borderRadius: 38,
                  }}
                >
                  <div className="relative aspect-[9/19] w-[210px] rounded-[38px] border border-white/[0.025] bg-[linear-gradient(115deg,#090a0b_0%,#232529_22%,#0a0b0c_42%,#101113_76%,#282a2e_100%)] p-[5px]">
                    <div className="relative flex h-full flex-col overflow-hidden rounded-[34px] bg-[#0b0b0b] text-white">
                      <MobileTimerScreen scale={0.556} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Rise>

          <Stagger className="space-y-4">
            <StaggerItem>
              <Eyebrow>Native apps</Eyebrow>
            </StaggerItem>
            <StaggerItem>
              <h2 className="mt-4 text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl">
                Take the book with you.
              </h2>
            </StaggerItem>
            <StaggerItem>
              <p className="max-w-[500px] text-base leading-relaxed text-muted sm:text-lg">
                The web app is live today. The native builds add what a browser
                can&apos;t: a timer that keeps counting offline, push reminders
                the moment an invoice moves, and a global quick capture that
                works from any app.
              </p>
            </StaggerItem>
            <StaggerItem>
              <div className="flex max-w-md flex-col gap-3 pt-2">
                <DownloadTile
                  icon={Smartphone}
                  name="Android app"
                  meta=".apk, sideload or store"
                  note="offline timer and push reminders"
                />
                <DownloadTile
                  icon={Laptop}
                  name="Windows app"
                  meta=".exe installer"
                  note="global Ctrl+Shift+F quick capture"
                />
              </div>
            </StaggerItem>
            <StaggerItem>
              <p className="max-w-md text-sm leading-relaxed text-muted">
                Native builds are in final testing — no waitlist needed, the web
                app does everything today.{" "}
                <Link
                  href="/sign-up"
                  className="whitespace-nowrap font-medium text-brand transition-colors hover:text-brand-light"
                >
                  Start on web →
                </Link>
              </p>
            </StaggerItem>
          </Stagger>
        </div>
      </Container>
    </Section>
  );
}
