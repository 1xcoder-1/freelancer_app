"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Zap,
  Receipt,
  CalendarClock,
  Mail,
  RefreshCw,
  ShieldCheck,
  AlarmClock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatCard, StatChip } from "@/components/dashboard/patterns";
import { getAutomationState, type AutomationState } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";

export default function AutomationsPage() {
  const { data: state, loading, refresh: loadData } = useApiData<AutomationState>(
    "automations:state",
    async (token) => {
      return await getAutomationState(token);
    },
    { reportContext: "automations" }
  );

  const usd = (n: number | undefined) =>
    `$${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[148px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const enabled = state?.enabled ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart Automations"
        subtitle="Background workflows that chase payments and protect your calendar — while you sleep."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        }
      />

      {!enabled && (
        <div className="rounded-xl border border-warn/25 bg-warn/10 px-5 py-4 flex items-start gap-3">
          <AlarmClock className="w-5 h-5 text-warn shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-warn">
              Automations are currently inactive
            </p>
            <p className="text-xs text-muted mt-1">
              The background workers below are deployed but idle. Set{" "}
              <code className="font-mono">INNGEST_ENABLED=true</code> in{" "}
              <code className="font-mono">apps/api/.env</code> (and run the
              Inngest Dev Server locally) to switch them on.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Overdue Invoice Protection"
          value={state ? state.overdue_invoice_count : 0}
          icon={Receipt}
          rows={[
            {
              text: `${state ? usd(state.overdue_invoice_amount) : "$0.00"} past due`,
              dot: (state?.overdue_invoice_count ?? 0) > 0 ? "danger" : "ok",
            },
            { text: "Auto-marked daily at 06:00 UTC", dot: enabled ? "ok" : "warn" },
          ]}
        />
        <StatCard
          label="4-Day Payment Reminders"
          value={state ? state.sent_unpaid_count : 0}
          icon={Mail}
          rows={[
            { text: "invoice(s) awaiting reminder", dot: "info" },
            {
              text: `Emailed ${state?.reminder_grace_days ?? 4}d after due date`,
              dot: enabled ? "ok" : "warn",
            },
          ]}
        />
        <StatCard
          label="Meeting Reminders"
          value={state ? state.upcoming_appointments_7d_count : 0}
          icon={CalendarClock}
          rows={[
            { text: "booking(s) in the next 7 days", dot: "info" },
            {
              text: "Clients nudged 24h before",
              dot: enabled ? "ok" : "warn",
            },
          ]}
        />
        <StatCard
          label="Email Delivery"
          value={state?.email_provider === "resend" ? "Live" : "Console"}
          icon={Zap}
          rows={[
            {
              text:
                state?.email_provider === "resend"
                  ? "Delivered via Resend"
                  : "Logged only (dev mode)",
              dot: state?.email_provider === "resend" ? "ok" : "warn",
            },
          ]}
        />
      </div>

      <div className="rounded-xl border border-line bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-fg" />
          <h2 className="text-[17px] font-medium text-fg">How the pipeline works</h2>
          <StatChip tone={enabled ? "ok" : "warn"} className="ml-auto">
            {enabled ? "Workers online" : "Workers idle"}
          </StatChip>
        </div>
        <ol className="space-y-3 text-sm text-muted">
          <li>
            <span className="text-fg font-medium">Invoice goes Sent</span> — an{" "}
            <code className="font-mono text-xs">invoice.sent</code> event durable-queues
            a one-off reminder workflow.
          </li>
          <li>
            <span className="text-fg font-medium">Durable sleep</span> — the workflow
            sleeps until {state?.reminder_grace_days ?? 4} days past the due date
            (survives restarts and deploys).
          </li>
          <li>
            <span className="text-fg font-medium">Payment re-check</span> — before
            sending, the invoice status is verified; paid invoices are never nagged.
          </li>
          <li>
            <span className="text-fg font-medium">Reminder email</span> — a polite
            follow-up with a payment link goes out through the active provider.
          </li>
          <li>
            <span className="text-fg font-medium">Bookings</span> — scheduling a
            consultation queues a 24-hours-before reminder with the meeting link.
          </li>
        </ol>
      </div>
    </div>
  );
}
