"use client";

import { useEffect, useState, use } from "react";
import {
  FolderKanban,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Building2,
  Sparkles,
  Layers,
  FileCheck,
  Send,
  MessageSquare,
  Check,
  Zap,
  Mail,
  X,
  DollarSign,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPublicProjectPortal,
  approvePublicMilestone,
  verifyPortalRecipient,
  decidePortalChangeRequest,
  type PublicProjectPortal,
} from "@/lib/api";
import { toast } from "sonner";

interface PageProps {
  params: Promise<{ token: string }>;
}

const detail = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { detail?: string } } };
  return e?.response?.data?.detail || fallback;
};

export default function ClientPortalPage({ params }: PageProps) {
  const { token } = use(params);

  const [portal, setPortal] = useState<PublicProjectPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [justApprovedId, setJustApprovedId] = useState<string | null>(null);
  const [clientFeedback, setClientFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  // SE4 recipient guard: a leaked link is inert until the viewer proves the
  // email this project was shared with. Kept locally so approve/decide can
  // re-send it; the server only ever stores it once.
  const [emailInput, setEmailInput] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // P3 change-request decision state.
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [crNote, setCrNote] = useState("");

  useEffect(() => {
    async function loadPortal() {
      try {
        setLoading(true);
        const data = await getPublicProjectPortal(token);
        setPortal(data);
      } catch (err: unknown) {
        setError(detail(err, "Project portal link is invalid or expired."));
      } finally {
        setLoading(false);
      }
    }
    loadPortal();
  }, [token]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = emailInput.trim();
    if (!email) return;
    try {
      setVerifying(true);
      const updated = await verifyPortalRecipient(token, email);
      setPortal(updated);
      setVerifiedEmail(email.toLowerCase());
      toast.success("Verified. You can now approve deliverables and scope changes.");
    } catch (err: unknown) {
      toast.error(detail(err, "That email does not match this project."));
    } finally {
      setVerifying(false);
    }
  };

  const handleApprove = async (milestoneId: string) => {
    if (!verifiedEmail) {
      toast.error("Verify your email above before approving.");
      return;
    }
    try {
      setApprovingId(milestoneId);
      const updated = await approvePublicMilestone(token, milestoneId, verifiedEmail);
      setPortal(updated);
      setJustApprovedId(milestoneId);
      setTimeout(() => setJustApprovedId(null), 3000);
    } catch (err: unknown) {
      toast.error(detail(err, "Failed to approve deliverable."));
    } finally {
      setApprovingId(null);
    }
  };

  const handleDecide = async (crId: string, decision: "approved" | "rejected") => {
    if (!verifiedEmail) {
      toast.error("Verify your email above before deciding.");
      return;
    }
    try {
      setDecidingId(crId);
      const updated = await decidePortalChangeRequest(token, crId, {
        decision,
        email: verifiedEmail,
        note: crNote.trim() || undefined,
      });
      setPortal(updated);
      setCrNote("");
      toast.success(decision === "approved" ? "Change request approved." : "Change request declined.");
    } catch (err: unknown) {
      toast.error(detail(err, "Failed to record your decision."));
    } finally {
      setDecidingId(null);
    }
  };

  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientFeedback.trim()) return;
    setFeedbackSent(true);
    setClientFeedback("");
    setTimeout(() => setFeedbackSent(false), 4000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-fg flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full bg-card border-line p-8 space-y-6">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-40 mx-auto" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </Card>
      </div>
    );
  }

  if (error || !portal) {
    return (
      <div className="min-h-screen bg-bg text-fg flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card border-danger/20 p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-danger mx-auto" />
          <h2 className="text-xl font-bold text-fg">Project Link Not Found</h2>
          <p className="text-sm text-muted">{error || "This client portal link is unavailable."}</p>
        </Card>
      </div>
    );
  }

  const progress = portal.progress_pct || 0;
  const isVerified = Boolean(verifiedEmail);
  const pendingChanges = portal.change_requests.filter((c) => c.status === "requested");
  const decidedChanges = portal.change_requests.filter((c) => c.status !== "requested");

  return (
    <div className="min-h-screen bg-bg text-fg py-10 px-4 sm:px-6 lg:px-8 selection:bg-accent-soft">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">

        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-line pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent hover:bg-accent-hi flex items-center justify-center font-bold text-accent-fg shadow-sm">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-fg tracking-wide">Freelance Book</span>
              <span className="block text-[10px] text-info font-mono tracking-wider">CLIENT PROJECT PORTAL</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isVerified ? (
              <Badge className="bg-accent-soft text-accent border-accent/20 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Recipient Verified
              </Badge>
            ) : (
              <Badge className="bg-warn/20 text-warn border-warn/30 text-xs">
                <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Verify to Approve
              </Badge>
            )}
          </div>
        </div>

        {/* SE4 recipient verification gate */}
        {!isVerified && (
          <Card className="bg-card border-accent/30 p-6 space-y-3">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <Mail className="w-4 h-4 text-accent" /> Confirm it&apos;s you
            </h3>
            <p className="text-xs text-muted">
              To protect this project, approvals and scope decisions require the email your
              freelancer shared this portal with. A leaked link alone cannot approve spend.
            </p>
            <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@company.com"
                className="flex-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
              />
              <Button
                type="submit"
                disabled={verifying || !emailInput.trim()}
                className="bg-accent hover:bg-accent-hi text-accent-fg text-sm font-semibold"
              >
                {verifying ? "Verifying..." : "Verify"}
              </Button>
            </form>
          </Card>
        )}

        {/* Hero Progress Banner */}
        <Card className="relative overflow-hidden bg-card border-line p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-accent-soft rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono text-info tracking-wider uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-info" /> Real-Time Project Progress
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-fg mt-1">{portal.title}</h1>
              <p className="text-xs text-muted mt-1.5 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-faint" /> Prepared for:{" "}
                <span className="text-fg font-medium">{portal.client_name || "Valued Client"}</span>
                <span className="text-faint">•</span>
                <span>By {portal.freelancer_name}</span>
              </p>
            </div>

            <div className="flex flex-col items-end shrink-0">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-accent">
                  {progress}%
                </span>
                <span className="text-xs font-mono text-muted">COMPLETE</span>
              </div>
              <Badge className="mt-1 bg-accent-soft text-info border-accent/30 text-xs capitalize">
                {portal.status.replace("_", " ")}
              </Badge>
            </div>
          </div>

          {/* Animated Glowing Progress Bar */}
          <div className="mt-6 space-y-2">
            <div className="w-full h-3.5 bg-bg rounded-full overflow-hidden p-0.5 border border-line">
              <div
                className="h-full rounded-full bg-accent hover:bg-accent-hi shadow-sm transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-muted">
              <span>{portal.completed_milestones_count} of {portal.total_milestones_count} Milestones Approved</span>
              <span>{portal.completed_tasks_count} Completed Tasks</span>
            </div>
          </div>

          {/* Project Summary Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-line">
            <div className="p-3 rounded-lg bg-bg border border-line space-y-0.5">
              <span className="text-[10px] font-mono text-faint uppercase">Total Budget</span>
              <p className="text-base font-bold text-fg">${portal.budget.toLocaleString()}</p>
            </div>

            <div className="p-3 rounded-lg bg-bg border border-line space-y-0.5">
              <span className="text-[10px] font-mono text-faint uppercase">Active Phase</span>
              <p className="text-base font-bold text-info">
                Phase {Math.min(portal.total_milestones_count, portal.completed_milestones_count + 1)}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-bg border border-line space-y-0.5">
              <span className="text-[10px] font-mono text-faint uppercase">Contract Status</span>
              <p className="text-base font-bold text-accent">
                {portal.contract_signed ? "Signed & Active" : "Pending Signature"}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-bg border border-line space-y-0.5">
              <span className="text-[10px] font-mono text-faint uppercase">Pending Changes</span>
              <p className="text-base font-bold text-warn">{pendingChanges.length}</p>
            </div>
          </div>
        </Card>

        {/* Milestone Deliverables & Approval Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-fg flex items-center gap-2">
                <Layers className="w-5 h-5 text-info" />
                Project Milestones & Deliverables
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Review deliverables and approve each phase to unlock subsequent milestones.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {portal.milestones.map((m, idx) => {
              const isCompleted = m.is_completed;
              const isApproving = approvingId === m.id;
              const isJustApproved = justApprovedId === m.id;

              return (
                <Card
                  key={m.id}
                  className={`p-5 transition-all border ${
                    isCompleted
                      ? "bg-card border-accent"
                      : "bg-card border-line hover:border-accent/30"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                          isCompleted
                            ? "bg-accent-soft text-accent border border-accent/20"
                            : "bg-accent-soft text-info border border-accent/30"
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-fg">{m.title}</h3>
                          {m.amount > 0 && (
                            <span className="text-xs font-mono text-info font-semibold">
                              (${m.amount.toLocaleString()})
                            </span>
                          )}
                          {isCompleted ? (
                            <Badge className="bg-accent-soft text-accent border-accent/20 text-[10px]">
                              Approved & Verified
                            </Badge>
                          ) : m.submitted_at ? (
                            <Badge className="bg-info/15 text-info border-info/30 text-[10px]">
                              Submitted — waiting on you
                            </Badge>
                          ) : (
                            <Badge className="bg-warn/20 text-warn border-warn/30 text-[10px]">
                              In Progress
                            </Badge>
                          )}
                        </div>

                        {m.description && <p className="text-xs text-fg">{m.description}</p>}
                        {m.deliverable_note && (
                          <div className="mt-2 text-xs text-muted flex items-center gap-1.5 font-mono">
                            <Zap className="w-3.5 h-3.5 text-info" />
                            <span>Deliverable: {m.deliverable_note}</span>
                          </div>
                        )}
                        {m.approved_at && (
                          <div className="mt-1 text-[11px] text-faint font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Approved {new Date(m.approved_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action button for Client Approval */}
                    <div className="shrink-0 flex items-center gap-2 sm:self-center">
                      {isCompleted ? (
                        <div className="flex items-center gap-1.5 text-xs text-accent font-semibold px-3 py-1.5 rounded-lg bg-accent border border-accent">
                          <CheckCircle2 className="w-4 h-4" /> Approved
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleApprove(m.id)}
                          disabled={isApproving || !isVerified}
                          title={!isVerified ? "Verify your email first" : undefined}
                          className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs shadow-sm disabled:opacity-50"
                        >
                          {isApproving ? (
                            "Approving..."
                          ) : isJustApproved ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1" /> Approved!
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve Deliverable
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* P3 Change Requests — priced scope changes, client decides here */}
        {(portal.change_requests.length > 0 || isVerified) && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-fg flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-info" />
                Change Requests
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Scope additions with a price and schedule impact. Approving adds them to the project.
              </p>
            </div>

            {portal.change_requests.length === 0 && (
              <Card className="bg-card border-line p-5 text-sm text-muted">No change requests right now.</Card>
            )}

            {pendingChanges.map((c) => (
              <Card key={c.id} className="bg-card border-warn/30 p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-fg">{c.title}</h3>
                    {c.detail && <p className="text-xs text-muted">{c.detail}</p>}
                  </div>
                  <Badge className="bg-warn/20 text-warn border-warn/30 text-[10px] shrink-0">Awaiting your decision</Badge>
                </div>
                <div className="flex items-center gap-4 text-sm font-mono">
                  <span className="text-accent flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> {c.price.toLocaleString()}
                  </span>
                  {c.impact_days > 0 && (
                    <span className="text-muted flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> +{c.impact_days} days
                    </span>
                  )}
                </div>
                {isVerified && (
                  <div className="space-y-2 pt-1 border-t border-line">
                    <input
                      value={decidingId === c.id ? crNote : ""}
                      onChange={(e) => { setDecidingId(c.id); setCrNote(e.target.value); }}
                      placeholder="Optional note with your decision..."
                      className="w-full px-3 py-2 rounded-lg bg-bg border border-line text-fg text-xs focus:outline-none focus:border-accent"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleDecide(c.id, "approved")}
                        className="bg-accent hover:bg-accent-hi text-accent-fg text-xs font-semibold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                      <Button
                        onClick={() => handleDecide(c.id, "rejected")}
                        className="bg-bg hover:bg-surface text-fg border border-line text-xs font-semibold"
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Decline
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}

            {decidedChanges.map((c) => (
              <Card key={c.id} className="bg-card border-line p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-fg">{c.title}</p>
                  <p className="text-[11px] text-faint font-mono">
                    ${c.price.toLocaleString()}
                    {c.decided_at && ` • decided ${new Date(c.decided_at).toLocaleDateString()}`}
                  </p>
                  {c.decision_note && <p className="text-xs text-muted mt-1">“{c.decision_note}”</p>}
                </div>
                <Badge
                  className={
                    c.status === "approved" || c.status === "implemented"
                      ? "bg-accent-soft text-accent border-accent/20 text-[10px] capitalize"
                      : "bg-danger/15 text-danger border-danger/30 text-[10px] capitalize"
                  }
                >
                  {c.status}
                </Badge>
              </Card>
            ))}
          </div>
        )}

        {/* Project Scope & Client Feedback Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scope details */}
          <Card className="bg-card border-line p-6 space-y-3">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-info" /> Statement of Scope
            </h3>
            <p className="text-xs text-fg leading-relaxed">
              {portal.description || "Full-stack development, design assets, and production deployment as agreed."}
            </p>
            <div className="pt-3 border-t border-line flex items-center justify-between text-xs text-muted font-mono">
              <span>Security: 256-bit Encrypted</span>
              <span>Host: Neon DB Live</span>
            </div>
          </Card>

          {/* Quick Message / Feedback Box */}
          <Card className="bg-card border-line p-6 space-y-3">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-info" /> Client Notes & Feedback
            </h3>
            <form onSubmit={handleSendFeedback} className="space-y-3">
              <textarea
                value={clientFeedback}
                onChange={(e) => setClientFeedback(e.target.value)}
                placeholder="Leave feedback on deliverables or request minor adjustments..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-bg border border-line text-fg text-xs focus:outline-none focus:border-accent leading-relaxed"
              />
              <div className="flex items-center justify-between">
                {feedbackSent ? (
                  <span className="text-xs text-accent font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Feedback dispatched to freelancer!
                  </span>
                ) : (
                  <span className="text-[11px] text-faint font-mono">Direct sync</span>
                )}
                <Button type="submit" size="sm" className="bg-accent hover:bg-accent-hi text-accent-fg text-xs">
                  <Send className="w-3 h-3 mr-1" /> Send Note
                </Button>
              </div>
            </form>
          </Card>
        </div>

      </div>
    </div>
  );
}
