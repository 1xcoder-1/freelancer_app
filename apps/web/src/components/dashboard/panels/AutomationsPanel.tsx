"use client";

import { useState } from "react";
import {
  Zap,
  Receipt,
  CalendarClock,
  Mail,
  ShieldCheck,
  AlarmClock,
} from "@/components/animated-icons";

import { Skeleton } from "@/components/ui/skeleton";
import { StatCard, StatChip } from "@/components/dashboard/patterns";
import { getAutomationState, type AutomationState } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";

export function AutomationsPanel() {
  const { data: state, loading } = useApiData<AutomationState>(
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          FreelanceBook works in the background for you — it emails payment reminders and meeting reminders, so you don't have to.
        </p>
        <StatChip tone={enabled ? "ok" : "warn"}>
          {enabled ? "Running" : "Paused"}
        </StatChip>
      </div>

      {!enabled && (
        <div className="rounded-xl border border-warn/25 bg-warn/10 px-5 py-4 flex items-start gap-3">
          <AlarmClock className="w-5 h-5 text-warn shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-warn">
              Background helpers are off right now
            </p>
            <p className="text-xs text-muted mt-1">
              Payment and meeting reminder emails are paused. They switch on automatically when the service is active.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Late invoices"
          value={state ? state.overdue_invoice_count : 0}
          icon={Receipt}
          rows={[
            {
              text: `${state ? usd(state.overdue_invoice_amount) : "$0.00"} past due`,
              dot: (state?.overdue_invoice_count ?? 0) > 0 ? "danger" : "ok",
            },
            {
              text: "Checked automatically every day", dot: enabled ? "ok" : "warn" },
          ]}
        />
        <StatCard
          label="Payment reminders"
          value={state ? state.sent_unpaid_count : 0}
          icon={Mail}
          rows={[
            { text: "invoice(s) not paid yet", dot: "info" },
            {
              text: `Emailed ${state?.reminder_grace_days ?? 4}d after due date`,
              dot: enabled ? "ok" : "warn",
            },
          ]}
        />
        <StatCard
          label="Meeting reminders"
          value={state ? state.upcoming_appointments_7d_count : 0}
          icon={CalendarClock}
          rows={[
            { text: "booking(s) in the next 7 days", dot: "info" },
            {
              text: "Clients emailed 24h before",
              dot: enabled ? "ok" : "warn",
            },
          ]}
        />
        <StatCard
          label="Email delivery"
          value={state?.email_provider === "resend" ? "Live" : "Console"}
          icon={Zap}
          rows={[
            {
              text:
                state?.email_provider === "resend"
                  ? "Emails are being sent"
                  : "Practice mode (nothing is sent)",
              dot: state?.email_provider === "resend" ? "ok" : "warn",
            },
          ]}
        />
      </div>

      <div className="rounded-xl border border-line bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-fg" />
          <h2 className="text-[17px] font-medium text-fg">What happens automatically</h2>
        </div>
        <ul className="space-y-3 text-sm text-muted list-disc pl-5">
          <li>
            <span className="text-fg font-medium">When an invoice goes unpaid past its due date</span>, a
            polite reminder email is sent to the client {state?.reminder_grace_days ?? 4} days later
            — never if they already paid.
          </li>
          <li>
            <span className="text-fg font-medium">Before a booked meeting</span>, your client gets a
            reminder email 24 hours ahead with the meeting link.
          </li>
          <li>
            <span className="text-fg font-medium">Overdue invoices are flagged</span> for you daily so
            the Money page always shows the honest picture.
          </li>
        </ul>
      </div>
    </div>
  );
}
