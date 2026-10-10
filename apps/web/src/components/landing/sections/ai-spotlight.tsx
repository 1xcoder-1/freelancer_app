"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import {
  Container,
  Eyebrow,
  RadialGlow,
  Section,
  WindowFrame,
} from "@/components/landing/layout";
import { Rise, Stagger, StaggerItem } from "@/components/landing/motion";
import { T } from "@/components/landing/app";

/* =========================== AI SPOTLIGHT ==========================
   Home-page replacement for the download band: a live Book AI chat
   moment. The exchange replays itself — question, typing dots, the
   answer with a real action card — so the section breathes instead
   of sitting still. Paused in hidden tabs and for reduced motion.
=================================================================== */

type Step =
  | { kind: "user"; text: string }
  | { kind: "typing" }
  | { kind: "ai"; text: string; card?: { title: string; lines: string[] } };

const script: Step[] = [
  {
    kind: "user",
    text: "Nova hasn't paid INV-023 in 12 days. Chase them — but we talk weekly, keep it warm.",
  },
  { kind: "typing" },
  {
    kind: "ai",
    text: "Drafted it in your voice — friendly first, firm on the date, no apology filler:",
    card: {
      title: "Follow-up · INV-023 · $3,000",
      lines: [
        "\u201cHey Amira — hope the launch week survived you. Just floating the redesign invoice back up\u2026\u201d",
      ],
    },
  },
  { kind: "user", text: "Good. Send it, and add a silence reminder for Friday." },
  { kind: "typing" },
  {
    kind: "ai",
    text: "Sent at 9:41. Reminder armed for Friday, and I logged the chase on Nova's card so future-you has the thread.",
    card: { title: "Nova Studio · timeline", lines: ["Invoice chased", "Reminder Fri", "Relationship warm"] },
  },
];

const STEP_MS = [1400, 1500, 2400, 1600, 1300, 2600];

function TypingBubble() {
  return (
    <div className="flex items-center gap-1.5 rounded-[10px] rounded-bl-[2px] border border-[#28282a] bg-[#161617] px-3.5 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-[#a19d98]"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function ChatWindow() {
  const reduced = useReducedMotion();
  const [n, setN] = React.useState(reduced ? script.length : 0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (reduced) {
      setN(script.length);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const advance = (next: number) => {
      if (stopped) return;
      setN(next);
      if (next >= script.length) timer = setTimeout(() => advance(0), 4200);
      else if (document.hidden) timer = setTimeout(() => advance(next), 1200);
      else timer = setTimeout(() => advance(next + 1), STEP_MS[next]);
    };
    timer = setTimeout(() => advance(1), 900);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [reduced]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [n]);

  const shown = script.slice(0, n);
  const visible = shown.filter((s) => s.kind !== "typing");
  const typingNow = shown[shown.length - 1]?.kind === "typing";

  return (
    <div
      ref={scrollRef}
      className="flex h-[430px] flex-col gap-4 overflow-y-hidden bg-[#0e0e0f] px-5 py-6"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-[#28282a] pb-4">
        <span className="flex items-center gap-2 text-[13px] font-medium text-[#f0efed]">
          <Sparkles className="size-4 text-[#d46b28]" />
          Book AI
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#6f6b66]">
          knows 8 clients · 7 projects
        </span>
      </div>

      {visible.map((s, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={s.kind === "user" ? "flex justify-end" : "flex justify-start"}
        >
          {s.kind === "user" && (
            <p className="max-w-[80%] rounded-[10px] rounded-br-[2px] border border-[#d46b28]/40 bg-[#261912] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#f0efed]">
              {s.text}
            </p>
          )}
          {s.kind === "ai" && (
            <div className="max-w-[86%] space-y-2">
              <p className="rounded-[10px] rounded-bl-[2px] border border-[#28282a] bg-[#161617] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#e7e5e4]">
                {s.text}
              </p>
              {s.card && (
                <div className="rounded-[10px] border border-dashed border-[#38383b] bg-[#1d1d1f] p-3.5">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#d46b28]">
                    {s.card.title}
                  </p>
                  {s.card.lines.map((l) => (
                    <p key={l} className="text-[12px] leading-relaxed text-[#a19d98]">
                      {l}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      ))}

      {typingNow && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex justify-start"
        >
          <TypingBubble />
        </motion.div>
      )}
    </div>
  );
}

export function AiSpotlight() {
  return (
    <Section id="book-ai" className="scroll-mt-24">
      <Container>
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <Stagger className="space-y-4">
            <StaggerItem>
              <Eyebrow>Book AI</Eyebrow>
            </StaggerItem>
            <StaggerItem>
              <h2 className="mt-4 text-3xl font-medium tracking-tight leading-[1.1] text-fg sm:text-4xl lg:text-5xl">
                It already read
                <br />
                your whole book.
              </h2>
            </StaggerItem>
            <StaggerItem>
              <p className="max-w-[480px] text-base leading-relaxed text-muted sm:text-lg">
                Book AI answers from your real clients, hours and invoices — not a
                blank prompt box. It drafts in your voice, chases money politely,
                and turns a Friday afternoon of admin into one sentence.
              </p>
            </StaggerItem>
            <StaggerItem>
              <ul className="space-y-3 pt-2">
                {[
                  "Proposals and follow-ups that sound like you, not like a bot",
                  "Overdue-invoice chases with the relationship temperature checked",
                  "Every answer grounded in your own numbers — cite on request",
                ].map((p) => (
                  <li key={p} className="flex items-start gap-3 text-[15px] text-fg/90">
                    <span
                      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border"
                      style={{ borderColor: T.accent + "55", color: T.accent, background: "#261912" }}
                    >
                      <Check className="size-3" strokeWidth={2.5} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </StaggerItem>
            <StaggerItem>
              <Link
                href="/features#ai"
                className="mt-2 inline-flex items-center gap-2 font-medium text-brand transition-colors hover:text-brand-light"
              >
                Meet Book AI <span aria-hidden>→</span>
              </Link>
            </StaggerItem>
          </Stagger>

          <Rise className="relative overflow-x-clip">
            <RadialGlow />
            <div className="relative z-10">
              <WindowFrame title="book ai · one sentence in, admin done" className="w-full">
                <ChatWindow />
              </WindowFrame>
            </div>
          </Rise>
        </div>
      </Container>
    </Section>
  );
}
