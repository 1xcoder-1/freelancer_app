"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { CalendarDays, Loader2, TriangleAlert, ArrowLeft, RefreshCw } from "@/components/animated-icons";

import { completeGoogleCalendarConnect } from "@/lib/api";

type Phase = "working" | "error";

function CallbackInner() {
  const router = useRouter();
  const { getToken } = useAuth();
  const params = useSearchParams();
  const [phase, setPhase] = useState<Phase>("working");
  const [message, setMessage] = useState<string>("");
  // React StrictMode double-invokes effects in dev; the OAuth code is
  // single-use, so guard against exchanging it twice.
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = params.get("code");
    const state = params.get("state");
    const googleError = params.get("error");

    (async () => {
      if (googleError || !code || !state) {
        setPhase("error");
        setMessage(
          googleError === "access_denied"
            ? "Google Calendar permissions were not granted. You can reconnect anytime from the calendar."
            : googleError
            ? `Google returned an error: ${googleError}`
            : "Missing authorization code — please retry the connect flow."
        );
        return;
      }
      try {
        const token = (await getToken()) || undefined;
        await completeGoogleCalendarConnect({ code, state }, token);
        // Back to the calendar page with events freshly populated
        router.replace("/dashboard/calendar");
      } catch (err) {
        setPhase("error");
        setMessage(err instanceof Error ? err.message : "Google Calendar connection failed");
      }
    })();
  }, [params, getToken, router]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-line p-8 shadow-2xl overflow-hidden text-center">
        {/* Ambient background glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        {phase === "working" ? (
          <div className="relative space-y-5">
            {/* Dual animated icon badge */}
            <div className="relative mx-auto w-16 h-16 rounded-2xl bg-surface border border-line flex items-center justify-center shadow-inner">
              <CalendarDays className="w-8 h-8 text-accent animate-pulse" />
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent text-accent-fg flex items-center justify-center shadow-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-xl font-bold text-fg tracking-tight">
                Connecting Google Calendar…
              </h2>
              <p className="text-sm text-muted leading-relaxed max-w-xs mx-auto">
                Exchanging tokens and syncing your calendar events. This only takes a few moments.
              </p>
            </div>

            {/* Subtle animated progress track */}
            <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden border border-line">
              <div className="bg-gradient-to-r from-accent to-accent-hi h-full rounded-full w-3/4 animate-pulse" />
            </div>

            <div className="pt-2">
              <button
                onClick={() => router.replace("/dashboard/calendar")}
                className="text-xs text-muted hover:text-fg font-medium transition-colors cursor-pointer"
              >
                Cancel and return to calendar
              </button>
            </div>
          </div>
        ) : (
          <div className="relative space-y-5">
            <div className="relative mx-auto w-16 h-16 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center shadow-inner">
              <TriangleAlert className="w-8 h-8 text-danger" />
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-xl font-bold text-fg tracking-tight">
                Connection Failed
              </h2>
              <p className="text-sm text-muted leading-relaxed max-w-xs mx-auto">
                {message}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                onClick={() => router.replace("/dashboard/calendar")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 h-9 rounded-xl border border-line bg-surface hover:bg-surface/80 text-xs font-semibold text-fg transition-all active:scale-95 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Calendar</span>
              </button>
              <button
                onClick={() => router.replace("/dashboard/calendar")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 h-9 rounded-xl bg-accent hover:bg-accent-hi text-xs font-semibold text-accent-fg shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connect</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GoogleCalendarCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-line p-8 shadow-2xl text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-surface border border-line flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-accent animate-spin" />
            </div>
            <h2 className="font-display text-xl font-bold text-fg">Loading…</h2>
          </div>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
