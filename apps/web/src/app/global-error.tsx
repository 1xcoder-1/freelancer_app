"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 p-8">
          <h2 className="text-2xl font-bold text-rose-400">Something went wrong</h2>
          <p className="text-sm text-slate-400">Our engineering team has been notified via Sentry.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-emerald-500 text-slate-950 font-semibold rounded-xl text-sm"
          >
            Reload page
          </button>
        </div>
      </body>
    </html>
  );
}
