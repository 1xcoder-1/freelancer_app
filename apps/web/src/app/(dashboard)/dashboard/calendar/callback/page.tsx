"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { CalendarDays, Loader2, TriangleAlert } from "lucide-react";

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
        setMessage(googleError ? `Google returned an error: ${googleError}` : "Missing authorization code — please retry the connect flow.");
        return;
      }
      try {
        const token = (await getToken()) || undefined;
        await completeGoogleCalendarConnect({ code, state }, token);
        // Back to the dashboard with the calendar freshly populated
        router.replace("/dashboard");
      } catch (err) {
        setPhase("error");
        setMessage(err instanceof Error ? err.message : "Google Calendar connection failed");
      }
    })();
  }, [params, getToken, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        {phase === "working" ? (
          <>
            <div className="mx-auto w-14 h-14 rounded-2xl bg-accent-soft dark:bg-accent/15 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            </div>
            <h2 className="font-display text-xl font-bold text-fg">Connecting Google Calendar…</h2>
            <p className="text-sm text-muted">Exchanging tokens and syncing your upcoming events. This takes a few seconds.</p>
          </>
        ) : (
          <>
            <div className="mx-auto w-14 h-14 rounded-2xl bg-danger/15 flex items-center justify-center">
              <TriangleAlert className="w-6 h-6 text-danger" />
            </div>
            <h2 className="font-display text-xl font-bold text-fg">Connection failed</h2>
            <p className="text-sm text-muted">{message}</p>
            <button
              onClick={() => router.replace("/dashboard")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg text-sm font-semibold"
            >
              <CalendarDays className="w-4 h-4" />
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function GoogleCalendarCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
