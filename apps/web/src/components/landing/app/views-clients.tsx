"use client";

import * as React from "react";
import { Crown, Layers, RefreshCw, Repeat, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AccentButton,
  AppStatCard,
  AppVisualCard,
  GroupHeading,
  IconButton,
  RateTag,
  RosterCount,
  SilenceTag,
  standardBadge,
  vipBadge,
} from "./primitives";

/* Clients panel (ClientsPanel.tsx) */
export function ClientsView({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-6">
      {!compact && (
        <div className="grid grid-cols-4 gap-4">
          <AppStatCard
            label="Total Clients"
            value="8"
            icon={Users}
            rows={[{ text: "3 VIP · 5 Standard", dot: "info" }]}
          />
          <AppStatCard
            label="VIP Accounts"
            value="3"
            icon={Crown}
            rows={[{ text: "3 Active VIPs", dot: "ok" }]}
          />
          <AppStatCard
            label="Repeat Clients"
            value="4"
            icon={Repeat}
            rows={[{ text: "4 Returning Clients", dot: "ok" }]}
          />
          <AppStatCard
            label="Categories"
            value="5"
            icon={Layers}
            rows={[{ text: "5 Roster Groups", dot: "info" }]}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-2">
          <RosterCount>8 Total Clients</RosterCount>
          <span className="hidden font-mono text-xs text-[#a19d98] sm:inline">
            across 5 categories
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <IconButton label="Refresh" />
          <AccentButton>
            <span>Add Client</span>
          </AccentButton>
        </div>
      </div>

      <div className="space-y-4">
        <GroupHeading>VIP &amp; Enterprise</GroupHeading>
        <div className={cn("grid gap-5", compact ? "grid-cols-2" : "grid-cols-3")}>
          <AppVisualCard
            title="Acme Corp"
            subtitle="By Acme Corp"
            badge={vipBadge}
            tags={<RateTag>USD 5,000/hr</RateTag>}
          />
          <AppVisualCard
            title="Nova Studio"
            subtitle="By Nova Studio"
            badge={vipBadge}
            tags={
              <>
                <SilenceTag>47d silent</SilenceTag>
                <RateTag>USD 3,200/hr</RateTag>
              </>
            }
          />
          {!compact && (
            <AppVisualCard
              title="Helio Media"
              subtitle="By Helio Media"
              badge={vipBadge}
              tags={<RateTag>USD 1,800/hr</RateTag>}
            />
          )}
        </div>
      </div>

      <div className="space-y-4">
        <GroupHeading>Active Retainers</GroupHeading>
        <div className={cn("grid gap-5", compact ? "grid-cols-2" : "grid-cols-3")}>
          <AppVisualCard
            title="Kite Legal"
            subtitle="By Kite Legal"
            badge={standardBadge}
            tags={<RateTag>USD 1,500/mo</RateTag>}
          />
          <AppVisualCard
            title="Orbit Press"
            subtitle="By Orbit Press"
            badge={standardBadge}
            tags={<RateTag>3h 20m this week</RateTag>}
          />
          {!compact && (
            <AppVisualCard
              title="Cobalt Co"
              subtitle="By Cobalt Co"
              badge={standardBadge}
              tags={<SilenceTag>62d silent</SilenceTag>}
            />
          )}
        </div>
      </div>
    </div>
  );
}
