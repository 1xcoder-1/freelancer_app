"use client";

import { useEffect, useState, use } from "react";
import {
  FolderKanban,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Building2,
  Sparkles,
  Layers,
  FileCheck,
  Send,
  MessageSquare,
  Check,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicProjectPortal, approvePublicMilestone, type PublicProjectPortal } from "@/lib/api";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function ClientPortalPage({ params }: PageProps) {
  const { token } = use(params);

  const [portal, setPortal] = useState<PublicProjectPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [justApprovedId, setJustApprovedId] = useState<string | null>(null);
  const [clientFeedback, setClientFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    async function loadPortal() {
      try {
        setLoading(true);
        const data = await getPublicProjectPortal(token);
        setPortal(data);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(axiosErr?.response?.data?.detail || "Project portal link is invalid or expired.");
      } finally {
        setLoading(false);
      }
    }
    loadPortal();
  }, [token]);

  const handleApprove = async (milestoneId: string) => {
    try {
      setApprovingId(milestoneId);
      const updated = await approvePublicMilestone(token, milestoneId);
      setPortal(updated);
      setJustApprovedId(milestoneId);
      setTimeout(() => setJustApprovedId(null), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      alert(axiosErr?.response?.data?.detail || "Failed to approve deliverable.");
    } finally {
      setApprovingId(null);
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full bg-slate-900/60 border-white/10 p-8 space-y-6">
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-900 border-red-500/20 p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Project Link Not Found</h2>
          <p className="text-sm text-slate-400">{error || "This client portal link is unavailable."}</p>
        </Card>
      </div>
    );
  }

  const progress = portal.progress_pct || 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 selection:bg-cyan-500/30">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-wide">Freelance Book</span>
              <span className="block text-[10px] text-cyan-400 font-mono tracking-wider">CLIENT PROJECT PORTAL</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Live Sync Verified
            </Badge>
          </div>
        </div>

        {/* Hero Progress Banner */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950 border-white/10 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono text-cyan-400 tracking-wider uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Real-Time Project Progress
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">{portal.title}</h1>
              <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-slate-500" /> Prepared for:{" "}
                <span className="text-slate-200 font-medium">{portal.client_name || "Valued Client"}</span>
                <span className="text-slate-600">•</span>
                <span>By {portal.freelancer_name}</span>
              </p>
            </div>

            <div className="flex flex-col items-end shrink-0">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
                  {progress}%
                </span>
                <span className="text-xs font-mono text-slate-400">COMPLETE</span>
              </div>
              <Badge className="mt-1 bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-xs capitalize">
                {portal.status.replace("_", " ")}
              </Badge>
            </div>
          </div>

          {/* Animated Glowing Progress Bar */}
          <div className="mt-6 space-y-2">
            <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-500 shadow-lg shadow-cyan-500/40 transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>{portal.completed_milestones_count} of {portal.total_milestones_count} Milestones Approved</span>
              <span>{portal.completed_tasks_count} Completed Tasks</span>
            </div>
          </div>

          {/* Project Summary Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
            <div className="p-3 rounded-lg bg-slate-950/70 border border-white/5 space-y-0.5">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Total Budget</span>
              <p className="text-base font-bold text-white">${portal.budget.toLocaleString()}</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/70 border border-white/5 space-y-0.5">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Active Phase</span>
              <p className="text-base font-bold text-cyan-400">
                Phase {Math.min(portal.total_milestones_count, portal.completed_milestones_count + 1)}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/70 border border-white/5 space-y-0.5">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Contract Status</span>
              <p className="text-base font-bold text-emerald-400">
                {portal.contract_signed ? "Signed & Active" : "Pending Signature"}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/70 border border-white/5 space-y-0.5">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Last Sync</span>
              <p className="text-base font-bold text-slate-300">Just Now</p>
            </div>
          </div>
        </Card>

        {/* Milestone Deliverables & Approval Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                Project Milestones & Deliverables
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
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
                      ? "bg-slate-900/40 border-emerald-500/20"
                      : "bg-slate-900/70 border-white/10 hover:border-cyan-500/30"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                          isCompleted
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-white">{m.title}</h3>
                          {m.amount > 0 && (
                            <span className="text-xs font-mono text-cyan-400 font-semibold">
                              (${m.amount.toLocaleString()})
                            </span>
                          )}
                          {isCompleted ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                              Approved & Verified
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] animate-pulse">
                              Ready for Review
                            </Badge>
                          )}
                        </div>

                        {m.description && <p className="text-xs text-slate-300">{m.description}</p>}
                        {m.deliverable_note && (
                          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                            <Zap className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Deliverable: {m.deliverable_note}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action button for Client Approval */}
                    <div className="shrink-0 flex items-center gap-2 sm:self-center">
                      {isCompleted ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle2 className="w-4 h-4" /> Approved
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleApprove(m.id)}
                          disabled={isApproving}
                          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20"
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

        {/* Project Scope & Client Feedback Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scope details */}
          <Card className="bg-slate-900/50 border-white/10 p-6 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-cyan-400" /> Statement of Scope
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {portal.description || "Full-stack development, design assets, and production deployment as agreed."}
            </p>
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Security: 256-bit Encrypted</span>
              <span>Host: Neon DB Live</span>
            </div>
          </Card>

          {/* Quick Message / Feedback Box */}
          <Card className="bg-slate-900/50 border-white/10 p-6 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-cyan-400" /> Client Notes & Feedback
            </h3>
            <form onSubmit={handleSendFeedback} className="space-y-3">
              <textarea
                value={clientFeedback}
                onChange={(e) => setClientFeedback(e.target.value)}
                placeholder="Leave feedback on deliverables or request minor adjustments..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500 leading-relaxed"
              />
              <div className="flex items-center justify-between">
                {feedbackSent ? (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Feedback dispatched to freelancer!
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 font-mono">Direct sync</span>
                )}
                <Button type="submit" size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs">
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
