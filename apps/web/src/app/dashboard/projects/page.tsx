
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  FolderKanban,
  Plus,
  CheckCircle2,
  Clock,
  ListTodo,
  RefreshCw,
  Trash2,
  Calendar,
  FileSignature,
  Eye,
  Send,
  Copy,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Check,
  FileText,
  AlertCircle,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getProjects,
  createProject,
  getClients,
  deleteProject,
  getContracts,
  createContract,
  deleteContract,
  type Project,
  type Client,
  type Contract,
} from "@/lib/api";

const CONTRACT_TEMPLATES = [
  {
    id: "msa",
    name: "Master Services Agreement (MSA)",
    description: "Full freelance development agreement with IP assignment, payment milestones, and warranty.",
    content: `# MASTER SERVICES AGREEMENT (MSA)

This Master Services Agreement ("Agreement") is made effective between the Service Provider ("Freelancer") and the Client.

### 1. Scope of Work & Deliverables
The Freelancer agrees to perform development, design, and implementation services as outlined in the designated Project milestones.

### 2. Payment Terms & Schedule
Client agrees to compensate the Freelancer in accordance with agreed milestone budgets. Invoices are payable upon receipt.

### 3. Intellectual Property Rights
Upon receipt of full payment, all intellectual property rights, codebases, and assets created specifically for this project are unconditionally transferred to the Client.

### 4. Confidentiality & Non-Disclosure
Both parties agree to protect proprietary materials, trade secrets, and customer data from unauthorized disclosure.

### 5. Termination & Dispute Resolution
Either party may terminate this agreement with 14 calendar days written notice. Payment is due for all work completed up to termination.`,
  },
  {
    id: "fixed_scope",
    name: "Fixed-Price Milestone & Escrow Contract",
    description: "Milestone-backed contract requiring deposits before each sprint or deliverable.",
    content: `# FIXED-PRICE MILESTONE & DELIVERABLES AGREEMENT

### 1. Milestone Specifications
Work shall be executed in phased milestones. Work on each phase begins upon escrow deposit confirmation or milestone authorization.

### 2. Review & Acceptance Period
Client shall have five (5) business days following deliverable submission to test and approve the work or request reasonable adjustments.

### 3. Revisions & Scope Creep
Any deliverables or requests outside the documented project scope shall be quoted separately at the Freelancer's standard hourly rate.`,
  },
  {
    id: "nda",
    name: "Mutual Non-Disclosure Agreement (NDA)",
    description: "Standard confidentiality and trade secret protection agreement.",
    content: `# MUTUAL NON-DISCLOSURE AGREEMENT (NDA)

### 1. Definition of Confidential Information
"Confidential Information" includes all technical data, business strategies, software source code, customer records, and financial projections disclosed between the parties.

### 2. Obligations
The receiving party shall hold all Confidential Information in strict confidence and shall not disclose it to any third party without prior written consent.`,
  },
  {
    id: "retainer",
    name: "Monthly Retainer & Support Agreement",
    description: "Dedicated monthly development capacity with rollover rules.",
    content: `# MONTHLY RETAINER SERVICES AGREEMENT

### 1. Retainer Scope & Allocation
Freelancer shall reserve dedicated weekly development capacity (hours/month) for Client's ongoing maintenance, feature updates, and engineering support.

### 2. Billing Cycle
Retainer fees are billed at the beginning of each monthly cycle and entitle the Client to priority queue response times.`,
  },
];

