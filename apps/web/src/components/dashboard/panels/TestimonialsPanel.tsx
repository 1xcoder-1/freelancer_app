"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { z } from "zod";
import {
  Plus,
  Quote,
  Star,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCw,
  ExternalLink,
  Users,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatCard, FilterPill } from "@/components/dashboard/patterns";
import {
  getTestimonials,
  createTestimonialRequest,
  updateTestimonial,
  deleteTestimonial,
  getClients,
  type TestimonialRecord,
  type TestimonialStatus,
  type Client,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { validateOrToast, nameSchema, optionalTextSchema } from "@/lib/validation";

const requestSchema = z.object({
  author_name: nameSchema("Client name", 255),
  author_role: optionalTextSchema("Role", 255),
  context_label: optionalTextSchema("Project", 255),
});

const STATUS_TONE: Record<TestimonialStatus, string> = {
  pending: "bg-warn/10 text-warn border-warn/30",
  approved: "bg-ok/10 text-ok border-ok/30",
  rejected: "bg-faint/10 text-faint border-line",
};

function Stars({ rating }: { rating?: number | null }) {
  if (!rating) return null;
  return (
    <span className="inline-flex items-center gap-0.5" title={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? "text-warn fill-warn" : "text-line"}`}
        />
      ))}
    </span>
  );
}

export function TestimonialsPanel() {
  const { getToken } = useAuth();
  const [filter, setFilter] = useState<"all" | TestimonialStatus>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [authorName, setAuthorName] = useState("");
  const [authorRole, setAuthorRole] = useState("");
  const [contextLabel, setContextLabel] = useState("");
  const [clientId, setClientId] = useState("");

  const { data: pageData, loading, refresh: loadData } = useApiData(
    "testimonials:feed",
    async (token) => {
      const [records, clients] = await Promise.all([
        getTestimonials(undefined, token).catch(() => []),
        getClients(token).catch(() => []),
      ]);
      return { records, clients };
    },
    { reportContext: "testimonials" }
  );

  const records = useMemo(() => pageData?.records ?? [], [pageData]);
  const clients: Client[] = pageData?.clients ?? [];

  const counts = useMemo(
    () => ({
      all: records.length,
      pending: records.filter((r) => r.status === "pending").length,
      approved: records.filter((r) => r.status === "approved").length,
      rejected: records.filter((r) => r.status === "rejected").length,
    }),
    [records]
  );

  const shown = filter === "all" ? records : records.filter((r) => r.status === filter);

  const refreshList = async () => {
    invalidateCache("testimonials:feed");
    await loadData();
  };

  const resetForm = () => {
    setAuthorName("");
    setAuthorRole("");
    setContextLabel("");
    setClientId("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOrToast(requestSchema, { author_name: authorName, author_role: authorRole, context_label: contextLabel })) return;
    setSaving(true);
    try {
      const token = (await getToken()) || undefined;
      await createTestimonialRequest(
        {
          client_id: clientId || undefined,
          author_name: authorName,
          author_role: authorRole || undefined,
          context_label: contextLabel || undefined,
        },
        token
      );
      setDialogOpen(false);
      resetForm();
      await refreshList();
      toast.success("Request created — copy the link and send it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the request");
    } finally {
      setSaving(false);
    }
  };

  // Choosing a client prefills the form: the person you work with most is
  // usually the one worth asking first.
  const pickClient = (id: string) => {
    setClientId(id);
    const client = clients.find((c) => c.id === id);
    if (client && !authorName) setAuthorName(client.name);
    if (client?.company_name && !authorRole) setAuthorRole(client.company_name);
  };

  const copyLink = async (record: TestimonialRecord) => {
    const url = `${window.location.origin}${record.submit_url}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(record.id);
      setTimeout(() => setCopiedId(null), 2500);
      toast.success("Share link copied");
    } catch {
      toast.error("Could not reach the clipboard — open the link instead");
    }
  };

  const setStatus = async (record: TestimonialRecord, status: TestimonialStatus) => {
    try {
      const token = (await getToken()) || undefined;
      await updateTestimonial(record.id, { status }, token);
      await refreshList();
      toast.success(status === "approved" ? "Approved — ready to publish" : status === "rejected" ? "Rejected" : "Moved back to pending");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the testimonial");
    }
  };

  const remove = async (record: TestimonialRecord) => {
    const ok = await confirmDialog({
      title: "Delete request",
      message: "The share link stops working immediately. Anything this client already wrote goes with it.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteTestimonial(record.id, token);
      await refreshList();
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">Testimonials</h2>
            <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
              {loading ? "Loading..." : `${counts.approved} Published`}
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Ask clients for a quote on a single-use link, read what comes back, approve the ones
            you want to show. Nothing you have not approved can render anywhere.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading}
            className="border-line text-fg bg-card hover:bg-surface w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Ask for a Quote
          </Button>
        </div>
      </div>

      {/* Funnel Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Requests sent"
          value={counts.all}
          icon={Quote}
          rows={[
            { text: `${counts.pending} Awaiting a reply`, dot: "warn" },
            { text: `${records.filter((r) => r.submitted_at).length} Answered`, dot: "info" },
          ]}
        />
        <StatCard
          label="Approved quotes"
          value={counts.approved}
          icon={CheckCircle2}
          rows={[
            { text: `${counts.rejected} Set aside`, dot: "danger" },
            { text: "Ready for your profile & site", check: true },
          ]}
        />
        <StatCard
          label="Average rating"
          value={
            records.filter((r) => r.rating).length
              ? `${(
                  records.reduce((sum, r) => sum + (r.rating ?? 0), 0) /
                  records.filter((r) => r.rating).length
                ).toFixed(1)} / 5`
              : "—"
          }
          icon={Star}
          rows={[{ text: "Set when the client submits", dot: "info" }]}
        />
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          All ({counts.all})
        </FilterPill>
        <FilterPill active={filter === "pending"} onClick={() => setFilter("pending")}>
          Pending ({counts.pending})
        </FilterPill>
        <FilterPill active={filter === "approved"} onClick={() => setFilter("approved")}>
          Approved ({counts.approved})
        </FilterPill>
        <FilterPill active={filter === "rejected"} onClick={() => setFilter("rejected")}>
          Rejected ({counts.rejected})
        </FilterPill>
      </div>

      {/* Records */}
      {loading && records.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Card className="bg-card border-dashed border-line p-12 text-center rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
            <Quote className="w-7 h-7 text-accent" />
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            {filter === "all" ? "No quotes collected yet" : `Nothing ${filter}`}
          </h3>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">
            {filter === "all"
              ? "Ask a client you have already delivered for. The link takes them thirty seconds and needs no account."
              : "Switch filters to see the rest of the pile."}
          </p>
          {filter === "all" && (
            <Button
              onClick={() => setDialogOpen(true)}
              className="mt-6 bg-accent hover:bg-accent-hi text-accent-fg font-semibold"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Ask Your First Client
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {shown.map((record) => (
            <Card key={record.id} className="bg-card border-line p-5 rounded-2xl flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg truncate">{record.author_name}</p>
                  <p className="text-xs text-muted truncate">
                    {[record.author_role, record.context_label].filter(Boolean).join(" · ") || "No context set"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`text-[10px] font-mono uppercase ${STATUS_TONE[record.status]}`}>
                    {record.status}
                  </Badge>
                </div>
              </div>

              {record.quote ? (
                <blockquote className="text-sm text-fg/90 leading-relaxed border-l-2 border-accent/40 pl-3">
                  “{record.quote}”
                </blockquote>
              ) : (
                <p className="text-xs text-faint italic">
                  Waiting on the client — send them this link.
                </p>
              )}

              {record.rating && <Stars rating={record.rating} />}

              <div className="flex items-center justify-between gap-2 pt-1 mt-auto border-t border-line/60">
                <span className="text-[11px] font-mono text-faint">
                  {record.submitted_at
                    ? `Answered ${new Date(record.submitted_at).toLocaleDateString()}`
                    : `Asked ${new Date(record.created_at).toLocaleDateString()}`}
                </span>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void copyLink(record)}
                    className="h-8 px-2.5 rounded-lg border-line text-fg bg-card hover:bg-surface"
                    title="Copy the client-facing link"
                  >
                    {copiedId === record.id ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <a
                    href={record.submit_url}
                    target="_blank"
                    rel="noreferrer"
                    title="Preview the submit page"
                    className="p-2 rounded-lg border border-line text-muted hover:text-fg hover:bg-surface transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {record.quote && record.status !== "approved" && (
                    <Button
                      size="sm"
                      onClick={() => void setStatus(record, "approved")}
                      className="h-8 px-2.5 rounded-lg bg-ok/15 text-ok hover:bg-ok/25 border border-ok/30"
                      title="Approve for display"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {record.quote && record.status !== "rejected" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void setStatus(record, "rejected")}
                      className="h-8 px-2.5 rounded-lg border-line text-muted hover:text-danger bg-card"
                      title="Set aside"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {record.status !== "pending" && record.quote && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void setStatus(record, "pending")}
                      className="h-8 px-2.5 rounded-lg border-line text-muted hover:text-fg bg-card"
                      title="Move back to pending"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <button
                    onClick={() => void remove(record)}
                    title="Delete request"
                    className="p-2 rounded-lg text-faint hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Ask dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Quote className="w-4 h-4 text-accent" />
              Ask a client for a quote
            </DialogTitle>
            <DialogDescription>
              We create a single-use link prefilled with who they are and what you did together.
              They type the quote; you decide whether it ever shows.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <Users className="w-3 h-3" /> Link to a client (optional)
              </label>
              <select
                value={clientId}
                onChange={(e) => pickClient(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-line text-sm text-fg focus:outline-none focus:border-accent"
              >
                <option value="">Not linked to a roster entry</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.company_name ? ` — ${c.company_name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 block">
                  Who is writing it
                </label>
                <Input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Dana Reyes"
                  maxLength={255}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 block">
                  Their role or company
                </label>
                <Input
                  value={authorRole}
                  onChange={(e) => setAuthorRole(e.target.value)}
                  placeholder="Head of Product, Acme Corp"
                  maxLength={255}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 block">
                  What you did together
                </label>
                <Input
                  value={contextLabel}
                  onChange={(e) => setContextLabel(e.target.value)}
                  placeholder="Website rebuild, Q3"
                  maxLength={255}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-line text-fg bg-card"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !authorName.trim()}
                className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold"
              >
                {saving ? "Creating…" : "Create request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
