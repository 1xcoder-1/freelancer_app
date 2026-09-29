"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Users,
  Building2,
  Mail,
  Phone,
  Globe,
  Briefcase,
  Sparkles,
  MessageSquare,
  Crown,
  Layers,
  Loader2,
  CreditCard,
  CheckCircle2,
  FileText,
  ExternalLink,
  Trash2,
  Pencil,
  ArrowUpRight,
  Receipt,
  FolderKanban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getClient,
  deleteClient,
  getWorkspaceSettings,
  getProjects,
  type Client,
  type Project,
} from "@/lib/api";
import { invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";

function getInitials(name: string) {
  if (!name) return "CL";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = String(params?.id || "");
  const { getToken } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!clientId) return;
      try {
        const token = (await getToken()) || undefined;
        const [clientData, wsData, projectsData] = await Promise.all([
          getClient(clientId, token),
          getWorkspaceSettings(token).catch(() => null),
          getProjects(token).catch(() => [] as Project[]),
        ]);

        if (!mounted) return;
        setClient(clientData);
        setProjects(projectsData || []);
        if (wsData?.currency) {
          setCurrency(wsData.currency);
        }
      } catch (err) {
        console.error("Error loading client details:", err);
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
      console.error(err);
      toast.error("Failed to delete client");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl sm:max-w-7xl mx-auto py-28 text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
        <p className="text-sm font-medium text-muted">Loading client profile...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mx-auto">
          <Users className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-fg">Client Not Found</h2>
        <p className="text-sm text-muted">
          This client profile might have been removed or does not exist in your workspace.
        </p>
        <Link href="/dashboard/clients">
          <Button
            className="rounded-xl px-5 bg-accent hover:bg-accent-hi text-accent-fg font-semibold"
          >
            Back to Clients
          </Button>
        </Link>
      </div>
    );
  }

  // Parse notes and metadata
  let category = "Featured";
  let roleTitle = "";
  let preferredChannel = "Direct Communication";
  let linkedIn = "";
  let rateDisplay = "";
  let clientCurrency = currency;
  let paymentTerms = "";
  let billingAddress = "";
  let rawNotes = client.notes || "";

  if (rawNotes) {
    const catMatch = rawNotes.match(/\[category:\s*([^\]]+)\]/i);
    if (catMatch && catMatch[1] && catMatch[1].trim() !== "[object Object]") {
      category = catMatch[1].trim();
    }

    const roleMatch = rawNotes.match(/\[role:\s*([^\]]+)\]/i);
    if (roleMatch && roleMatch[1] && roleMatch[1].trim() !== "[object Object]" && !roleMatch[1].includes("[object Object]")) {
      roleTitle = roleMatch[1].trim();
    }

    const chanMatch = rawNotes.match(/\[channel:\s*([^\]]+)\]/i);
    if (chanMatch && chanMatch[1] && chanMatch[1].trim() !== "[object Object]" && !chanMatch[1].includes("[object Object]")) {
      preferredChannel = chanMatch[1].trim();
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

    const termsMatch = rawNotes.match(/\[terms:\s*([^\]]+)\]/i);
    if (termsMatch && termsMatch[1] && termsMatch[1].trim() !== "[object Object]" && !termsMatch[1].includes("[object Object]")) {
      paymentTerms = termsMatch[1].trim().replace(/_/g, " ");
    }

    const addrMatch = rawNotes.match(/\[address:\s*([^\]]+)\]/i);
    if (addrMatch && addrMatch[1] && addrMatch[1].trim() !== "[object Object]" && !addrMatch[1].includes("[object Object]")) {
      billingAddress = addrMatch[1].trim();
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
  const initials = getInitials(client.name);

  // Filter client's projects in real-time
  const clientProjects = projects.filter(
    (p) => p.client_id === clientId || (client.name && p.client_name === client.name)
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6">
      {/* Top Navigation & Header */}
      <div className="space-y-4 pb-4 border-b border-line">
        <Link
          href="/dashboard/clients"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Clients</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            {/* Colorful soft pill tags matching reference image */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-medium tracking-wide text-fg mr-1">
                {client.name}
              </h1>

              {/* Status Pill */}
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border capitalize ${
                  isVip
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                }`}
              >
                {isVip ? "★ VIP Client" : client.status || "Active Client"}
              </span>

              {/* Category Pill */}
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25">
                {category}
              </span>
            </div>

            {(client.company_name || roleTitle) && (
              <p className="text-xs text-muted font-normal flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-accent" />
                {client.company_name && (
                  <span className="text-fg font-medium">{client.company_name}</span>
                )}
                {client.company_name && roleTitle && <span>•</span>}
                {roleTitle && <span>{roleTitle}</span>}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/dashboard/clients/${client.id}/edit`}>
              <Button
                variant="outline"
                size="sm"
                className="text-xs rounded-xl h-9 px-3.5 border-line cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit Profile
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs rounded-xl h-9 px-2.5 text-muted hover:text-danger hover:bg-danger/10"
              title="Delete Client"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Details Grid (2 Columns: Main 8 cols, Side 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Billing Overview & Notes (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Billing Rate / Retainer Card */}
          <div className="p-5 rounded-2xl bg-card border border-line flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-muted">Billing Rate / Retainer</span>
              <div className="text-2xl font-mono font-medium text-fg">
                {rateDisplay ? `${clientCurrency} ${rateDisplay}` : "Standard Rates"}
              </div>
            </div>
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
              {isVip ? "VIP Roster" : "Active Roster"}
            </span>
          </div>

          {/* Scope & Notes */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-line">
              <FileText className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-medium text-fg">
                Notes & Special Instructions
              </h2>
            </div>

            {rawNotes ? (
              <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap">
                {rawNotes}
              </p>
            ) : (
              <p className="text-xs text-muted italic">
                No special instructions or notes added yet. Click &quot;Edit Profile&quot; to add details.
              </p>
            )}
          </Card>
        </div>

        {/* Right Column: Key Contact & Metadata (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-5 rounded-2xl border-line bg-card space-y-4">
            <h2 className="text-sm font-medium text-fg pb-2 border-b border-line">
              Contact Details
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted block mb-0.5">Email Address</span>
                {client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="text-fg font-medium hover:text-accent transition-colors break-all"
                  >
                    {client.email}
                  </a>
                ) : (
                  <span className="text-muted">Not specified</span>
                )}
              </div>

              <div>
                <span className="text-muted block mb-0.5">Phone / WhatsApp</span>
                {client.phone ? (
                  <a
                    href={`tel:${client.phone}`}
                    className="text-fg font-mono font-medium hover:text-accent transition-colors"
                  >
                    {client.phone}
                  </a>
                ) : (
                  <span className="text-muted">Not specified</span>
                )}
              </div>

              {client.website && (
                <div>
                  <span className="text-muted block mb-0.5">Website</span>
                  <a
                    href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent font-medium hover:underline inline-flex items-center gap-1 break-all"
                  >
                    <span>{client.website}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}

              {linkedIn && (
                <div>
                  <span className="text-muted block mb-0.5">LinkedIn Profile</span>
                  <a
                    href={linkedIn.startsWith("http") ? linkedIn : `https://${linkedIn}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent font-medium hover:underline inline-flex items-center gap-1 break-all"
                  >
                    <span>{linkedIn}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}

              <div>
                <span className="text-muted block mb-0.5">Preferred Channel</span>
                <span className="text-fg font-medium">{preferredChannel}</span>
              </div>

              {paymentTerms && (
                <div>
                  <span className="text-muted block mb-0.5">Payment Terms</span>
                  <span className="text-fg font-medium capitalize">{paymentTerms}</span>
                </div>
              )}

              {billingAddress && (
                <div>
                  <span className="text-muted block mb-0.5">Billing Address</span>
                  <p className="text-fg font-mono whitespace-pre-wrap">{billingAddress}</p>
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
                className="w-full justify-between text-xs font-medium rounded-xl border-line bg-card hover:bg-surface/60 group transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2 text-fg">
                  <FolderKanban className="w-3.5 h-3.5 text-accent" />
                  Client Projects
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-accent-soft text-accent text-[10px] font-mono px-2 py-0.5 border border-accent/20">
                    {clientProjects.length} {clientProjects.length === 1 ? "Project" : "Projects"}
                  </Badge>
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors" />
                </div>
              </Button>
            </Link>

            <Link href={`/dashboard/invoices?client=${client.id}`} className="block">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between text-xs font-medium rounded-xl border-line bg-card hover:bg-surface/60 group transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2 text-fg">
                  <Receipt className="w-3.5 h-3.5 text-accent" />
                  Invoices & Statements
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
