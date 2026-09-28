"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Target,
  Plus,
  RefreshCw,
  PhoneCall,
  Trash2,
  AlertTriangle,
  CalendarClock,
  Trophy,
  DollarSign,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getLeads,
  getPipelineInsights,
  createLead,
  updateLead,
  logLeadContact,
  deleteLead,
  type Lead,
  type LeadStage,
  type PipelineInsights,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { z } from "zod";
import { validateOrToast, nameSchema, emailSchema, moneySchema } from "@/lib/validation";

const leadSchema = z.object({
  name: nameSchema("Lead name"),
  email: emailSchema,
  estimatedValue: moneySchema("Estimated value"),
});

const STAGES: Array<{ key: LeadStage; label: string; tone: string }> = [
  { key: "new", label: "New", tone: "bg-surface text-muted" },
  { key: "contacted", label: "Contacted", tone: "bg-info/10 text-info" },
  { key: "proposal", label: "Proposal", tone: "bg-accent-soft text-accent" },
  { key: "negotiation", label: "Talking price", tone: "bg-warn/10 text-warn" },
  { key: "won", label: "Won", tone: "bg-ok/10 text-ok" },
  { key: "lost", label: "Lost", tone: "bg-danger/10 text-danger" },
];

const SOURCES = ["Referral", "Platform", "Outreach", "Website", "Social", "Other"];

