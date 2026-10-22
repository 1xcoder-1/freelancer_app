"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  Sparkles,
  Bot,
  Send,
  Wand2,
  FileText,
  Copy,
  Check,
  MessageSquare,
  AlertCircle,
  RefreshCw,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { generateAIProposalPitch } from "@/lib/api";
import {
  askBookAI,
  getBookAIStatus,
  type BookAICitation,
  type BookAIStatusResponse,
} from "@/lib/book-ai-api";
import { logHandledError } from "@/lib/log-error";
import { PlanMeterChip, usePlanMeter } from "@/components/dashboard/PlanLimit";
import { invalidatePlanSnapshot } from "@/hooks/use-plan";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  intent?: string;
  citations?: BookAICitation[];
}

const EXAMPLE_QUESTIONS = [
  "How much did I bill a client this quarter?",
  "Which client has the highest effective hourly rate?",
  "What is unbilled on a project?",
  "Show my recent activity",
];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function BookAIPanel() {
  const { getToken } = useAuth();
  const router = useRouter();

  // ---- Section A: Draft a proposal -------------------------------------
  const [clientScope, setClientScope] = useState("");
  const [targetBudget, setTargetBudget] = useState(1500);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draft, setDraft] = useState<{ title: string; pitch: string } | null>(null);
  const [draftCopied, setDraftCopied] = useState(false);

  const handleDraft = async () => {
    if (!clientScope.trim()) {
      toast.error("Describe the client scope first");
      return;
    }
    try {
      setIsDrafting(true);
      const token = (await getToken()) || undefined;
      const res = await generateAIProposalPitch(clientScope, Number(targetBudget), token);
      setDraft({ title: res.title, pitch: res.pitch_content });
    } catch (err) {
      logHandledError("Book AI draft failed:", err);
      toast.error("Could not draft the proposal. Try again.");
    } finally {
      setIsDrafting(false);
    }
  };

  const copyDraft = async () => {
    if (!draft) return;
    const text = `${draft.title}\n\n${draft.pitch}`.trim();
    try {
      await navigator.clipboard.writeText(text);
      setDraftCopied(true);
      setTimeout(() => setDraftCopied(false), 2000);
    } catch {
      toast.error("Clipboard blocked by the browser");
    }
  };

  // ---- Section B: Ask about your business ------------------------------
  const aiMeter = usePlanMeter("ai_asks");
  const [status, setStatus] = useState<BookAIStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const token = (await getToken()) || undefined;
      setStatus(await getBookAIStatus(token));
    } catch (err) {
      logHandledError("Book AI status check failed:", err);
      setStatus({ available: false, capabilities: [] });
    } finally {
      setStatusLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;
      // The API counts every question against the plan's monthly allowance, so a
      // spent meter never sends a request that can only come back as a 402.
      if (aiMeter.atLimit) {
        toast.error(
          `All ${aiMeter.limit} Book AI questions used this ${aiMeter.period}`
        );
        router.push(aiMeter.upgradeHref);
        return;
      }

      setQuestion("");
      setMessages((prev) => [...prev, { id: newId(), role: "user", text: trimmed }]);
      setIsThinking(true);
      scrollToBottom();

      try {
        const token = (await getToken()) || undefined;
        const res = await askBookAI(trimmed, token);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            text: res.answer,
            intent: res.intent,
            citations: res.citations,
          },
        ]);
        invalidatePlanSnapshot();
      } catch (err) {
        logHandledError("Book AI ask failed:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            text: "Sorry — I couldn't reach your book right now. Please try again.",
          },
        ]);
        toast.error("Book AI is unavailable");
      } finally {
        setIsThinking(false);
        scrollToBottom();
      }
    },
    [aiMeter, getToken, isThinking, router, scrollToBottom]
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    void ask(question);
  };

  // ---- Render ----------------------------------------------------------
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
              Book AI
            </h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-accent bg-accent-soft border border-accent/20 rounded-full px-2 py-0.5">
              <Sparkles className="w-3 h-3" />
              Assistant
            </span>
            <PlanMeterChip meter={aiMeter} />
          </div>
          <p className="text-muted text-sm mt-1">
            Draft a winning proposal and ask your book direct — billed totals, rates, unbilled
            work and recent activity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION A — Draft a proposal */}
        <Card className="bg-card border-line p-6 space-y-4 self-start">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-accent" />
            <h3 className="text-base font-bold text-fg">Draft a proposal</h3>
          </div>
          <p className="text-xs text-muted -mt-2">
            Paste the client's brief and let Book AI write the pitch.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted">Client scope *</label>
              <textarea
                value={clientScope}
                onChange={(e) => setClientScope(e.target.value)}
                placeholder="e.g. Next.js dashboard with Stripe payments, responsive, 3-week turnaround."
                rows={4}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-line-strong resize-y"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted">Target budget ($)</label>
              <input
                type="number"
                min={0}
                value={targetBudget}
                onChange={(e) => setTargetBudget(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-line-strong"
              />
            </div>

            <Button
              onClick={handleDraft}
              disabled={isDrafting || !clientScope.trim()}
              className="w-full bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
            >
              <Bot className="w-4 h-4" />
              {isDrafting ? "Book AI is drafting…" : "Draft with Book AI"}
            </Button>
          </div>

          {isDrafting && (
            <div className="space-y-2 pt-3 border-t border-line">
              <Skeleton className="h-5 w-2/3 rounded-md" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          )}

          {!isDrafting && draft && (
            <div className="space-y-3 pt-3 border-t border-line animate-in fade-in">
              <div>
                <label className="text-xs font-semibold text-accent">Proposal title</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line-strong text-fg text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-accent flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Pitch
                </label>
                <textarea
                  value={draft.pitch}
                  onChange={(e) => setDraft((d) => (d ? { ...d, pitch: e.target.value } : d))}
                  rows={8}
                  className="w-full mt-1 p-3 rounded-lg bg-bg border border-line-strong text-fg font-mono text-xs focus:outline-none resize-y"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyDraft}
                className="w-full border-line text-fg bg-card hover:bg-surface"
              >
                {draftCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-accent" />
                    <span className="italic font-medium text-accent">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy pitch
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>

        {/* SECTION B — Ask about your business */}
        <Card className="bg-card border-line p-6 flex flex-col min-h-[520px]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-accent" />
              <h3 className="text-base font-bold text-fg">Ask about your business</h3>
            </div>
            {status?.available && (
              <button
                type="button"
                onClick={() => void loadStatus()}
                disabled={statusLoading}
                title="Refresh availability"
                className="p-1.5 rounded-lg text-faint hover:text-fg hover:bg-surface transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${statusLoading ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>

          {statusLoading ? (
            <div className="space-y-3 pt-4">
              <Skeleton className="h-12 w-3/4 rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-10 w-2/3 self-end rounded-xl" />
            </div>
          ) : !status?.available ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mb-4">
                <AlertCircle className="w-7 h-7 text-accent" />
              </div>
              <h4 className="font-display text-lg font-medium text-fg">
                Book AI isn't available yet
              </h4>
              <p className="text-sm text-muted mt-1 max-w-sm">
                The assistant is offline right now. Draft a proposal on the left in the meantime,
                or refresh to check again.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadStatus()}
                className="mt-4 border-line text-fg bg-card hover:bg-surface"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </Button>
            </div>
          ) : (
            <>
              {/* Message list */}
              <div
                ref={scrollRef}
                className="flex-1 space-y-3 py-4 overflow-y-auto pr-1 min-h-[220px]"
              >
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted">
                      Try one of these to see what Book AI can pull from your records:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {EXAMPLE_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => void ask(q)}
                          className="text-xs text-left px-3 py-1.5 rounded-full bg-bg border border-line text-muted hover:text-fg hover:border-line-strong transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent text-accent-fg px-3.5 py-2 text-sm">
                        {m.text}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex justify-start">
                      <div className="max-w-[90%] space-y-2">
                        <div className="rounded-2xl rounded-bl-sm bg-bg border border-line px-3.5 py-2 text-sm text-fg whitespace-pre-wrap">
                          {m.text}
                        </div>
                        {m.citations && m.citations.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-1">
                            {m.citations.map((c, i) => (
                              <span
                                key={`${c.id}-${i}`}
                                title={`${c.type} · ${c.id}`}
                                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface border border-line text-muted"
                              >
                                <FileText className="w-2.5 h-2.5" />
                                {c.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}

                {isThinking && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm bg-bg border border-line px-3.5 py-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" />
                    </div>
                  </div>
                )}
              </div>

              {/* Example chips stay handy above the input once chatting */}
              {messages.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-3">
                  {EXAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void ask(q)}
                      disabled={isThinking}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-bg border border-line text-faint hover:text-fg hover:border-line-strong transition-colors disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <form onSubmit={handleSend} className="flex items-center gap-2 pt-3 border-t border-line">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about billing, rates, unbilled work…"
                  className="flex-1 px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:border-line-strong"
                />
                <Button
                  type="submit"
                  disabled={isThinking || !question.trim()}
                  className="bg-accent hover:bg-accent-hi text-accent-fg w-10 h-10 p-0 rounded-xl shrink-0"
                  title="Send"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
