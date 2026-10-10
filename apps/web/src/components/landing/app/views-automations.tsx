"use client";

import * as React from "react";
import {
  CalendarClock,
  Mail,
  Receipt,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { AppCard, AppChip, AppStatCard } from "./primitives";

/* Automations panel (AutomationsPanel.tsx, inside Settings → Automations). */
export function AutomationsView() {
  const bullets = [
    {
      lead: "When an invoice goes unpaid past its due date",
      rest: "— a friendly reminder is emailed automatically, then repeated on a schedule you control.",
    },
    {
      lead: "Before a booked meeting",
      rest: "— the client gets an email 24 hours out, so fewer slots go cold.",
    },
    {
      lead: "Overdue invoices are flagged",
      rest: "— on the dashboard the moment a due date passes.",
    },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-md text-sm text-[#a19d98]">
          FreelanceBook works in the background for you — it emails payment reminders and
          meeting reminders, so you don&apos;t have to.
        </p>
        <AppChip tone="green">
          <span className="size-1.5 rounded-full bg-[#22c55e]" />
          Running
        </AppChip>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <AppStatCard
          label="Late invoices"
          value="3"
          icon={Receipt}
          rows={[
            { text: "$5,090.00 past due", dot: "danger" },
            { text: "Checked automatically every day", dot: "ok" },
          ]}
        />
        <AppStatCard
          label="Payment reminders"
          value="3"
          icon={Mail}
          rows={[
            { text: "3 invoice(s) not paid yet", dot: "info" },
            { text: "Emailed 4d after due date", dot: "ok" },
          ]}
        />
        <AppStatCard
          label="Meeting reminders"
          value="2"
          icon={CalendarClock}
          rows={[
            { text: "2 booking(s) in the next 7 days", dot: "info" },
            { text: "Clients emailed 24h before", dot: "ok" },
          ]}
        />
        <AppStatCard
          label="Email delivery"
          value="Live"
          icon={Zap}
          rows={[{ text: "Emails are being sent", dot: "ok" }]}
        />
      </div>

      <AppCard>
        <div className="mb-3 flex items-center gap-2.5">
          <ShieldCheck className="size-5 text-[#f0efed]" />
          <h2 className="text-[17px] font-medium text-[#f0efed]">
            What happens automatically
          </h2>
        </div>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-[#a19d98]">
          {bullets.map((b) => (
            <li key={b.lead}>
              <span className="font-semibold text-[#f0efed]">{b.lead}</span>
              {b.rest}
            </li>
          ))}
        </ul>
      </AppCard>
    </div>
  );
}