const money = (n: number, currency: string) =>
  `${currency === "USD" ? "$" : `${currency} `}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const daysSince = (iso?: string | null): number | null => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
};

export function LeadsPanel() {
  const { getToken } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("Referral");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [followUpDays, setFollowUpDays] = useState("3");

  const { data: leadsData, loading, refresh: loadLeads } = useApiData<Lead[]>(
    "leads:data",
    async (token) => getLeads(token),
    { reportContext: "leads" }
  );

  const { data: insights, refresh: loadInsights } = useApiData<PipelineInsights>(
    "leads:insights",
    async (token) => getPipelineInsights(token),
    { reportContext: "leads-insights" }
  );

  const leads = leadsData ?? [];
  const currency = insights?.currency ?? "USD";

  const reloadBoth = () => {
    invalidateCache("leads:insights");
    invalidateCache("clients:data");
    invalidateCache("dashboard:data");
    loadLeads();
    loadInsights();
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOrToast(leadSchema, { name, email, estimatedValue: parseFloat(estimatedValue || "0") || 0 })) return;
    setSaving(true);
    setFormError(null);
    try {
      const token = (await getToken()) || undefined;
      const days = Math.min(90, Math.max(0, parseInt(followUpDays || "3", 10) || 3));
      const nextFollowUp = new Date(Date.now() + days * 86_400_000).toISOString();
      await createLead(
        {
          name,
          company: company || undefined,
          email,
          source,
          priority,
          estimated_value: parseFloat(estimatedValue || "0") || 0,
          next_follow_up_at: nextFollowUp,
        },
        token
      );
      setShowCreateModal(false);
      setName("");
      setCompany("");
      setEmail("");
      setEstimatedValue("");
      reloadBoth();
      toast.success("Lead saved");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the lead. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const moveStage = async (lead: Lead, direction: 1 | -1) => {
    setBusyLeadId(lead.id);
    try {
      const token = (await getToken()) || undefined;
      const idx = STAGES.findIndex((s) => s.key === lead.stage);
      // Lost is a dead-end column reachable only via its own button; advancing
      // past "won" and going before "new" are no-ops.
      const nextIdx = Math.min(STAGES.length - 2, Math.max(0, idx + direction));
      if (nextIdx !== idx) {
        await updateLead(lead.id, { stage: STAGES[nextIdx].key }, token);
        reloadBoth();
      }
    } catch (err) {
      console.error("Error moving lead:", err);
    } finally {
      setBusyLeadId(null);
    }
  };

  const setStage = async (lead: Lead, stage: LeadStage) => {
    setBusyLeadId(lead.id);
    try {
      const token = (await getToken()) || undefined;
      await updateLead(lead.id, { stage }, token);
      reloadBoth();
    } catch (err) {
      console.error("Error updating lead:", err);
    } finally {
      setBusyLeadId(null);
    }
  };

  const handleLogContact = async (lead: Lead) => {
    setBusyLeadId(lead.id);
    try {
      const token = (await getToken()) || undefined;
      const days = 3;
      await logLeadContact(
        lead.id,
        { next_follow_up_at: new Date(Date.now() + days * 86_400_000).toISOString() },
        token
      );
      reloadBoth();
    } catch (err) {
      console.error("Error logging contact:", err);
    } finally {
      setBusyLeadId(null);
    }
  };

  const handleDelete = async (lead: Lead) => {
    const ok = await confirmDialog({
      title: "Delete lead",
      message: `Delete the lead for ${lead.name}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteLead(lead.id, token);
      reloadBoth();
      toast.success("Lead deleted");
    } catch (err) {
      console.error("Error deleting lead:", err);
      toast.error("Could not delete lead");
    }
  };

  const inputCls =
    "w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold tracking-tight text-fg">Leads</h2>
            <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs">
              {loading ? "Loading..." : `${leads.length} deals`}
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Track every potential client until they say yes or no.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => { loadLeads(true); loadInsights(true); }} disabled={loading} className="border-line text-fg">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Pipeline health strip */}
      {insights ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-card border-line p-4">
            <div className="flex items-center gap-2 text-muted text-xs font-semibold">
              <DollarSign className="w-3.5 h-3.5 text-accent" /> Possible money
            </div>
            <p className="text-xl font-bold text-fg mt-1.5">{money(insights.open_pipeline_value, currency)}</p>
            <p className="text-[11px] text-muted mt-0.5">Realistic: {money(insights.weighted_pipeline_value, currency)}</p>
          </Card>
          <Card className="bg-card border-line p-4">
            <div className="flex items-center gap-2 text-muted text-xs font-semibold">
              <Trophy className="w-3.5 h-3.5 text-ok" /> Win rate
            </div>
            <p className="text-xl font-bold text-fg mt-1.5">{insights.win_rate_pct}%</p>
            <p className="text-[11px] text-muted mt-0.5">{insights.won_count} won · {insights.lost_count} lost</p>
          </Card>
          <Card className={`bg-card border-line p-4 ${insights.due_follow_up_count > 0 ? "border-warn/40" : ""}`}>
            <div className="flex items-center gap-2 text-muted text-xs font-semibold">
              <CalendarClock className="w-3.5 h-3.5 text-warn" /> Follow up today
            </div>
            <p className="text-xl font-bold text-fg mt-1.5">{insights.due_follow_up_count}</p>
            <p className="text-[11px] text-muted mt-0.5">waiting on you</p>
          </Card>
          <Card className={`bg-card border-line p-4 ${insights.stale_deal_count > 0 ? "border-danger/40" : ""}`}>
            <div className="flex items-center gap-2 text-muted text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-danger" /> Going cold
            </div>
            <p className="text-xl font-bold text-fg mt-1.5">{insights.stale_deal_count}</p>
            <p className="text-[11px] text-muted mt-0.5">untouched for {insights.stale_after_days}+ days</p>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card border-line p-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-20" />
            </Card>
          ))}
        </div>
      )}

      {/* Pipeline board — stacks vertically on mobile, no horizontal scroll */}
      {loading && leads.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card border-line p-4 space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </Card>
          ))}
        </div>
      ) : leads.length === 0 ? (
        <Card className="bg-card border-line p-10 text-center">
          <Target className="w-10 h-10 text-accent mx-auto mb-3" />
          <h3 className="font-display text-lg font-bold text-fg">No leads yet</h3>
          <p className="text-muted text-sm mt-1 mb-4 max-w-md mx-auto">
            Add anyone you might work with — even a &quot;maybe later&quot; is worth tracking.
          </p>
          <Button onClick={() => setShowCreateModal(true)} className="bg-accent hover:bg-accent-hi text-accent-fg">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Your First Lead
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage.key);
            const stageValue = stageLeads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
            return (
              <Card key={stage.key} className="bg-card border-line p-3">
                <div className="flex items-center justify-between px-1 pb-2 border-b border-dashed border-line">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stage.tone}`}>{stage.label}</span>
                  <span className="text-[11px] text-muted font-mono">
                    {stageLeads.length} · {money(stageValue, currency)}
                  </span>
                </div>
                <div className="space-y-2 pt-2 min-h-[40px]">
                  {stageLeads.length === 0 && (
                    <p className="text-[11px] text-muted/70 italic px-1 py-2">No deals here yet.</p>
                  )}
                  {stageLeads.map((lead) => {
                    const sinceTouch = daysSince(lead.last_contact_at);
                    const isStale = sinceTouch !== null && insights && sinceTouch > insights.stale_after_days && stage.key !== "won" && stage.key !== "lost";
                    const isDueFollowUp = lead.next_follow_up_at ? new Date(lead.next_follow_up_at).getTime() <= Date.now() : false;
                    const busy = busyLeadId === lead.id;
                    return (
                      <div
                        key={lead.id}
                        className={`rounded-xl border p-3 space-y-2 transition-colors ${
                          isStale ? "border-danger/40 bg-danger/5" : "border-line bg-bg"
                        } ${busy ? "opacity-60 pointer-events-none" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-fg truncate">{lead.name}</p>
                            {lead.company && <p className="text-[11px] text-info truncate">{lead.company}</p>}
                          </div>
                          <span className="text-xs font-mono font-bold text-accent shrink-0">
                            {money(lead.estimated_value || 0, currency)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <Badge variant="outline" className="border-line text-muted font-mono">{lead.source || "Referral"}</Badge>
                          {lead.priority === "high" && (
                            <Badge className="bg-danger/10 text-danger border-transparent font-mono">HIGH</Badge>
                          )}
                          {isDueFollowUp && (
                            <Badge className="bg-warn/10 text-warn border-transparent font-mono">DUE</Badge>
                          )}
                          {isStale && (
                            <Badge className="bg-danger/10 text-danger border-transparent font-mono">
                              COLD {sinceTouch}d
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-dashed border-line">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => moveStage(lead, -1)}
                              disabled={stage.key === "new"}
                              className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface disabled:opacity-30"
                              title="Move back a stage"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => moveStage(lead, 1)}
                              disabled={stage.key === "won" || stage.key === "lost"}
                              className="p-1 rounded-md text-muted hover:text-fg hover:bg-surface disabled:opacity-30"
                              title="Advance a stage"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleLogContact(lead)}
                              className="p-1 rounded-md text-muted hover:text-accent hover:bg-surface"
                              title="I reached out today"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            {stage.key !== "won" && stage.key !== "lost" && (
                              <button
                                onClick={() => setStage(lead, "lost")}
                                className="text-[10px] font-semibold text-muted hover:text-danger px-1.5 py-0.5 rounded-md hover:bg-danger/10"
                                title="Mark as lost"
                              >
                                Lost
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(lead)}
                              className="p-1 rounded-md text-muted hover:text-danger hover:bg-surface"
                              title="Delete lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Lead Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md bg-card border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-lg font-bold text-fg">Add New Lead</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-fg text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted">Contact Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dana from Pixel Studio"
                  maxLength={255}
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted">Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Pixel Studio"
                  maxLength={255}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dana@pixelstudio.com"
                  maxLength={255}
                  className={inputCls}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted">Expected Value</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    placeholder="2500"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted">Source</label>
                  <select value={source} onChange={(e) => setSource(e.target.value)} className={inputCls}>
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
                    className={inputCls}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted">Follow up in (days)</label>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={followUpDays}
                    onChange={(e) => setFollowUpDays(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {formError && <p className="text-xs text-danger">{formError}</p>}

              <div className="pt-3 border-t border-line flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="border-line text-fg"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-accent hover:bg-accent-hi text-accent-fg">
                  {saving ? "Saving..." : "Save Lead"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
