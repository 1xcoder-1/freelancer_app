
"use client";

import { useState, Suspense } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import {
  FolderKanban,
  Plus,
  CheckCircle2,
  Clock,
  RefreshCw,
  Trash2,
  FileSignature,
  Eye,
  Send,
  Copy,
  ExternalLink,
  ShieldCheck,
  Check,
  FileText,
  ChevronDown,
  ChevronRight,
  Loader2,
  Archive,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SubTabs } from "@/components/dashboard/SubTabs";
import {
  getProjects,
  createProject,
  updateProject,
  getClients,
  deleteProject,
  getContracts,
  createContract,
  deleteContract,
  createTask,
  updateTask,
  deleteTask,
  updateMilestone,
  type Project,
  type Client,
  type Contract,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { InvoicesPanel } from "@/components/dashboard/panels/InvoicesPanel";
import { toast } from "sonner";
import { z } from "zod";
import { validateOrToast, nameSchema, moneySchema, optionalTextSchema, optionalEmailSchema } from "@/lib/validation";

const projectSchema = z.object({
  title: nameSchema("Project title", 120),
  budget: moneySchema("Budget"),
  description: optionalTextSchema("Description", 4000),
});

const taskSchema = z.object({
  title: nameSchema("Task", 200),
});

const contractSchema = z.object({
  title: nameSchema("Contract title", 200),
  content: z.string().trim().min(1, "Contract content is required"),
  recipient_email: optionalEmailSchema,
});

const moneyShort = (n: number) => `$${Math.round(n).toLocaleString(undefined)}`;

// Shared filter for the Projects sub-pages: "Now" shows active jobs,
// "Archive" shows finished/paused ones.
const filterByStatus = (list: Project[], group: "now" | "archive") =>
  list.filter((p) =>
    group === "now"
      ? p.status === "planning" || p.status === "in_progress"
      : p.status === "completed" || p.status === "paused"
  );

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
    name: "Fixed-Price Milestone Contract",
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
Freelancer agrees to perform development, design, and deployment services for the Project as defined in the associated milestone specification.

### 2. Milestone Payment Terms
Client agrees to remit milestone payments upon review and acceptance of designated project deliverables. Invoices carry standard Net-15 terms.

### 3. Intellectual Property
Upon full and final payment, Freelancer transfers all proprietary rights, source code, and assets to the Client.

### 4. Warranties & Acceptance
Freelancer warrants that all code delivered is original and free of malicious software. Client has a 14-day acceptance window upon delivery.`,
  },
  {
    id: "hourly-retainer",
    name: "Monthly Advisory & Engineering Retainer",
    description: "Covers ongoing fractional CTO, bug fixing, and continuous development blocks.",
    content: `# MONTHLY RETAINER SERVICES AGREEMENT

### 1. Retainer Scope & Allocation
Freelancer shall reserve dedicated weekly development capacity (hours/month) for Client's ongoing maintenance, feature updates, and engineering support.

### 2. Billing Cycle
Retainer fees are billed at the beginning of each monthly cycle and entitle the Client to priority queue response times.`,
  },
];

// Money sub-page for Projects: a plain-English view of what you agreed to
// charge vs. what the tracked time is actually worth so far, plus task
// progress. Read-only — everything is computed from the one live fetch.
const MoneySubPage = ({
  projects,
  stats,
}: {
  projects: Project[];
  stats: { budgetTotal: number; trackedValueTotal: number; tasksTotal: number; tasksDone: number };
}) => {
  if (projects.length === 0) {
    return (
      <Card className="bg-card border-dashed border-line p-12 text-center">
        <Wallet className="w-12 h-12 text-faint mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-fg">No money to show yet</h3>
        <p className="text-sm text-faint mt-1">Create a project and this page fills up by itself.</p>
      </Card>
    );
  }

  const cards = [
    { label: "Total budgeted", value: moneyShort(stats.budgetTotal), tone: "text-fg" },
    { label: "Work value so far", value: moneyShort(stats.trackedValueTotal), tone: "text-info" },
    { label: "Tasks done", value: `${stats.tasksDone}/${stats.tasksTotal}`, tone: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="bg-card border-line p-5 space-y-1">
            <span className="text-xs text-muted font-mono uppercase">{c.label}</span>
            <p className={`text-2xl font-bold ${c.tone}`}>{c.value}</p>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-line p-5 space-y-4">
        <h3 className="text-sm font-bold text-fg">Budget vs. work done</h3>
        <div className="space-y-4">
          {projects.map((p) => {
            const value = (p.tracked_hours || 0) * (p.hourly_rate || 0);
            const pct = p.budget > 0 ? Math.min(100, Math.round((value / p.budget) * 100)) : 0;
            const doneTasks = p.tasks?.filter((t) => t.status === "done").length ?? 0;
            return (
              <div key={p.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-fg truncate">{p.title}</span>
                  <span className="text-muted font-mono shrink-0 ml-2">
                    {moneyShort(value)} / {moneyShort(p.budget || 0)}
                  </span>
                </div>
                <div className="w-full bg-surface rounded-full h-2 overflow-hidden">
                  <div className="bg-info h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-faint">
                  {doneTasks}/{p.tasks?.length ?? 0} tasks done • {p.status}
                </p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

function ProjectsContent() {
  const { getToken } = useAuth();
  // Deep links like /dashboard/projects?tab=invoices (used by the old
  // invoices route redirect and dashboard links) open the matching tab. Read
  // it once at init so there is no setState-in-effect cascade.
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"projects" | "contracts" | "invoices">(() => {
    const tab = searchParams.get("tab");
    return tab === "contracts" || tab === "invoices" || tab === "projects" ? tab : "projects";
  });
  // Sub-pages within each big tab — one small job per page.
  const [projectsSub, setProjectsSub] = useState<"now" | "money" | "archive">("now");
  const [contractsSub, setContractsSub] = useState<"waiting" | "signed" | "templates">("waiting");

  // Create screens — full pages inside the tab, never popups.
  const [showCreateProjectPage, setShowCreateProjectPage] = useState(false);
  const [showCreateContractPage, setShowCreateContractPage] = useState(false);
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);

  // Task & milestone checklist (inline, persisted via /projects PATCH)
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const { data: pageData, loading, refresh: loadData } = useApiData<{
    projects: Project[];
    clients: Client[];
    contracts: Contract[];
  }>(
    "projects:data",
    async (token) => {
      const [projRes, clientRes, contractRes] = await Promise.all([
        getProjects(token).catch(() => []),
        getClients(token).catch(() => []),
        getContracts(undefined, token).catch(() => []),
      ]);
      return { projects: projRes, clients: clientRes, contracts: contractRes };
    },
    {
      reportContext: "projects",
      // Live signing: re-fetch so "Link Sent" flips to "Opened"/"Signed" on
      // this screen by itself while the client signs on their device.
      pollMs: 15_000,
      onSuccess: (data) => {
        if (data.projects.length > 0 && !contractProjectId) {
          setContractProjectId(data.projects[0].id);
        }
      },
    }
  );

  const projects = pageData?.projects ?? [];
  const clients = pageData?.clients ?? [];
  const contracts = pageData?.contracts ?? [];

  // Derived groups for the sub-pages — all from the one live fetch, so there
  // is nothing extra to keep in sync by hand.
  const activeProjects = filterByStatus(projects, "now");
  const archivedProjects = filterByStatus(projects, "archive");
  const currentProjectList = projectsSub === "archive" ? archivedProjects : activeProjects;
  const waitingContracts = contracts.filter((c) => c.status !== "signed");
  const signedContractList = contracts.filter((c) => c.status === "signed");
  const currentContractList = contractsSub === "signed" ? signedContractList : waitingContracts;

  const moneyStats = {
    budgetTotal: projects.reduce((acc, p) => acc + (p.budget || 0), 0),
    trackedValueTotal: projects.reduce(
      (acc, p) => acc + (p.tracked_hours || 0) * (p.hourly_rate || 0),
      0
    ),
    tasksTotal: projects.reduce((acc, p) => acc + (p.tasks?.length ?? 0), 0),
    tasksDone: projects.reduce(
      (acc, p) => acc + (p.tasks?.filter((t) => t.status === "done").length ?? 0),
      0
    ),
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOrToast(projectSchema, { title, budget: Number(budget), description })) return;
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
      setShowCreateProjectPage(false);
      setTitle("");
      setDescription("");
      invalidateCache("projects:data");
      invalidateCache("dashboard:data");
      loadData();
      toast.success("Project created");
    } catch (err) {
      console.error("Error creating project:", err);
      toast.error("Could not create project");
    }
  };

  const handleDeleteProject = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete project",
      message: "This project and all its contracts, tasks and milestones will be removed permanently. Tracked time stays in your records.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteProject(id, token);
      invalidateCache("projects:data");
      invalidateCache("dashboard:data");
      loadData();
      toast.success("Project deleted");
    } catch (err) {
      console.error("Error deleting project:", err);
      toast.error("Could not delete project");
    }
  };

  const afterProjectMutation = () => {
    invalidateCache("projects:data");
    invalidateCache("dashboard:data");
    loadData();
  };

  // Archive-page undo: bring a finished/paused job back into "Now".
  const handleRestoreProject = async (id: string) => {
    setBusyId(id);
    try {
      const token = (await getToken()) || undefined;
      await updateProject(id, { status: "in_progress" }, token);
      afterProjectMutation();
      toast.success("Project is active again");
    } catch (err) {
      console.error("Error restoring project:", err);
      toast.error("Could not restore project");
    } finally {
      setBusyId(null);
    }
  };

  // Now-page finish: tuck a completed job into the Archive with one tap.
  const handleArchiveProject = async (id: string) => {
    setBusyId(id);
    try {
      const token = (await getToken()) || undefined;
      await updateProject(id, { status: "completed" }, token);
      afterProjectMutation();
      toast.success("Moved to Archive");
    } catch (err) {
      console.error("Error archiving project:", err);
      toast.error("Could not archive project");
    } finally {
      setBusyId(null);
    }
  };

  const handleAddTask = async (projectId: string) => {
    if (!validateOrToast(taskSchema, { title: newTaskTitle })) return;
    setBusyId("new");
    try {
      const token = (await getToken()) || undefined;
      await createTask(projectId, { title: newTaskTitle.trim() }, token);
      setNewTaskTitle("");
      afterProjectMutation();
    } catch (err) {
      console.error("Error adding task:", err);
      toast.error("Could not add task");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleTask = async (projectId: string, taskId: string, current: string) => {
    setBusyId(taskId);
    try {
      const token = (await getToken()) || undefined;
      await updateTask(projectId, taskId, { status: current === "done" ? "todo" : "done" }, token);
      afterProjectMutation();
    } catch (err) {
      console.error("Error updating task:", err);
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteTask = async (projectId: string, taskId: string) => {
    const ok = await confirmDialog({
      title: "Delete task",
      message: "This task will be removed from the project.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusyId(taskId);
    try {
      const token = (await getToken()) || undefined;
      await deleteTask(projectId, taskId, token);
      afterProjectMutation();
      toast.success("Task deleted");
    } catch (err) {
      console.error("Error deleting task:", err);
      toast.error("Could not delete task");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleMilestone = async (projectId: string, milestoneId: string, current: boolean) => {
    setBusyId(milestoneId);
    try {
      const token = (await getToken()) || undefined;
      await updateMilestone(projectId, milestoneId, { is_completed: !current }, token);
      afterProjectMutation();
    } catch (err) {
      console.error("Error updating milestone:", err);
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractProjectId) {
      toast.error("Please select a project for this contract");
      return;
    }
    if (!validateOrToast(contractSchema, {
      title: contractTitle,
      content: contractContent,
      recipient_email: contractRecipientEmail,
    })) return;
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
      setShowCreateContractPage(false);
      invalidateCache("projects:data");
      invalidateCache("dashboard:data");
      loadData();
      setActiveTab("contracts");
      toast.success("Contract created");
    } catch (err) {
      console.error("Error creating contract:", err);
      toast.error("Could not create contract");
    }
  };

  const handleDeleteContract = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete contract",
      message: "This contract and its signature link will stop working for the client. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteContract(id, token);
      invalidateCache("projects:data");
      invalidateCache("dashboard:data");
      loadData();
      toast.success("Contract deleted");
    } catch (err) {
      console.error("Error deleting contract:", err);
      toast.error("Could not delete contract");
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
    setShowCreateContractPage(true);
  };

  // Metrics
  const totalContracts = contracts.length;
  const viewedContracts = contracts.filter((c) => c.status === "viewed").length;
  const signedContracts = contracts.filter((c) => c.status === "signed").length;
  const pendingContracts = contracts.filter((c) => c.status === "sent" || c.status === "draft").length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">Projects</h1>
            <Badge className="bg-accent-soft text-info border-accent/20 font-mono text-xs">
              {loading ? "Syncing..." : `${projects.length} Projects • ${contracts.length} Contracts`}
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Run each job in one place: tasks, milestones, invoices, and contracts the client can sign.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading}
            className="border-line text-fg w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          {activeTab === "projects" ? (
            <Button
              size="sm"
              onClick={() => setShowCreateProjectPage(true)}
              className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Project
            </Button>
          ) : activeTab === "contracts" ? (
            <Button
              size="sm"
              onClick={() => setShowCreateContractPage(true)}
              className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
            >
              <FileSignature className="w-3.5 h-3.5 mr-1.5" />
              Create & Send Contract
            </Button>
          ) : null}
        </div>
      </div>

      {/* The tab list steps aside while a create page is open */}
      {!showCreateProjectPage && !showCreateContractPage && (
      <>
      {/* Main Tabs */}
      <SubTabs
        tabs={[
          { value: "projects", label: "Projects", count: projects.length },
          { value: "contracts", label: "Contracts", count: contracts.length },
          { value: "invoices", label: "Invoices" },
        ] as const}
        value={activeTab}
        onChange={(v) => setActiveTab(v as "projects" | "contracts" | "invoices")}
      />

      {/* TAB 3: INVOICES */}
      {activeTab === "invoices" && <InvoicesPanel />}

      {/* TAB 1: PROJECTS — sub-pages Now / Money / Archive */}
      {activeTab === "projects" && (
        <div className="space-y-6">
          <SubTabs
            tabs={[
              { value: "now", label: "Now", count: activeProjects.length },
              { value: "money", label: "Money" },
              { value: "archive", label: "Archive", count: archivedProjects.length },
            ] as const}
            value={projectsSub}
            onChange={(v) => setProjectsSub(v as "now" | "money" | "archive")}
          />

          {projectsSub === "money" ? (
            <MoneySubPage projects={projects} stats={moneyStats} />
          ) : (
          <div className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="bg-card border-line p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-44" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="pt-3 border-t border-line flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </Card>
              ))}
            </div>
          ) : currentProjectList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentProjectList.map((p) => {
                const projectContracts = contracts.filter((c) => c.project_id === p.id);
                return (
                  <Card
                    key={p.id}
                    className="bg-card border-line hover:border-accent/30 transition-all p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-bold text-fg">{p.title}</h3>
                          <p className="text-xs text-muted">{p.client_name || "Internal Project"}</p>
                        </div>
                        <Badge variant="outline" className="text-xs bg-accent-soft text-info border-accent/20">
                          {p.status}
                        </Badge>
                      </div>

                      {p.description && (
                        <p className="text-xs text-fg mt-2 line-clamp-2">{p.description}</p>
                      )}

                      <div className="mt-4 flex items-center justify-between text-xs text-muted font-mono">
                        <span>Budget: ${p.budget}</span>
                        <span>{p.tasks?.filter((t) => t.status === "done").length || 0}/{p.tasks?.length || 0} tasks done</span>
                      </div>

                      <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden mt-2">
                        <div className="bg-accent h-full rounded-full transition-all" style={{ width: `${p.progress_pct ?? 0}%` }} />
                      </div>

                      {/* Expandable task & milestone checklist */}
                      <button
                        onClick={() => setExpandedProjectId((cur) => (cur === p.id ? null : p.id))}
                        className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-info hover:underline"
                      >
                        {expandedProjectId === p.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        Tasks & Milestones
                      </button>

                      {expandedProjectId === p.id && (
                        <div className="mt-3 pt-3 border-t border-line space-y-4 animate-in fade-in">
                          {/* Milestones */}
                          <div className="space-y-1.5">
                            <p className="text-[11px] uppercase tracking-wide text-faint font-semibold">Milestones</p>
                            {(p.milestones?.length ?? 0) > 0 ? p.milestones.map((m) => (
                              <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={m.is_completed}
                                  onChange={() => handleToggleMilestone(p.id, m.id, m.is_completed)}
                                  className="accent-[var(--accent)] w-4 h-4"
                                />
                                <span className={m.is_completed ? "line-through text-faint" : "text-fg"}>{m.title}</span>
                                {m.amount > 0 && <span className="ml-auto text-muted font-mono">${m.amount}</span>}
                              </label>
                            )) : (
                              <p className="text-xs text-faint">No milestones.</p>
                            )}
                          </div>

                          {/* Tasks */}
                          <div className="space-y-1.5">
                            <p className="text-[11px] uppercase tracking-wide text-faint font-semibold">Tasks</p>
                            {(p.tasks?.length ?? 0) > 0 ? p.tasks.map((t) => (
                              <div key={t.id} className="flex items-center gap-2 text-xs group">
                                <button
                                  onClick={() => handleToggleTask(p.id, t.id, t.status)}
                                  className="shrink-0 disabled:opacity-50"
                                  disabled={busyId === t.id}
                                >
                                  {busyId === t.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-muted" />
                                  ) : t.status === "done" ? (
                                    <CheckCircle2 className="w-4 h-4 text-accent" />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border border-line" />
                                  )}
                                </button>
                                <span className={t.status === "done" ? "line-through text-faint" : "text-fg"}>{t.title}</span>
                                <button
                                  onClick={() => handleDeleteTask(p.id, t.id)}
                                  className="ml-auto text-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Delete task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )) : (
                              <p className="text-xs text-faint">No tasks yet.</p>
                            )}

                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="text"
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTask(p.id); } }}
                                placeholder="Add a task…"
                                className="flex-1 px-2.5 py-1.5 rounded-lg bg-bg border border-line text-fg text-xs focus:outline-none focus:border-accent"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddTask(p.id)}
                                disabled={busyId === "new" || !newTaskTitle.trim()}
                                className="border-line text-fg h-7 px-2"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Attached Contracts Indicator */}
                      <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <FileSignature className="w-3.5 h-3.5 text-info" />
                          <span>{projectContracts.length} Contract(s)</span>
                          {projectContracts.some((c) => c.status === "signed") && (
                            <span className="text-accent font-semibold">• Signed</span>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openNewContractForProject(p.id, p.client_id)}
                          className="text-xs text-info hover:text-info hover:bg-accent-soft h-7 px-2"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add Contract
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                      <span className="text-xs text-faint">Created: {p.created_at?.slice(0, 10)}</span>
                      <div className="flex items-center gap-3">
                        {projectsSub === "archive" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestoreProject(p.id)}
                            disabled={busyId === p.id}
                            className="border-line text-fg h-7 px-2.5 text-xs"
                            title="Move this project back to Now"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Restore
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleArchiveProject(p.id)}
                            disabled={busyId === p.id}
                            className="border-line text-fg h-7 px-2.5 text-xs"
                            title="Mark done and move to Archive"
                          >
                            <Archive className="w-3.5 h-3.5 mr-1" />
                            Done
                          </Button>
                        )}
                        <button
                          onClick={() => handleDeleteProject(p.id)}
                          className="text-faint hover:text-danger transition-colors"
                          title="Delete project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-card border-dashed border-line p-12 text-center">
              <FolderKanban className="w-12 h-12 text-faint mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-fg">
                {projectsSub === "archive" ? "Nothing in the archive" : "No active projects"}
              </h3>
              <p className="text-sm text-faint mt-1 max-w-md mx-auto">
                {projectsSub === "archive"
                  ? "Finished or paused jobs land here — nothing gets lost."
                  : "Create a project to manage milestones, attach e-signature contracts, and track time."}
              </p>
              <Button
                onClick={() => setShowCreateProjectPage(true)}
                className="mt-6 bg-accent hover:bg-accent-hi text-accent-fg"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create First Project
              </Button>
            </Card>
          )}
          </div>
          )}
        </div>
      )}

      {/* TAB 2: CONTRACTS — sub-pages Waiting / Signed / Templates */}
      {activeTab === "contracts" && (
        <div className="space-y-6">
          <SubTabs
            tabs={[
              { value: "waiting", label: "Waiting", count: waitingContracts.length },
              { value: "signed", label: "Signed", count: signedContractList.length },
              { value: "templates", label: "Templates" },
            ] as const}
            value={contractsSub}
            onChange={(v) => setContractsSub(v as "waiting" | "signed" | "templates")}
          />

          {/* Contracts Status Scoreboard (hidden on the Templates page) */}
          {contractsSub !== "templates" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-card border-line p-4 space-y-1">
              <span className="text-xs text-muted font-mono uppercase">Total Contracts</span>
              <p className="text-2xl font-bold text-fg">{totalContracts}</p>
            </Card>
            <Card className="bg-card border-line p-4 space-y-1">
              <span className="text-xs text-info font-mono uppercase">Awaiting Open</span>
              <p className="text-2xl font-bold text-info">{pendingContracts}</p>
            </Card>
            <Card className="bg-card border-line p-4 space-y-1">
              <span className="text-xs text-warn font-mono uppercase">Opened by Client</span>
              <p className="text-2xl font-bold text-warn">{viewedContracts}</p>
            </Card>
            <Card className="bg-card border-line p-4 space-y-1">
              <span className="text-xs text-accent font-mono uppercase">Fully Signed</span>
              <p className="text-2xl font-bold text-accent">{signedContracts}</p>
            </Card>
          </div>
          )}

          {/* Contracts Listing / Templates gallery */}
          {contractsSub === "templates" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CONTRACT_TEMPLATES.map((tmpl) => (
                <Card key={tmpl.id} className="bg-card border-line p-5 space-y-2 flex flex-col">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-info" />
                    <h3 className="text-sm font-bold text-fg">{tmpl.name}</h3>
                  </div>
                  <p className="text-xs text-muted flex-1">{tmpl.description}</p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setContractTitle(tmpl.name);
                      setContractContent(tmpl.content);
                      setShowCreateContractPage(true);
                    }}
                    className="bg-accent hover:bg-accent-hi text-accent-fg self-start"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Use this template
                  </Button>
                </Card>
              ))}
            </div>
          ) : currentContractList.length > 0 ? (
            <div className="space-y-4">
              {currentContractList.map((c) => {
                const isViewed = c.status === "viewed";
                const isSigned = c.status === "signed";

                return (
                  <Card
                    key={c.id}
                    className="bg-card border-line hover:border-accent/30 p-5 transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-lg font-bold text-fg">{c.title}</h3>
                          {/* Live Status Badge */}
                          {isSigned ? (
                            <Badge className="bg-accent-soft text-accent border-accent/20 text-xs px-2 py-0.5 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Signed & Active
                            </Badge>
                          ) : isViewed ? (
                            <Badge className="bg-warn/20 text-warn border-warn/30 text-xs px-2 py-0.5 font-semibold animate-pulse">
                              <Eye className="w-3.5 h-3.5 mr-1" /> Opened / Viewed
                            </Badge>
                          ) : (
                            <Badge className="bg-accent-soft text-info border-accent/30 text-xs px-2 py-0.5 font-semibold">
                              <Send className="w-3.5 h-3.5 mr-1" /> Link Sent
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted">
                          <span>
                            Project: <span className="text-fg">{c.project_title || "Associated Project"}</span>
                          </span>
                          {c.client_name && (
                            <span>
                              Client: <span className="text-fg">{c.client_name}</span>
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
                          className="border-line bg-bg text-fg hover:text-fg"
                        >
                          {copiedToken === c.token ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1 text-accent" />
                              <span className="italic font-medium text-accent">Link Copied!</span>
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
                          className="inline-flex items-center justify-center p-2 rounded-lg border border-line bg-bg text-muted hover:text-fg transition-colors"
                          title="Open Signing Portal"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingContract(c)}
                          className="text-xs text-fg hover:text-fg"
                        >
                          View Audit Details
                        </Button>

                        <button
                          onClick={() => handleDeleteContract(c.id)}
                          className="p-1.5 text-faint hover:text-danger transition-colors"
                          title="Delete contract"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Live Status Telemetry Bar */}
                    <div className="p-3 rounded-xl bg-bg border border-line grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-faint shrink-0" />
                        <span className="text-muted">Created:</span>
                        <span className="text-fg">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "Today"}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Eye className={`w-3.5 h-3.5 ${c.viewed_at ? "text-warn" : "text-faint"} shrink-0`} />
                        <span className="text-muted">Read Receipt:</span>
                        {c.viewed_at ? (
                          <span className="text-warn font-semibold truncate" title={c.viewed_user_agent || ""}>
                            Opened {new Date(c.viewed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        ) : (
                          <span className="text-faint">Not viewed yet</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <ShieldCheck className={`w-3.5 h-3.5 ${c.client_signed_at ? "text-accent" : "text-faint"} shrink-0`} />
                        <span className="text-muted">Execution:</span>
                        {c.client_signed_at ? (
                          <span className="text-accent font-semibold">
                            Signed {new Date(c.client_signed_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-faint">Awaiting Signature</span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-card border-dashed border-line p-12 text-center">
              <FileSignature className="w-12 h-12 text-faint mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-fg">
                {contractsSub === "signed" ? "Nothing signed yet" : "No contracts waiting"}
              </h3>
              <p className="text-sm text-faint mt-1 max-w-md mx-auto">
                {contractsSub === "signed"
                  ? "Contracts flip into this page the moment a client signs — no refresh needed."
                  : "Send an agreement and it shows up here with a live read/signature status."}
              </p>
              <Button
                onClick={() => setShowCreateContractPage(true)}
                className="mt-6 bg-accent hover:bg-accent-hi text-accent-fg"
              >
                <FileSignature className="w-4 h-4 mr-1.5" />
                Create First Contract
              </Button>
            </Card>
          )}
        </div>
      )}
      </>
      )}

      {/* CREATE PROJECT — in-page screen, replaces the list (no popup) */}
      {showCreateProjectPage && (
        <div className="animate-in fade-in duration-300">
          <Card className="w-full max-w-xl bg-card border-line p-6 space-y-4">
            <div className="border-b border-line pb-3">
              <h3 className="text-lg font-bold text-fg">Create Project</h3>
              <p className="text-muted text-xs mt-0.5">One job, one home — tasks, contracts, time and invoices attach to it.</p>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted">Project Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Next.js Mobile App MVP"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted">Client (Optional)</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
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
                <label className="text-xs font-semibold text-muted">Budget ($)</label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Scope of work and deliverables..."
                  rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div className="pt-3 border-t border-line flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateProjectPage(false)}
                  className="border-line text-fg"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-accent hover:bg-accent-hi text-accent-fg">
                  Save Project
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* CREATE CONTRACT — in-page screen, replaces the list (no popup) */}
      {showCreateContractPage && (
        <div className="animate-in fade-in duration-300">
          <Card className="w-full max-w-2xl bg-card border-line p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <FileSignature className="w-5 h-5 text-info" />
              <div>
                <h3 className="text-lg font-bold text-fg">Create & Send E-Signature Contract</h3>
                <p className="text-muted text-xs mt-0.5">Pick a template, adjust the terms, get a signable link.</p>
              </div>
            </div>

            <form onSubmit={handleCreateContract} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted">Associated Project *</label>
                  <select
                    value={contractProjectId}
                    onChange={(e) => setContractProjectId(e.target.value)}
                    required
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
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
                  <label className="text-xs font-semibold text-muted">Client Recipient (Optional)</label>
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
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
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
                <label className="text-xs font-semibold text-muted">Contract Agreement Title *</label>
                <input
                  type="text"
                  value={contractTitle}
                  onChange={(e) => setContractTitle(e.target.value)}
                  placeholder="e.g. Full-Stack Web Development Agreement"
                  required
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                />
              </div>

              {/* Template Picker */}
              <div>
                <label className="text-xs font-semibold text-muted block mb-1.5">Load Standard Template:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CONTRACT_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => {
                        setContractTitle(tmpl.name);
                        setContractContent(tmpl.content);
                      }}
                      className="p-2.5 rounded-lg border border-line bg-bg hover:border-accent/40 text-left text-xs transition-colors group"
                    >
                      <span className="font-semibold text-fg block group-hover:text-info truncate">
                        {tmpl.name.split(" ")[0]}
                      </span>
                      <span className="text-[10px] text-faint truncate block">{tmpl.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Terms Content Editor */}
              <div>
                <label className="text-xs font-semibold text-muted">Terms & Agreement Body (Markdown) *</label>
                <textarea
                  value={contractContent}
                  onChange={(e) => setContractContent(e.target.value)}
                  rows={8}
                  required
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg font-mono text-xs focus:outline-none focus:border-accent leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-line flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateContractPage(false)}
                  className="border-line text-fg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold"
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
          <Card className="w-full max-w-2xl bg-card border-line p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <span className="text-[10px] font-mono text-info uppercase">Contract Audit Sheet</span>
                <h3 className="text-lg font-bold text-fg">{viewingContract.title}</h3>
              </div>
              <button
                onClick={() => setViewingContract(null)}
                className="text-muted hover:text-fg text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-bg border border-line space-y-3 text-xs font-mono">
              <div className="flex justify-between border-b border-line pb-2">
                <span className="text-muted">Status:</span>
                <span className="text-info font-bold uppercase">{viewingContract.status}</span>
              </div>
              <div className="flex justify-between border-b border-line pb-2">
                <span className="text-muted">Issued Timestamp:</span>
                <span className="text-fg">{new Date(viewingContract.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-line pb-2">
                <span className="text-muted">Client Read / Open Timestamp:</span>
                <span className="text-warn">
                  {viewingContract.viewed_at ? new Date(viewingContract.viewed_at).toLocaleString() : "Not Opened Yet"}
                </span>
              </div>
              {viewingContract.viewed_user_agent && (
                <div className="flex justify-between border-b border-line pb-2">
                  <span className="text-muted">Client Device / User-Agent:</span>
                  <span className="text-fg truncate max-w-xs">{viewingContract.viewed_user_agent}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-line pb-2">
                <span className="text-muted">Signature Execution:</span>
                <span className="italic font-medium text-accent">
                  {viewingContract.client_signed_at
                    ? new Date(viewingContract.client_signed_at).toLocaleString()
                    : "Pending Signature"}
                </span>
              </div>
              {viewingContract.client_signature && (
                <div className="pt-2">
                  <span className="text-muted block mb-2">Recorded Client Signature:</span>
                  {viewingContract.client_signature.startsWith("data:image") ? (
                    <div className="p-2 bg-card rounded-lg border border-line flex justify-center">
                      <img
                        src={viewingContract.client_signature}
                        alt="Signature"
                        className="h-12 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="p-2 bg-card rounded-lg border border-line font-serif italic text-base text-info">
                      {viewingContract.client_signature.replace("typed:", "")}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="prose prose-invert max-w-none text-fg text-xs whitespace-pre-wrap font-mono bg-bg p-4 rounded-xl border border-line max-h-48 overflow-y-auto">
              {viewingContract.content}
            </div>

            <div className="pt-3 border-t border-line flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copySigningLink(viewingContract.token)}
                className="border-line text-xs text-fg"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Share Link
              </Button>
              <Button
                onClick={() => setViewingContract(null)}
                className="bg-accent hover:bg-accent-hi text-accent-fg text-xs"
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

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      }
    >
      <ProjectsContent />
    </Suspense>
  );
}
