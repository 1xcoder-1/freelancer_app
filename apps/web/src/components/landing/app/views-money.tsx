"use client";

import * as React from "react";
import { Amount, AccentButton, AppVisualCard, DueTag, GroupHeading, IconButton, PageTitle, RosterCount, StatusTag } from "./primitives";

/* Invoices panel (InvoicesPanel.tsx) */
export function MoneyView() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageTitle
          title="Invoices & Billing"
          subtitle="Draft, send and chase payments without leaving the roster."
        />
        <div className="flex shrink-0 items-center gap-2.5">
          <IconButton label="Refresh" />
          <AccentButton>
            <span>Issue Invoice</span>
          </AccentButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <RosterCount>12 Total Invoices</RosterCount>
        <span className="hidden font-mono text-xs text-[#a19d98] sm:inline">
          across 4 categories
        </span>
      </div>

      <div className="space-y-4">
        <GroupHeading>Overdue Payments</GroupHeading>
        <div className="grid grid-cols-3 gap-4">
          <AppVisualCard
            title="INV-023"
            subtitle="Client: Nova Studio"
            badge={<Amount>$3,000</Amount>}
            tags={
              <>
                <StatusTag tone="overdue">Overdue</StatusTag>
                <DueTag>Due 09/28/2026</DueTag>
              </>
            }
          />
          <AppVisualCard
            title="INV-019"
            subtitle="Client: Kite Legal"
            badge={<Amount>$1,450</Amount>}
            tags={
              <>
                <StatusTag tone="overdue">Overdue</StatusTag>
                <DueTag>Due 09/15/2026</DueTag>
              </>
            }
          />
          <AppVisualCard
            title="INV-021"
            subtitle="Client: Orbit Press"
            badge={<Amount>$640</Amount>}
            tags={<StatusTag tone="sent">Sent to Client</StatusTag>}
          />
        </div>
      </div>

      <div className="space-y-4">
        <GroupHeading>Paid &amp; Settled</GroupHeading>
        <div className="grid grid-cols-3 gap-4">
          <AppVisualCard
            title="INV-024"
            subtitle="Client: Acme Corp"
            badge={<Amount>$1,200</Amount>}
            tags={<StatusTag tone="paid">★ Paid</StatusTag>}
          />
          <AppVisualCard
            title="INV-022"
            subtitle="Client: Helio Media"
            badge={<Amount>$800</Amount>}
            tags={<StatusTag tone="paid">★ Paid</StatusTag>}
          />
          <AppVisualCard
            title="INV-018"
            subtitle="Client: Cobalt Co"
            badge={<Amount>$2,300</Amount>}
            tags={<StatusTag tone="paid">★ Paid</StatusTag>}
          />
        </div>
      </div>
    </div>
  );
}
