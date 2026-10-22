"use client";

import { useMemo, useState } from "react";
import {
  Link2,
  Copy,
  Check,
  RefreshCw,
  Receipt,
  FileSignature,
  ClipboardList,
  Calendar,
  PenLine,
  LayoutGrid,
  ExternalLink,
  ShieldCheck,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard, FilterPill } from "@/components/dashboard/patterns";
import { getShareLinks, type ShareLink } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
import { usePlan } from "@/hooks/use-plan";
import { PlanFeatureLock } from "@/components/dashboard/PlanLimit";

const MODULE_META: Record<string, { label: string; icon: React.ElementType }> = {
  invoices: { label: "Pay links", icon: Receipt },
  contracts: { label: "Signature links", icon: FileSignature },
  intake: { label: "Intake forms", icon: ClipboardList },
  booking: { label: "Booking pages", icon: Calendar },
  planner: { label: "Shared boards", icon: PenLine },
  projects: { label: "Client portals", icon: LayoutGrid },
};

const MODULE_ORDER = ["invoices", "contracts", "intake", "booking", "planner", "projects"];

// Revocation is owned by the module that minted the token, so each row points
// at the page where that happens instead of duplicating the control here.
const MANAGE_HREF: Record<string, string> = {
  invoices: "/dashboard/projects?tab=invoices",
  contracts: "/dashboard/projects?tab=contracts",
  intake: "/dashboard/clients?tab=forms",
  booking: "/dashboard/booking",
  planner: "/dashboard/planner",
  projects: "/dashboard/projects",
};

export function ShareLinksPanel() {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const { snapshot, insight } = usePlan();

  const { data: linkData, loading, refresh } = useApiData<ShareLink[]>(
    "share-links:all",
    async (token) => getShareLinks(token),
    { reportContext: "links" }
  );

  const links = useMemo(() => linkData ?? [], [linkData]);
  const active = links.filter((l) => l.is_active);
  const grouped = useMemo(() => {
    const byModule: Record<string, ShareLink[]> = {};
    for (const link of links) {
      if (moduleFilter !== "all" && link.module !== moduleFilter) continue;
      (byModule[link.module] ??= []).push(link);
    }
    return byModule;
  }, [links, moduleFilter]);

  const copy = async (link: ShareLink) => {
    const absolute = link.url.startsWith("http") ? link.url : `${window.location.origin}${link.url}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopiedPath(link.path);
      setTimeout(() => setCopiedPath(null), 2500);
    } catch {
      // Clipboard is blocked (permissions or http): open the link so the URL
      // bar is right there instead of leaving the row a dead end.
      window.open(absolute, "_blank");
    }
  };

  if (snapshot && !insight("shared_links")) {
    return (
      <PlanFeatureLock
        title="Shared links ship on a paid plan"
        body="One audit view of every public token the book issues — pay links, signature links, intake forms and client portals. It unlocks on the tier that sells insights."
        feature="insights"
        backHref="/dashboard"
        backLabel="Back to dashboard"
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">Shared Links</h2>
            <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
              {loading ? "Loading..." : `${active.length} Live`}
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Every public token the book has issued — pay links, signature links, intake forms,
            booking pages, shared boards and client portals — in one audit view.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh(true)}
          disabled={loading}
          className="border-line text-fg bg-card hover:bg-surface w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Counts per module */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Public links"
          value={links.length}
          icon={Link2}
          rows={[
            { text: `${active.length} Reachable now`, dot: "ok" },
            { text: `${links.length - active.length} Closed`, dot: "danger" },
          ]}
        />
        <StatCard
          label="Money out the door"
          value={links.filter((l) => l.kind === "pay_link" && l.is_active).length}
          icon={Receipt}
          rows={[{ text: "Pay links waiting on a client", dot: "info" }]}
        />
        <StatCard
          label="Unsigned papers"
          value={links.filter((l) => l.kind === "esign_link" && l.is_active).length}
          icon={FileSignature}
          rows={[{ text: "Signature links still open", dot: "warn" }]}
        />
        <StatCard
          label="Open doors"
          value={links.filter((l) => ["intake_form", "booking_page", "readonly_board", "client_portal"].includes(l.kind) && l.is_active).length}
          icon={ShieldCheck}
          rows={[{ text: "Forms, bookings, boards, portals", dot: "ok" }]}
        />
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterPill active={moduleFilter === "all"} onClick={() => setModuleFilter("all")}>
          All modules ({links.length})
        </FilterPill>
        {MODULE_ORDER.filter((m) => links.some((l) => l.module === m)).map((m) => (
          <FilterPill key={m} active={moduleFilter === m} onClick={() => setModuleFilter(m)}>
            {MODULE_META[m]?.label ?? m} ({links.filter((l) => l.module === m).length})
          </FilterPill>
        ))}
      </div>

      {/* Links */}
      {loading && links.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : links.length === 0 ? (
        <Card className="bg-card border-dashed border-line p-12 text-center rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
            <Link2 className="w-7 h-7 text-accent" />
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">No public links yet</h3>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">
            Send an invoice, share a contract, publish an intake form or open a booking page — each
            one appears here the moment it exists.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.keys(grouped)
            .sort((a, b) => MODULE_ORDER.indexOf(a) - MODULE_ORDER.indexOf(b))
            .map((module) => {
              const meta = MODULE_META[module] ?? { label: module, icon: Link2 };
              const Icon = meta.icon;
              return (
                <div key={module} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base md:text-lg font-medium tracking-wide text-fg flex items-center gap-2">
                      <Icon className="w-4 h-4 text-accent" />
                      {meta.label}
                    </h3>
                    <a
                      href={MANAGE_HREF[module]}
                      className="text-xs text-muted hover:text-fg transition-colors"
                    >
                      Manage in module →
                    </a>
                  </div>

                  <div className="rounded-2xl border border-line bg-card divide-y divide-line overflow-hidden">
                    {grouped[module].map((link) => (
                      <div key={link.path} className="flex items-center gap-3 px-4 py-3.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${link.is_active ? "bg-ok" : "bg-faint"}`}
                          title={link.is_active ? "Live" : "Closed"}
                        />

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-fg truncate">{link.label}</p>
                          <p className="text-xs text-muted truncate">
                            {[link.subtitle, link.status].filter(Boolean).join(" · ")}
                          </p>
                        </div>

                        <span className="hidden md:inline text-[11px] font-mono text-faint truncate max-w-[220px]">
                          {link.path}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void copy(link)}
                            className="h-8 px-2.5 rounded-lg border-line text-fg bg-card hover:bg-surface"
                            title="Copy the public URL"
                          >
                            {copiedPath === link.path ? (
                              <Check className="w-3.5 h-3.5 text-ok" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </Button>
                          <a
                            href={link.url.startsWith("http") ? link.url : link.path}
                            target="_blank"
                            rel="noreferrer"
                            title="Open in a new tab"
                            className="p-2 rounded-lg border border-line text-muted hover:text-fg hover:bg-surface transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={MANAGE_HREF[link.module]}
                            title="Revoke or rotate in the owning module"
                            className="hidden sm:inline-flex text-[11px] font-mono px-2.5 py-1.5 rounded-lg border border-line text-muted hover:text-fg hover:border-line-strong transition-colors"
                          >
                            {link.is_active ? "REVOKE" : "CLOSED"}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
