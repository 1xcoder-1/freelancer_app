"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Quote,
  Star,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Send,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  getPublicTestimonialRequest,
  submitPublicTestimonial,
  type PublicTestimonialRequest,
} from "@/lib/api";

// One token, one quote: the row is either unanswered (form), answered (409 ->
// thank-you), or revoked (404 -> dead link). No account, no other data reachable.
export default function PublicTestimonialPage() {
  const params = useParams();
  const token = params?.token as string;

  const [request, setRequest] = useState<PublicTestimonialRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [quote, setQuote] = useState("");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [authorName, setAuthorName] = useState("");
  const [authorRole, setAuthorRole] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getPublicTestimonialRequest(token);
      setRequest(data);
      setAuthorName(data.author_name ?? "");
      setAuthorRole(data.author_role ?? "");
    } catch (err: any) {
      if (err?.status === 409) {
        // Already answered — show the thank-you rather than an error.
        setSubmitted(true);
      } else {
        setError(err?.message || "This link is no longer valid.");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quote.trim().length < 10) {
      setError("A sentence or two is plenty — just not an empty box.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await submitPublicTestimonial(token, {
        quote: quote.trim(),
        rating: rating || undefined,
        author_name: authorName.trim() || undefined,
        author_role: authorRole.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "We could not send that. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Card className="w-full max-w-xl bg-card border-line p-8 space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4 text-fg">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <Card className="w-full max-w-md bg-card border-line p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-ok/10 border border-ok/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-ok" />
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-medium tracking-wide">Thank you</h2>
            <p className="text-sm text-muted">
              Your words are on their way. Nothing is published anywhere without a decision from the
              freelancer first.
            </p>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4 text-fg">
        <Card className="w-full max-w-md bg-card border-line p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-danger" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-medium tracking-wide">Link unavailable</h2>
          <p className="text-sm text-muted">{error}</p>
        </Card>
      </div>
    );
  }

  if (!request) return null;

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-xl space-y-5">
        <Card className="bg-card border-line p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-9 h-9 rounded-xl bg-accent-soft border border-accent/40 flex items-center justify-center">
              <Quote className="w-4 h-4 text-accent" />
            </span>
            <p className="text-xs font-mono uppercase tracking-wider text-muted">
              {request.context_label ?? "A recent project"}
            </p>
          </div>

          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide">
            {`How was working together, ${request.author_name.split(" ")[0]}?`}
          </h1>
          <p className="text-sm text-muted mt-2">
            One or two sentences about what got delivered and how it went. You can send it as your
            name, or leave it anonymous — the choice is yours.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5 mt-6">
            {/* Rating */}
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-2">
                Rating (optional)
              </label>
              <div className="flex items-center gap-1.5" onMouseLeave={() => setHovered(0)}>
                {[1, 2, 3, 4, 5].map((i) => {
                  const lit = (hovered || rating) >= i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRating(i)}
                      onMouseEnter={() => setHovered(i)}
                      aria-label={`Rate ${i} out of 5`}
                      className="p-1 rounded-lg transition-transform hover:scale-110"
                    >
                      <Star className={`w-7 h-7 ${lit ? "text-warn fill-warn" : "text-line"}`} />
                    </button>
                  );
                })}
                {rating > 0 && (
                  <button
                    type="button"
                    onClick={() => setRating(0)}
                    className="ml-2 text-[11px] font-mono text-faint hover:text-fg transition-colors"
                  >
                    clear
                  </button>
                )}
              </div>
            </div>

            {/* Quote */}
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-2">
                Your words
              </label>
              <textarea
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                rows={5}
                maxLength={4000}
                placeholder="They shipped two weeks early and the handover was flawless."
                className="w-full px-4 py-3 rounded-xl bg-surface border border-line text-sm text-fg placeholder:text-faint focus:outline-none focus:border-accent transition-colors resize-y"
              />
              <p className="text-[11px] text-faint mt-1.5 text-right">{quote.length} / 4000</p>
            </div>

            {/* Attribution */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-2">
                  Name shown
                </label>
                <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} maxLength={255} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-2">
                  Role or company
                </label>
                <Input
                  value={authorRole}
                  onChange={(e) => setAuthorRole(e.target.value)}
                  maxLength={255}
                  placeholder="Optional"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-danger flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={sending || quote.trim().length === 0}
              className="w-full bg-accent hover:bg-accent-hi text-accent-fg font-semibold py-6 rounded-xl"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send your testimonial
                </>
              )}
            </Button>
          </form>
        </Card>

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-faint">
          <ShieldCheck className="w-3.5 h-3.5" />
          This link is single-use and only ever reaches one person.
        </p>
      </div>
    </div>
  );
}