export default function ProjectsPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"projects" | "contracts">("projects");

  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showCreateContractModal, setShowCreateContractModal] = useState(false);
  const [selectedProjectForContract, setSelectedProjectForContract] = useState<string>("");
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);

  // Project Form
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [budget, setBudget] = useState(2500);
  const [description, setDescription] = useState("");

  // Contract Form
  const [contractTitle, setContractTitle] = useState("Software Development Agreement");
  const [contractProjectId, setContractProjectId] = useState("");
  const [contractClientId, setContractClientId] = useState("");
  const [contractRecipientName, setContractRecipientName] = useState("");
  const [contractRecipientEmail, setContractRecipientEmail] = useState("");
  const [contractContent, setContractContent] = useState(CONTRACT_TEMPLATES[0].content);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadData = async (isManualRefresh?: unknown) => {
    try {
      if (isManualRefresh === true) setLoading(true);
      const token = (await getToken()) || undefined;
      const [projRes, clientRes, contractRes] = await Promise.all([
        getProjects(token).catch(() => []),
        getClients(token).catch(() => []),
        getContracts(undefined, token).catch(() => []),
      ]);
      setProjects(projRes);
      setClients(clientRes);
      setContracts(contractRes);
      if (projRes.length > 0 && !contractProjectId) {
        setContractProjectId(projRes[0].id);
      }
    } catch (err) {
      console.error("Error loading projects & contracts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = (await getToken()) || undefined;
      await createProject(
        {
          title,
          client_id: clientId || undefined,
          budget: Number(budget),
          description,
          status: "in_progress",
        },
        token
      );
      setShowCreateProjectModal(false);
      setTitle("");
      setDescription("");
      loadData();
    } catch (err) {
      console.error("Error creating project:", err);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm("Delete this project and all attached contracts?")) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteProject(id, token);
      loadData();
    } catch (err) {
      console.error("Error deleting project:", err);
    }
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractProjectId) {
      alert("Please select a project for this contract.");
      return;
    }
    try {
      const token = (await getToken()) || undefined;
      await createContract(
        {
          project_id: contractProjectId,
          client_id: contractClientId || undefined,
          title: contractTitle,
          content: contractContent,
          recipient_name: contractRecipientName || undefined,
          recipient_email: contractRecipientEmail || undefined,
        },
        token
      );
      setShowCreateContractModal(false);
      loadData();
      setActiveTab("contracts");
    } catch (err) {
      console.error("Error creating contract:", err);
    }
  };

  const handleDeleteContract = async (id: string) => {
    if (!confirm("Delete this contract?")) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteContract(id, token);
      loadData();
    } catch (err) {
      console.error("Error deleting contract:", err);
    }
  };

  const copySigningLink = (tokenStr: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/sign-contract/${tokenStr}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(tokenStr);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const openNewContractForProject = (projId: string, clId?: string) => {
    setContractProjectId(projId);
    if (clId) setContractClientId(clId);
    setShowCreateContractModal(true);
  };

  // Metrics
  const totalContracts = contracts.length;
  const viewedContracts = contracts.filter((c) => c.status === "viewed").length;
  const signedContracts = contracts.filter((c) => c.status === "signed").length;
  const pendingContracts = contracts.filter((c) => c.status === "sent" || c.status === "draft").length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-white">Projects & Contracts Hub</h1>
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-mono text-xs">
              {loading ? "Syncing..." : `${projects.length} Projects • ${contracts.length} Contracts`}
            </Badge>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Track milestones, deliverables, and send signable contracts with live read-receipts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading}
            className="border-white/10 text-slate-300"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {activeTab === "projects" ? (
            <Button
              onClick={() => setShowCreateProjectModal(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Project
            </Button>
          ) : (
            <Button
              onClick={() => setShowCreateContractModal(true)}
              className="bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-cyan-500/20"
            >
              <FileSignature className="w-4 h-4 mr-1.5" />
              Create & Send Contract
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-3 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab("projects")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === "projects"
            ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
            : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
        >
          <FolderKanban className="w-4 h-4" />
          Projects & Milestones ({projects.length})
        </button>

        <button
          onClick={() => setActiveTab("contracts")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === "contracts"
            ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
            : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
        >
          <FileSignature className="w-4 h-4" />
          Contracts & E-Sign Tracker ({contracts.length})
          {viewedContracts > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
              {viewedContracts} Opened
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: PROJECTS */}
      {activeTab === "projects" && (
        <div className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="bg-slate-900/40 border-white/5 p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-44" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="pt-3 border-t border-white/5 flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </Card>
              ))}
            </div>
          ) : projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((p) => {
                const projectContracts = contracts.filter((c) => c.project_id === p.id);
                return (
                  <Card
                    key={p.id}
                    className="bg-slate-900/40 border-white/10 hover:border-cyan-500/30 transition-all p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-bold text-white">{p.title}</h3>
                          <p className="text-xs text-slate-400">{p.client_name || "Internal Project"}</p>
                        </div>
                        <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                          {p.status}
                        </Badge>
                      </div>

                      {p.description && (
                        <p className="text-xs text-slate-300 mt-2 line-clamp-2">{p.description}</p>
                      )}

                      <div className="mt-4 flex items-center justify-between text-xs text-slate-400 font-mono">
                        <span>Budget: ${p.budget}</span>
                        <span>Tasks: {p.tasks?.length || 0}</span>
                      </div>

                      {/* Attached Contracts Indicator */}
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <FileSignature className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{projectContracts.length} Contract(s)</span>
                          {projectContracts.some((c) => c.status === "signed") && (
                            <span className="text-emerald-400 font-semibold">• Signed</span>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openNewContractForProject(p.id, p.client_id)}
                          className="text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 h-7 px-2"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add Contract
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Created: {p.created_at?.slice(0, 10)}</span>
                      <button
                        onClick={() => handleDeleteProject(p.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-slate-900/20 border-dashed border-white/10 p-12 text-center">
              <FolderKanban className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-200">No Projects Found</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Create a project to manage milestones, attach e-signature contracts, and track time.
              </p>
              <Button
                onClick={() => setShowCreateProjectModal(true)}
                className="mt-6 bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create First Project
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: CONTRACTS & E-SIGN TRACKER */}
      {activeTab === "contracts" && (
        <div className="space-y-6">
          {/* Contracts Status Scoreboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-slate-900/40 border-white/10 p-4 space-y-1">
              <span className="text-xs text-slate-400 font-mono uppercase">Total Contracts</span>
              <p className="text-2xl font-bold text-white">{totalContracts}</p>
            </Card>
            <Card className="bg-slate-900/40 border-white/10 p-4 space-y-1">
              <span className="text-xs text-cyan-400 font-mono uppercase">Awaiting Open</span>
              <p className="text-2xl font-bold text-cyan-400">{pendingContracts}</p>
            </Card>
            <Card className="bg-slate-900/40 border-white/10 p-4 space-y-1">
              <span className="text-xs text-amber-400 font-mono uppercase">Opened by Client</span>
              <p className="text-2xl font-bold text-amber-400">{viewedContracts}</p>
            </Card>
            <Card className="bg-slate-900/40 border-white/10 p-4 space-y-1">
              <span className="text-xs text-emerald-400 font-mono uppercase">Fully Signed</span>
              <p className="text-2xl font-bold text-emerald-400">{signedContracts}</p>
            </Card>
          </div>

          {/* Contracts Listing */}
          {contracts.length > 0 ? (
            <div className="space-y-4">
              {contracts.map((c) => {
                const isViewed = c.status === "viewed";
                const isSigned = c.status === "signed";
                const isSent = c.status === "sent" || c.status === "draft";

                return (
                  <Card
                    key={c.id}
                    className="bg-slate-900/50 border-white/10 hover:border-cyan-500/30 p-5 transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-lg font-bold text-white">{c.title}</h3>
                          {/* Live Status Badge */}
                          {isSigned ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-2 py-0.5 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Signed & Active
                            </Badge>
                          ) : isViewed ? (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs px-2 py-0.5 font-semibold animate-pulse">
                              <Eye className="w-3.5 h-3.5 mr-1" /> Opened / Viewed
                            </Badge>
                          ) : (
                            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs px-2 py-0.5 font-semibold">
                              <Send className="w-3.5 h-3.5 mr-1" /> Link Sent
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                          <span>
                            Project: <span className="text-slate-200">{c.project_title || "Associated Project"}</span>
                          </span>
                          {c.client_name && (
                            <span>
                              Client: <span className="text-slate-200">{c.client_name}</span>
                            </span>
                          )}
                          <span>Recipient: {c.recipient_name || "Direct Client Link"}</span>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copySigningLink(c.token)}
                          className="border-white/10 bg-slate-950 text-slate-300 hover:text-white"
                        >
                          {copiedToken === c.token ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                              <span className="text-emerald-400">Link Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1" />
                              Copy Client Link
                            </>
                          )}
                        </Button>

                        <a
                          href={`/sign-contract/${c.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center p-2 rounded-lg border border-white/10 bg-slate-950 text-slate-400 hover:text-white transition-colors"
                          title="Open Signing Portal"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingContract(c)}
                          className="text-xs text-slate-300 hover:text-white"
                        >
                          View Audit Details
                        </Button>

                        <button
                          onClick={() => handleDeleteContract(c.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                          title="Delete contract"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Live Status Telemetry Bar */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-slate-400">Created:</span>
                        <span className="text-slate-200">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "Today"}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Eye className={`w-3.5 h-3.5 ${c.viewed_at ? "text-amber-400" : "text-slate-600"} shrink-0`} />
                        <span className="text-slate-400">Read Receipt:</span>
                        {c.viewed_at ? (
                          <span className="text-amber-300 font-semibold truncate" title={c.viewed_user_agent || ""}>
                            Opened {new Date(c.viewed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        ) : (
                          <span className="text-slate-600">Not viewed yet</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <ShieldCheck className={`w-3.5 h-3.5 ${c.client_signed_at ? "text-emerald-400" : "text-slate-600"} shrink-0`} />
                        <span className="text-slate-400">Execution:</span>
                        {c.client_signed_at ? (
                          <span className="text-emerald-300 font-semibold">
                            Signed {new Date(c.client_signed_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-600">Awaiting Signature</span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-slate-900/20 border-dashed border-white/10 p-12 text-center">
              <FileSignature className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-200">No Contracts Sent Yet</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Send professional agreements with instant mobile e-signing, read receipts, and automatic project archiving.
              </p>
              <Button
                onClick={() => setShowCreateContractModal(true)}
                className="mt-6 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white"
              >
                <FileSignature className="w-4 h-4 mr-1.5" />
                Create First Contract
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      {showCreateProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md bg-slate-900 border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white">Create Project</h3>
              <button
                onClick={() => setShowCreateProjectModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400">Project Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Next.js Mobile App MVP"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Client (Optional)</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- No Client Assigned --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Budget ($)</label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Scope of work and deliverables..."
                  rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateProjectModal(false)}
                  className="border-white/10 text-slate-300"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white">
                  Save Project
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* CREATE CONTRACT MODAL */}
      {showCreateContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-2xl bg-slate-900 border-white/10 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Create & Send E-Signature Contract</h3>
              </div>
              <button
                onClick={() => setShowCreateContractModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Associated Project *</label>
                  <select
                    value={contractProjectId}
                    onChange={(e) => setContractProjectId(e.target.value)}
                    required
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Select Project --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400">Client Recipient (Optional)</label>
                  <select
                    value={contractClientId}
                    onChange={(e) => {
                      setContractClientId(e.target.value);
                      const cl = clients.find((c) => c.id === e.target.value);
                      if (cl) {
                        setContractRecipientName(cl.name);
                        setContractRecipientEmail(cl.email);
                      }
                    }}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Direct Shareable Link --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Contract Agreement Title *</label>
                <input
                  type="text"
                  value={contractTitle}
                  onChange={(e) => setContractTitle(e.target.value)}
                  placeholder="e.g. Full-Stack Web Development Agreement"
                  required
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Template Picker */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Load Standard Template:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CONTRACT_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => {
                        setContractTitle(tmpl.name);
                        setContractContent(tmpl.content);
                      }}
                      className="p-2.5 rounded-lg border border-white/10 bg-slate-950 hover:border-cyan-500/40 text-left text-xs transition-colors group"
                    >
                      <span className="font-semibold text-white block group-hover:text-cyan-400 truncate">
                        {tmpl.name.split(" ")[0]}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate block">{tmpl.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Terms Content Editor */}
              <div>
                <label className="text-xs font-semibold text-slate-400">Terms & Agreement Body (Markdown) *</label>
                <textarea
                  value={contractContent}
                  onChange={(e) => setContractContent(e.target.value)}
                  rows={8}
                  required
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-500 leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateContractModal(false)}
                  className="border-white/10 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold"
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  Generate Signable Link
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* VIEW CONTRACT AUDIT MODAL */}
      {viewingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-2xl bg-slate-900 border-white/10 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase">Contract Audit Sheet</span>
                <h3 className="text-lg font-bold text-white">{viewingContract.title}</h3>
              </div>
              <button
                onClick={() => setViewingContract(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-3 text-xs font-mono">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Status:</span>
                <span className="text-cyan-400 font-bold uppercase">{viewingContract.status}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Issued Timestamp:</span>
                <span className="text-slate-200">{new Date(viewingContract.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Client Read / Open Timestamp:</span>
                <span className="text-amber-400">
                  {viewingContract.viewed_at ? new Date(viewingContract.viewed_at).toLocaleString() : "Not Opened Yet"}
                </span>
              </div>
              {viewingContract.viewed_user_agent && (
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Client Device / User-Agent:</span>
                  <span className="text-slate-300 truncate max-w-xs">{viewingContract.viewed_user_agent}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Signature Execution:</span>
                <span className="text-emerald-400">
                  {viewingContract.client_signed_at
                    ? new Date(viewingContract.client_signed_at).toLocaleString()
                    : "Pending Signature"}
                </span>
              </div>
              {viewingContract.client_signature && (
                <div className="pt-2">
                  <span className="text-slate-400 block mb-2">Recorded Client Signature:</span>
                  {viewingContract.client_signature.startsWith("data:image") ? (
                    <div className="p-2 bg-slate-900 rounded-lg border border-white/10 flex justify-center">
                      <img
                        src={viewingContract.client_signature}
                        alt="Signature"
                        className="h-12 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="p-2 bg-slate-900 rounded-lg border border-white/10 font-serif italic text-base text-cyan-300">
                      {viewingContract.client_signature.replace("typed:", "")}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="prose prose-invert max-w-none text-slate-300 text-xs whitespace-pre-wrap font-mono bg-slate-950 p-4 rounded-xl border border-white/5 max-h-48 overflow-y-auto">
              {viewingContract.content}
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copySigningLink(viewingContract.token)}
                className="border-white/10 text-xs text-slate-300"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Share Link
              </Button>
              <Button
                onClick={() => setViewingContract(null)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
              >
                Close Audit
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
