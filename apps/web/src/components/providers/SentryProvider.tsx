"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (typeof window !== "undefined" && dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
    debug: false,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
  });
}

export function SentryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!dsn) return;

    const errorHandler = (event: ErrorEvent) => {
      Sentry.captureException(event.error || new Error(event.message));
    };
    window.addEventListener("error", errorHandler);
    return () => window.removeEventListener("error", errorHandler);
  }, []);

  return <>{children}</>;
}
