"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle, Clock, Lock } from "@/components/animated-icons";
import { Skeleton } from "@/components/ui/skeleton";

export function CardSkeleton() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="max-w-3xl mx-auto px-6 pt-10 space-y-8">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="w-52 h-7 rounded" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="w-14 h-4 rounded" />
          <Skeleton className="w-24 h-4 rounded" />
          <Skeleton className="w-12 h-4 rounded" />
          <Skeleton className="w-16 h-4 rounded" />
        </div>
        <div className="space-y-3">
          <Skeleton className="w-full h-4 rounded" />
          <Skeleton className="w-4/5 h-4 rounded" />
          <Skeleton className="w-2/3 h-4 rounded" />
        </div>
        <Skeleton className="w-full h-40 rounded" />
      </div>
    </div>
  );
}

/** Full-screen notice used for revoked / expired / missing public cards. */
export function CardNotice({
  tone = "danger",
  title,
  message,
  actionHref,
  actionLabel,
}: {
  tone?: "danger" | "warn";
  title: string;
  message: string;
  actionHref: string;
  actionLabel: string;
}) {
  const Icon = tone === "warn" ? Clock : Lock;
  const toneClass =
    tone === "warn"
      ? "text-warn border-warn/25 bg-warn/10"
      : "text-danger border-danger/25 bg-danger/10";

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col items-center justify-center p-6 text-center">
      <div
        className={`w-16 h-16 rounded-2xl border flex items-center justify-center mb-4 ${toneClass}`}
      >
        <Icon className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-sm text-muted max-w-md leading-relaxed mb-6">
        {message}
      </p>
      <Link
        href={actionHref}
        className="h-10 px-5 inline-flex items-center rounded-xl bg-surface border border-line text-fg text-xs font-semibold hover:border-line-strong transition-all"
      >
        {actionLabel}
      </Link>
    </div>
  );
}

/** Inline load failure for the owner view (kept on-page, no redirect). */
export function CardLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
      <div className="w-14 h-14 rounded-2xl border border-danger/25 bg-danger/10 text-danger flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h2 className="text-base font-semibold text-fg">
        Couldn&apos;t load your report card
      </h2>
      <p className="text-sm text-muted mt-1.5 max-w-md">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 h-10 px-5 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hi transition-all"
      >
        Try again
      </button>
    </div>
  );
}
