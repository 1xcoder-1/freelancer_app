"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Users,
  Building2,
  Loader2,
  FileText,
  ExternalLink,
  Trash2,
  Pencil,
  ArrowUpRight,
  Receipt,
  FolderKanban,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getClient, deleteClient, type Client } from "@/lib/api";
import { invalidateCache } from "@/hooks/use-api-data";
import { useWorkspaceCurrency } from "@/hooks/use-workspace-currency";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { ClientProductivityTabs } from "@/components/dashboard/panels/ClientProductivityTabs";
import { usePlanCapacity } from "@/components/dashboard/PlanLimit";
import { logHandledError } from "@/lib/log-error";

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = String(params?.id || "");
  const { getToken } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const currency = useWorkspaceCurrency().currency || "USD";
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const capacity = usePlanCapacity("clients");

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!clientId) return;
      try {
        const token = (await getToken()) || undefined;
        const clientData = await getClient(clientId, token);

        if (!mounted) return;
        setClient(clientData);
      } catch (err) {
        logHandledError("Error loading client details:", err);
        toast.error("Could not load client profile");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [clientId, getToken]);

  const handleDelete = async () => {
    if (!client) return;
    const ok = await confirmDialog({
      title: "Delete Client Profile",
      message: `Are you sure you want to delete "${client.name}"? This cannot be undone.`,
      confirmLabel: "Delete Client",
      danger: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const token = (await getToken()) || undefined;
      await deleteClient(client.id, token);
      invalidateCache("clients:data");
      invalidateCache("dashboard:data");
      invalidateCache("invoices:data");
      toast.success("Client deleted successfully");
      router.push("/dashboard/clients");
    } catch (err) {
      logHandledError(err);
      toast.error("Failed to delete client");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6">
        <Skeleton className="h-6 w-36 rounded-lg" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="max-w-5xl mx-auto pt-6 px-3 sm:px-6">
        <Card className="bg-card border-dashed border-line rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-display text-xl font-medium text-fg">Client not found</h3>
          <p className="text-muted text-sm max-w-sm mx-auto">
            This client profile might have been removed or does not exist in your workspace.
          </p>
          <Link
            href="/dashboard/clients"
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Clients
          </Link>
        </Card>
      </div>
    );
  }

  // Parse notes and metadata
  let category = "Featured";
  let linkedIn = "";
  let rateDisplay = "";
  let clientCurrency = currency;
  let paymentTerms = "";
  let rawNotes = client.notes || "";

  if (rawNotes) {
    const catMatch = rawNotes.match(/\[category:\s*([^\]]+)\]/i);
    if (catMatch && catMatch[1] && catMatch[1].trim() !== "[object Object]") {
      category = catMatch[1].trim();
    } else if (client.status === "vip") {
      category = "VIP & Enterprise";
    }

    const linkMatch = rawNotes.match(/\[linkedin:\s*([^\]]+)\]/i);
    if (linkMatch && linkMatch[1] && linkMatch[1].trim() !== "[object Object]" && !linkMatch[1].includes("[object Object]")) {
      linkedIn = linkMatch[1].trim();
    }

    const rateMatch = rawNotes.match(/\[rate:\s*([A-Z]{3})?\s*([^\]]+)\]/i);
    if (rateMatch) {
      if (rateMatch[1] && rateMatch[1].trim() !== "[object Object]") clientCurrency = rateMatch[1].trim();
      if (rateMatch[2] && rateMatch[2].trim() !== "[object Object]" && !rateMatch[2].includes("[object Object]")) {
        const rawRate = rateMatch[2].trim();
        const suffixMatch = rawRate.match(/\s*(\/.*|[a-zA-Z]+)$/);
        const suffix = suffixMatch ? suffixMatch[0] : "";
        const numericOnly = suffixMatch ? rawRate.slice(0, suffixMatch.index) : rawRate;
        const clean = numericOnly.replace(/,/g, "").replace(/[^\d.]/g, "");
        if (clean) {
          const parts = clean.split(".");
          const intStr = parts[0];
          const formattedInt = intStr ? Number(intStr).toLocaleString("en-US") : "0";
          rateDisplay = parts.length > 1 ? `${formattedInt}.${parts[1]}${suffix}` : `${formattedInt}${suffix}`;
        } else {
          rateDisplay = rawRate;
        }
      }
    }

    const TERMS_FORMAT_MAP: Record<string, string> = {
      "50_advance_50_completion": "50% Advance / 50% on Completion",
      "100_advance": "100% Advance Payment",
      "30_advance_70_completion": "30% Advance / 70% on Completion",
      "on_completion": "100% on Project Completion",
      "net_7": "Net 7 Days",
      "net_15": "Net 15 Days",
      "net_30": "Net 30 Days",
      "monthly_advance": "Monthly Fixed (Advance)",
    };

    const formatTerms = (raw: string): string => {
      if (!raw) return "";
      const cleanKey = raw.toLowerCase().trim().replace(/[\s-]+/g, "_");
      if (TERMS_FORMAT_MAP[cleanKey]) {
        return TERMS_FORMAT_MAP[cleanKey];
      }
      const advCompMatch = raw.match(/(\d+)\s*(?:advance|\%?\s*advance)?\s*[\/\-&]?\s*(\d+)\s*(?:completion|\%?\s*completion)/i);
      if (advCompMatch) {
        return `${advCompMatch[1]}% Advance / ${advCompMatch[2]}% on Completion`;
      }
      if (/^100\s*(?:advance)?/i.test(raw)) {
        return "100% Advance Payment";
      }
      return raw.replace(/_/g, " ");
    };

    const termsMatch = rawNotes.match(/\[terms:\s*([^\]]+)\]/i);
    if (termsMatch && termsMatch[1] && termsMatch[1].trim() !== "[object Object]" && !termsMatch[1].includes("[object Object]")) {
      paymentTerms = formatTerms(termsMatch[1].trim());
    }

    // Strip metadata tags for clean readable notes
    rawNotes = rawNotes
      .replace(/\[category:\s*[^\]]+\]/gi, "")
      .replace(/\[role:\s*[^\]]+\]/gi, "")
      .replace(/\[vip:\s*[^\]]+\]/gi, "")
      .replace(/\[channel:\s*[^\]]+\]/gi, "")
      .replace(/\[linkedin:\s*[^\]]+\]/gi, "")
      .replace(/\[rate:\s*[^\]]+\]/gi, "")
      .replace(/\[terms:\s*[^\]]+\]/gi, "")
      .replace(/\[address:\s*[^\]]+\]/gi, "")
      .replace(/\[object Object\]/gi, "")
      .trim();
  }

  const isVip = client.status === "vip";

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6 enter-stagger">
      {/* Top Breadcrumb & Quick Nav */}
      <div className="flex items-center justify-between pb-1">
        <Link
          href="/dashboard/clients"
          className="group inline-flex items-center gap-2 text-xs font-medium text-muted hover:text-fg transition-colors cursor-pointer"
        >
          <span className="w-6 h-6 rounded-lg bg-surface border border-line/70 flex items-center justify-center transition-all group-hover:bg-surface-elevated group-hover:border-line-strong group-hover:-translate-x-0.5">
            <ArrowLeft className="w-3.5 h-3.5 text-muted group-hover:text-fg" />
          </span>
          <span className="text-muted/80">Clients</span>
          <span className="text-faint">/</span>
          <span className="text-fg font-medium capitalize">{client.name}</span>
        </Link>
      </div>

      {/* Main Header Card: Title, Status & Actions */}
      <div className="relative overflow-hidden rounded-2xl border border-line/70 bg-gradient-to-b from-card to-card/90 p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-fg capitalize">
              {client.name}
            </h1>

            {/* Status Pill with Ambient Glow */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border capitalize ${
                isVip
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/25 shadow-[0_0_12px_rgba(245,158,11,0.12)]"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.12)]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isVip ? "bg-amber-400" : "bg-emerald-400 animate-pulse"
                }`}
              />
              <span>{isVip ? "★ VIP Client" : client.status || "Active Client"}</span>
            </span>

            {/* Category Pill */}
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border bg-sky-500/10 text-sky-400 border-sky-500/20">
              {category}
            </span>
          </div>

          {client.company_name && (
            <p className="text-xs text-muted font-normal flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-accent" />
              <span className="text-fg font-medium">{client.company_name}</span>
            </p>
          )}
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
          <Link href={`/dashboard/clients/${client.id}/edit`}>
            <Button
              variant="outline"
              size="sm"
              className="border-line text-fg bg-card hover:bg-surface text-xs rounded-xl h-9 px-3.5 cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="border-line text-muted hover:text-danger hover:bg-danger/10 text-xs rounded-xl h-9 w-9 p-0 flex items-center justify-center cursor-pointer transition-colors"
            title="Delete Client"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Client Productivity Tabs: Overview, Finances, Documents */}
      <ClientProductivityTabs clientId={clientId} />

      {/* Main Details Grid (2 Columns: Main 8 cols, Side 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Billing Overview & Notes (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Billing Rate Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-card to-card/90 border border-line/70 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-muted">Agreed Billing Rate</span>
              <div className="text-2xl font-mono font-medium text-fg">
                {rateDisplay ? `${clientCurrency} ${rateDisplay}` : "Standard Rates"}
              </div>
            </div>
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
              {isVip ? "VIP Roster" : "Active Roster"}
            </span>
          </div>

          {/* Scope & Notes */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line/70 bg-gradient-to-b from-card to-card/90 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-3.5">
            <div className="flex items-center gap-2 pb-2.5 border-b border-line">
              <FileText className="w-4 h-4 text-accent" />
              <h2 className="font-display text-base sm:text-lg font-medium tracking-wide text-fg">
                Notes & Special Instructions
              </h2>
            </div>

            {rawNotes ? (
              <p className="text-sm sm:text-[15px] text-fg leading-relaxed whitespace-pre-wrap">
                {rawNotes}
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-muted italic">
                No special instructions or notes added yet. Click &quot;Edit Profile&quot; to add details.
              </p>
            )}
          </Card>
        </div>

        {/* Right Column: Key Contact & Metadata (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-5 rounded-2xl border-line/70 bg-gradient-to-b from-card to-card/90 shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] space-y-4">
            <h2 className="font-display text-base font-medium tracking-wide text-fg pb-2 border-b border-line">
              Contact Details
            </h2>

            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-medium text-muted  tracking-wider block mb-0.5">Email Address</span>
                {client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="text-[13px] sm:text-sm text-fg font-medium hover:text-accent transition-colors break-all block"
                  >
                    {client.email}
                  </a>
                ) : (
                  <span className="text-[13px] text-muted">Not specified</span>
                )}
              </div>

              <div>
                <span className="text-[11px] font-medium text-muted  tracking-wider block mb-0.5">Phone / WhatsApp</span>
                {client.phone ? (
                  <a
                    href={`tel:${client.phone}`}
                    className="text-[13px] sm:text-sm text-fg font-mono font-medium hover:text-accent transition-colors block"
                  >
                    {client.phone}
                  </a>
                ) : (
                  <span className="text-[13px] text-muted">Not specified</span>
                )}
              </div>

              {client.website && (
                <div>
                  <span className="text-[11px] font-medium text-muted  tracking-wider block mb-0.5">Website</span>
                  <a
                    href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] sm:text-sm text-accent font-medium hover:underline inline-flex items-center gap-1.5 break-all"
                  >
                    <span>{client.website}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              )}

              {linkedIn && (
                <div>
                  <span className="text-[11px] font-medium text-muted  tracking-wider block mb-0.5">LinkedIn Profile</span>
                  <a
                    href={linkedIn.startsWith("http") ? linkedIn : `https://${linkedIn}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] sm:text-sm text-accent font-medium hover:underline inline-flex items-center gap-1.5 break-all"
                  >
                    <span>{linkedIn}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>
              )}

              {paymentTerms && (
                <div>
                  <span className="text-[11px] font-medium text-muted uppercase tracking-wider block mb-0.5">Payment Terms</span>
                  <span className="text-[13px] sm:text-sm text-fg font-medium font-sans block">{paymentTerms}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Clean Quick Shortcuts */}
          <div className="space-y-2">
            <Link href={`/dashboard/projects?client=${client.id}`} className="block">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between h-10 px-3.5 text-xs sm:text-[13px] font-medium rounded-xl border-line bg-card hover:bg-surface/60 group transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2.5 text-fg font-medium">
                  <FolderKanban className="w-4 h-4 text-accent" />
                  Client Projects
                </span>
                <div className="flex items-center gap-1.5">

                  <ArrowUpRight className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors" />
                </div>
              </Button>
            </Link>

            <Link href={`/dashboard/invoices?client=${client.id}`} className="block">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between h-10 px-3.5 text-xs sm:text-[13px] font-medium rounded-xl border-line bg-card hover:bg-surface/60 group transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2.5 text-fg font-medium">
                  <Receipt className="w-4 h-4 text-accent" />
                  Invoices
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
