"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Pencil,
  ExternalLink,
  Plus,
  Building2,
  Calendar,
  Receipt,
  RotateCcw,
  Archive,
  ArrowUpRight,
  Clock,
  Send,
  GitPullRequest,
  Upload,
  Download,
  Paperclip,
  FileText,
  Check,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SubTabs } from "@/components/dashboard/SubTabs";
import {
  getProject,
  updateProject,
  deleteProject,
  rotateProjectShareToken,
  createTask,
  updateTask,
  deleteTask,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  submitMilestone,
  listChangeRequests,
  createChangeRequest,
  updateChangeRequest,
  getContracts,
  getTimeEntries,
  getInvoices,
  listProjectFiles,
  registerProjectFile,
  deleteProjectFile,
  getStorageDownloadUrl,
  uploadFileToCloudinary,
  type Project,
  type Task,
  type Milestone,
  type ChangeRequest,
  type Contract,
  type TimeEntry,
  type Invoice,
  type ProjectFile,
} from "@/lib/api";
import { invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params?.id || "");
  const { getToken } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileCategory, setFileCategory] = useState<string>("document");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [copiedPortal, setCopiedPortal] = useState(false);

  // Sub-tab inside project detail
  const [activeTab, setActiveTab] = useState<
    "milestones" | "tasks" | "time" | "today" | "changes" | "contracts" | "documents" | "vault" | "notes"
  >("milestones");

  // Inline forms
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskHours, setNewTaskHours] = useState<number | undefined>(undefined);
  const [newTaskDue, setNewTaskDue] = useState("");
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneAmount, setNewMilestoneAmount] = useState<number>(1000);
  const [newMilestoneDeliverable, setNewMilestoneDeliverable] = useState("");
  const [showAddMilestone, setShowAddMilestone] = useState(false);

  // P3 change requests (scope-creep guard) — inline create form
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [showAddCR, setShowAddCR] = useState(false);
  const [crTitle, setCrTitle] = useState("");
  const [crDetail, setCrDetail] = useState("");
  const [crPrice, setCrPrice] = useState<number>(0);
  const [crImpactDays, setCrImpactDays] = useState<number>(0);

  // Server-independent "today" for the P4 Today view; set once on mount.
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const loadData = async () => {
    if (!projectId) return;
    try {
      const token = (await getToken()) || undefined;
      const [projData, contractData, timeData, invoiceData, crData, filesData] = await Promise.all([
        getProject(projectId, token),
        getContracts(undefined, token).catch(() => [] as Contract[]),
        getTimeEntries(token).catch(() => [] as TimeEntry[]),
        getInvoices(token, projectId).catch(() => [] as Invoice[]),
        listChangeRequests(projectId, token).catch(() => [] as ChangeRequest[]),
        listProjectFiles(projectId, token).catch(() => [] as ProjectFile[]),
      ]);

      setProject(projData);
      setContracts((contractData || []).filter((c) => c.project_id === projectId));
      setTimeEntries((timeData || []).filter((t) => t.project_id === projectId));
      setInvoices(invoiceData || []);
      setChangeRequests(crData || []);
      setProjectFiles(filesData || []);
    } catch (err) {
      console.error("Error loading project detail:", err);
      toast.error("Could not load project profile");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFiles = async (filesToUpload: FileList | File[]) => {
    if (!filesToUpload || filesToUpload.length === 0) return;
    setUploadingFile(true);
    try {
      const token = (await getToken()) || undefined;
      for (const file of Array.from(filesToUpload)) {
        const uploaded = await uploadFileToCloudinary(file);
        await registerProjectFile(
          projectId,
          {
            file_key: uploaded.url,
            file_name: file.name,
            content_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            category: fileCategory,
          },
          token
        );
      }
      toast.success(`${filesToUpload.length === 1 ? "File" : "Files"} uploaded successfully!`);
      const updatedFiles = await listProjectFiles(projectId, token);
      setProjectFiles(updatedFiles);
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload file(s)");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleOpenFile = async (fileKey: string) => {
    try {
      const token = (await getToken()) || undefined;
      const res = await getStorageDownloadUrl(fileKey, token);
      if (res?.url) {
        window.open(res.url, "_blank");
      }
    } catch (err) {
      toast.error("Could not download file");
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteProjectFile(projectId, fileId, token);
      toast.success("File deleted");
      setProjectFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      toast.error("Could not delete file");
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const afterMutation = () => {
    invalidateCache("projects:data");
    invalidateCache("dashboard:data");
    loadData();
  };

  // Milestone toggles
  const handleToggleMilestone = async (m: Milestone) => {
    setBusyAction(m.id);
    try {
      const token = (await getToken()) || undefined;
      await updateMilestone(
        projectId,
        m.id,
        { is_completed: !m.is_completed },
        token
      );
      afterMutation();
      toast.success(m.is_completed ? "Milestone reopened" : "Milestone completed!");
    } catch (err) {
      toast.error("Failed to update milestone");
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle.trim()) return;
    setBusyAction("add_milestone");
    try {
      const token = (await getToken()) || undefined;
      await createMilestone(
        projectId,
        {
          title: newMilestoneTitle.trim(),
          amount: Number(newMilestoneAmount) || 0,
          deliverable_note: newMilestoneDeliverable.trim() || undefined,
        },
        token
      );
      setNewMilestoneTitle("");
      setNewMilestoneDeliverable("");
      setShowAddMilestone(false);
      afterMutation();
      toast.success("Milestone phase added!");
    } catch (err) {
      toast.error("Could not add milestone");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    const ok = await confirmDialog({
      title: "Delete Milestone",
      message: "Are you sure you want to delete this phase?",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusyAction(milestoneId);
    try {
      const token = (await getToken()) || undefined;
      await deleteMilestone(projectId, milestoneId, token);
      afterMutation();
      toast.success("Milestone deleted");
    } catch (err) {
      toast.error("Failed to delete milestone");
    } finally {
      setBusyAction(null);
    }
  };

  // Task actions
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setBusyAction("add_task");
    try {
      const token = (await getToken()) || undefined;
      await createTask(
        projectId,
        {
          title: newTaskTitle.trim(),
          estimated_hours: newTaskHours,
          due_date: newTaskDue || undefined,
        },
        token
      );
      setNewTaskTitle("");
      setNewTaskHours(undefined);
      setNewTaskDue("");
      afterMutation();
      toast.success("Task added to sprint");
    } catch (err) {
      toast.error("Could not add task");
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleTask = async (t: Task) => {
    setBusyAction(t.id);
    try {
      const token = (await getToken()) || undefined;
      await updateTask(
        projectId,
        t.id,
        { status: t.status === "done" ? "todo" : "done" },
        token
      );
      afterMutation();
    } catch (err) {
      toast.error("Could not update task");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setBusyAction(taskId);
    try {
      const token = (await getToken()) || undefined;
      await deleteTask(projectId, taskId, token);
      afterMutation();
      toast.success("Task removed");
    } catch (err) {
      toast.error("Could not delete task");
    } finally {
      setBusyAction(null);
    }
  };

  // P6 — freelancer submits a deliverable so the client's sign-off clock starts.
  const handleSubmitMilestone = async (m: Milestone) => {
    setBusyAction(m.id);
    try {
      const token = (await getToken()) || undefined;
      await submitMilestone(projectId, m.id, m.deliverable_note || undefined, token);
      afterMutation();
      toast.success("Delivered — waiting for client sign-off in the portal");
    } catch (err) {
      toast.error("Could not submit deliverable");
    } finally {
      setBusyAction(null);
    }
  };

  // P3 — create a priced change request (client decides it in the portal).
  const handleAddChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crTitle.trim()) return;
    setBusyAction("add_cr");
    try {
      const token = (await getToken()) || undefined;
      await createChangeRequest(
        projectId,
        {
          title: crTitle.trim(),
          detail: crDetail.trim() || undefined,
          price: Number(crPrice) || 0,
          impact_days: Number(crImpactDays) || 0,
        },
        token
      );
      setCrTitle("");
      setCrDetail("");
      setCrPrice(0);
      setCrImpactDays(0);
      setShowAddCR(false);
      afterMutation();
      toast.success("Change request added — share the portal for approval");
    } catch (err) {
      toast.error("Could not add change request");
    } finally {
      setBusyAction(null);
    }
  };

  const handleMarkCRImplemented = async (c: ChangeRequest) => {
    setBusyAction(c.id);
    try {
      const token = (await getToken()) || undefined;
      await updateChangeRequest(projectId, c.id, { status: "implemented" }, token);
      afterMutation();
      toast.success("Marked implemented");
    } catch (err) {
      toast.error("Could not update change request");
    } finally {
      setBusyAction(null);
    }
  };

  // Archive / Restore
  const handleToggleArchive = async () => {
    if (!project) return;
    const nextStatus = project.status === "completed" ? "in_progress" : "completed";
    setBusyAction("archive");
    try {
      const token = (await getToken()) || undefined;
      await updateProject(project.id, { status: nextStatus }, token);
      afterMutation();
      toast.success(nextStatus === "completed" ? "Project moved to Archive" : "Project restored to Active");
    } catch (err) {
      toast.error("Could not update project status");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    const ok = await confirmDialog({
      title: "Delete Project",
      message: `Are you sure you want to delete "${project.title}" and all its tasks & milestones?`,
      confirmLabel: "Delete Project",
      danger: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const token = (await getToken()) || undefined;
      await deleteProject(project.id, token);
      invalidateCache("projects:data");
      invalidateCache("dashboard:data");
      toast.success("Project deleted successfully");
      router.push("/dashboard/projects");
    } catch (err) {
      toast.error("Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyPortal = () => {
    if (!project?.share_token) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/portal/${project.share_token}`;
    navigator.clipboard.writeText(url);
    setCopiedPortal(true);
    toast.success("Client portal link copied to clipboard!");
    setTimeout(() => setCopiedPortal(false), 2500);
  };

  // SE10 — revoke a leaked portal link and mint a fresh token.
  const handleRotatePortal = async () => {
    if (!project) return;
    const ok = await confirmDialog({
      message: "Rotate the portal link? The current URL will stop working immediately and you'll need to send the new one to your client.",
      danger: true,
      confirmLabel: "Rotate link",
    });
    if (!ok) return;
    setBusyAction("rotate-portal");
    try {
      const token = (await getToken()) || undefined;
      const updated = await rotateProjectShareToken(project.id, token);
      setProject(updated);
      toast.success("Portal link rotated — the old link is dead");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rotate the link");
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-24 text-center space-y-3">
        <Loader2 className="w-7 h-7 animate-spin text-accent mx-auto" />
        <p className="text-xs text-muted font-medium">Loading project profile...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <h2 className="text-lg font-medium text-fg">Project Not Found</h2>
        <p className="text-xs text-muted">
          This project may have been removed or does not exist in your workspace.
        </p>
        <Link href="/dashboard/projects">
          <Button className="rounded-xl px-4 text-xs bg-accent hover:bg-accent-hi text-accent-fg font-medium cursor-pointer">
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  // Parse metadata from description
  let category = "Featured";
  let currency = "USD";
  let priority = "medium";
  let deadline = "";
  let rawDescription = project.description || "";

  if (rawDescription) {
    const catMatch = rawDescription.match(/\[category:\s*([^\]]+)\]/i);
    if (catMatch && catMatch[1] && catMatch[1].trim() !== "[object Object]") {
      category = catMatch[1].trim();
    }
    const currMatch = rawDescription.match(/\[currency:\s*([^\]]+)\]/i);
    if (currMatch && currMatch[1]) currency = currMatch[1].trim();
    const prioMatch = rawDescription.match(/\[priority:\s*([^\]]+)\]/i);
    if (prioMatch && prioMatch[1]) priority = prioMatch[1].trim();
    const deadMatch = rawDescription.match(/\[deadline:\s*([^\]]+)\]/i);
    if (deadMatch && deadMatch[1]) deadline = deadMatch[1].trim();

    rawDescription = rawDescription
      .replace(/\[category:\s*[^\]]+\]/gi, "")
      .replace(/\[currency:\s*[^\]]+\]/gi, "")
      .replace(/\[priority:\s*[^\]]+\]/gi, "")
      .replace(/\[deadline:\s*[^\]]+\]/gi, "")
      .replace(/\[object Object\]/gi, "")
      .trim();
  }

  const milestonesList = project.milestones || [];
  const tasksList = project.tasks || [];
  const completedMilestones = milestonesList.filter((m) => m.is_completed).length;
  const completedTasks = tasksList.filter((t) => t.status === "done").length;

  // P4 "today" buckets. `today` is captured in an effect (never `new Date()`
  // during render) so the purity lint rule holds and the comparison is stable.
  const openTasks = tasksList.filter((t) => t.status !== "done" && t.due_date);
  const overdueTasks = openTasks.filter((t) => today && t.due_date! < today);
  const dueTodayTasks = openTasks.filter((t) => today && t.due_date === today);

  // P2 deadline verdict (derived server-side against the real due_date column).
  const dl = project.deadline;
  const verdictMeta: Record<string, { label: string; cls: string }> = {
    overdue: { label: "Overdue", cls: "bg-danger/15 text-danger border-danger/30" },
    at_risk: { label: "At risk", cls: "bg-warn/20 text-warn border-warn/30" },
    on_track: { label: "On track", cls: "bg-accent-soft text-accent border-accent/20" },
    completed: { label: "Delivered", cls: "bg-ok/15 text-ok border-ok/30" },
  };
  const unbilledHours = project.unbilled_hours ?? 0;
  const unbilledValue = project.unbilled_value ?? 0;

  const totalTrackedHours = timeEntries.reduce((acc, t) => acc + ((t.duration_seconds || 0) / 3600), 0);
  const workValue = totalTrackedHours * (project.hourly_rate || 100);
  const budgetBurnPct = project.budget > 0 ? Math.min(100, Math.round((workValue / project.budget) * 100)) : 0;

  const isCompleted = project.status === "completed";
  const portalUrl = project.share_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${project.share_token}`
    : "";

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6">
      {/* Top Header */}
      <div className="space-y-4 pb-4 border-b border-line">
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Projects</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            {/* Soft colorful pill tags */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg mr-1 capitalize">
                {project.title}
              </h1>

              {/* Status Pill */}
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border capitalize ${
                  isCompleted
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                    : "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25"
                }`}
              >
                {isCompleted ? "★ Completed" : project.status === "in_progress" ? "In Progress" : project.status}
              </span>

              {/* Category Pill */}
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25 capitalize">
                {category}
              </span>

              {/* Priority Pill */}
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border capitalize ${
                  priority === "high"
                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25"
                    : priority === "medium"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                }`}
              >
                {priority} Priority
              </span>

              {/* P2 deadline verdict pill (from the real due_date, not note text) */}
              {dl && verdictMeta[dl.verdict] && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border ${verdictMeta[dl.verdict].cls}`}
                  title={dl.due_date ? `Due ${new Date(dl.due_date).toLocaleDateString()}` : undefined}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {verdictMeta[dl.verdict].label}
                  {dl.verdict !== "completed" && (
                    <span className="font-mono">{dl.days_left < 0 ? `${-dl.days_left}d late` : `${dl.days_left}d left`}</span>
                  )}
                </span>
              )}

              {/* P1 unbilled-hours chip -> bill these hours */}
              {unbilledHours > 0 && (
                <Link href="/dashboard/invoices/new">
                  <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border bg-accent-soft text-accent border-accent/20 cursor-pointer">
                    <Receipt className="w-3.5 h-3.5" />
                    Unbilled {unbilledHours.toFixed(1)}h = {currency} {Math.round(unbilledValue).toLocaleString("en-US")}
                  </span>
                </Link>
              )}
            </div>

            {project.client_name && (
              <p className="text-xs text-muted font-normal flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-accent" />
                <span className="text-fg font-medium">{project.client_name}</span>
                <>
                  <span>•</span>
                  <span className="text-muted flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-accent" /> Due{" "}
                    {project.due_date
                      ? new Date(project.due_date).toLocaleDateString()
                      : deadline
                      ? new Date(deadline).toLocaleDateString()
                      : "Not set"}
                  </span>
                </>
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/dashboard/projects/${project.id}/edit`}>
              <Button
                variant="outline"
                size="sm"
                className="text-xs rounded-xl h-9 px-3.5 border-line cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit Project
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleArchive}
              disabled={busyAction === "archive"}
              className="text-xs rounded-xl h-9 px-3 border-line"
              title={isCompleted ? "Restore Project to Active" : "Archive Project"}
            >
              {isCompleted ? <RotateCcw className="w-3.5 h-3.5 mr-1" /> : <Archive className="w-3.5 h-3.5 mr-1" />}
              {isCompleted ? "Restore" : "Archive"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteProject}
              disabled={deleting}
              className="text-xs rounded-xl h-9 px-2.5 text-muted hover:text-danger hover:bg-danger/10"
              title="Delete Project"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Metric Strip (3 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. Project Budget */}
        <div className="p-5 rounded-2xl bg-card border border-line flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-muted">Agreed Project Budget</span>
            <div className="text-2xl font-mono font-medium text-fg">
              {currency} {(project.budget || 0).toLocaleString("en-US")}
            </div>
          </div>
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border bg-emerald-500/15 text-emerald-400 border-emerald-500/25">
            Budget
          </span>
        </div>

        {/* 2. Tracked Work Value */}
        <div className="p-5 rounded-2xl bg-card border border-line flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-muted">Tracked Time Value</span>
            <div className="text-2xl font-mono font-medium text-accent">
              {currency} {Math.round(workValue).toLocaleString("en-US")}
            </div>
          </div>
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border bg-accent-soft text-accent border-accent/20">
            {totalTrackedHours.toFixed(1)} hrs
          </span>
        </div>

        {/* 3. Progress */}
        <div className="p-5 rounded-2xl bg-card border border-line flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-muted">Deliverable Progress</span>
            <div className="text-2xl font-mono font-medium text-fg">
              {project.progress_pct ?? 0}%
            </div>
          </div>
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border bg-sky-500/15 text-sky-400 border-sky-500/25">
            {completedMilestones}/{milestonesList.length} Phases
          </span>
        </div>
      </div>

      {/* Main Details Grid (8 cols Main Tabs, 4 cols Metadata Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Deep SubTabs (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Internal SubTabs */}
          <SubTabs
            tabs={[
              { value: "milestones", label: "Milestones", count: milestonesList.length },
              { value: "tasks", label: "Tasks", count: tasksList.length },
              { value: "today", label: "Today", count: overdueTasks.length + dueTodayTasks.length },
              { value: "time", label: "Time Log", count: timeEntries.length },
              { value: "changes", label: "Changes", count: changeRequests.length },
              { value: "contracts", label: "Contracts", count: contracts.length },
              { value: "documents", label: "Documents", count: projectFiles.length },
              { value: "vault", label: "Links Vault" },
              { value: "notes", label: "Scope & Brief" },
            ] as const}
            value={activeTab}
            onChange={(v) => setActiveTab(v as any)}
          />

          {/* TAB 1: MILESTONES & PHASES */}
          {activeTab === "milestones" && (
            <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-medium text-fg">
                    Project Phases & Deliverable Sign-Offs
                  </h2>
                  <p className="text-xs text-muted">
                    Check off completed milestones to update progress and sync client portal.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddMilestone(!showAddMilestone)}
                  className="text-xs rounded-xl h-8 px-3 border-accent/30 text-accent hover:bg-accent-soft"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Phase
                </Button>
              </div>

              {showAddMilestone && (
                <form onSubmit={handleAddMilestone} className="p-4 rounded-xl bg-surface/50 border border-line space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Phase name (e.g. Sprint 1 Build)..."
                      value={newMilestoneTitle}
                      onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      className="sm:col-span-2 h-9 px-3 rounded-lg bg-card border border-line text-fg text-xs focus:outline-none focus:border-accent"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={newMilestoneAmount}
                      onChange={(e) => setNewMilestoneAmount(Number(e.target.value) || 0)}
                      className="h-9 px-3 rounded-lg bg-card border border-line text-fg text-xs font-mono focus:outline-none focus:border-accent text-right"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Deliverable description (e.g. Staging deployment ready)..."
                    value={newMilestoneDeliverable}
                    onChange={(e) => setNewMilestoneDeliverable(e.target.value)}
                    className="w-full h-8 px-3 rounded-lg bg-card border border-line text-fg text-xs focus:outline-none focus:border-accent"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddMilestone(false)}
                      className="text-xs h-7"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={busyAction === "add_milestone"}
                      className="bg-accent text-accent-fg text-xs h-7 px-3 font-semibold"
                    >
                      Save Phase
                    </Button>
                  </div>
                </form>
              )}

              {milestonesList.length === 0 ? (
                <p className="text-xs text-muted italic py-4 text-center">
                  No milestone phases defined yet. Click &quot;Add Phase&quot; above to add one.
                </p>
              ) : (
                <div className="space-y-3">
                  {milestonesList.map((m, idx) => (
                    <div
                      key={m.id}
                      className={`p-4 rounded-xl border transition-all ${
                        m.is_completed
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : "bg-surface/30 border-line"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-start gap-3 cursor-pointer select-none flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={m.is_completed}
                            onChange={() => handleToggleMilestone(m)}
                            disabled={busyAction === m.id}
                            className="mt-0.5 rounded border-line text-accent w-4 h-4 focus:ring-0 cursor-pointer"
                          />
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-medium block ${m.is_completed ? "line-through text-muted" : "text-fg"}`}>
                                {m.title}
                              </span>
                              {m.is_completed ? (
                                <Badge className="bg-ok/15 text-ok border-ok/30 text-[10px]">Signed off</Badge>
                              ) : m.submitted_at ? (
                                <Badge className="bg-info/15 text-info border-info/30 text-[10px]">Waiting on client</Badge>
                              ) : (
                                <Badge className="bg-surface text-muted border-line text-[10px]">In progress</Badge>
                              )}
                            </div>
                            {m.deliverable_note && (
                              <p className="text-xs text-muted">{m.deliverable_note}</p>
                            )}
                            {m.due_date && (
                              <p className="text-[11px] text-faint font-mono">Due {new Date(m.due_date).toLocaleDateString()}</p>
                            )}
                          </div>
                        </label>

                        <div className="flex items-center gap-2 shrink-0">
                          {m.amount > 0 && (
                            <span className="text-xs font-mono font-medium text-fg bg-surface px-2.5 py-1 rounded-md border border-line">
                              {currency} {m.amount.toLocaleString("en-US")}
                            </span>
                          )}
                          {!m.is_completed && !m.submitted_at && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSubmitMilestone(m)}
                              disabled={busyAction === m.id}
                              className="text-xs h-7 px-2.5 rounded-lg border-accent/30 text-accent hover:bg-accent-soft"
                              title="Mark delivered and start the client sign-off clock"
                            >
                              <Send className="w-3.5 h-3.5 mr-1" /> Submit
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMilestone(m.id)}
                            className="text-muted hover:text-danger p-1 h-7 w-7"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* TAB 2: TASKS & SPRINT CHECKLIST */}
          {activeTab === "tasks" && (
            <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <h2 className="text-sm font-medium text-fg">
                  Sprint Tasks ({completedTasks}/{tasksList.length} Done)
                </h2>
              </div>

              {/* Add task bar */}
              <form onSubmit={handleAddTask} className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder="Add a new task..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-xl bg-surface/50 border border-line text-fg text-xs sm:text-sm focus:outline-none focus:border-accent"
                />
                <input
                  type="number"
                  placeholder="Hrs"
                  value={newTaskHours ?? ""}
                  onChange={(e) => setNewTaskHours(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-16 h-9 px-2 rounded-xl bg-surface/50 border border-line text-fg text-xs font-mono text-center focus:outline-none focus:border-accent"
                />
                <input
                  type="date"
                  value={newTaskDue}
                  onChange={(e) => setNewTaskDue(e.target.value)}
                  className="w-36 h-9 px-2 rounded-xl bg-surface/50 border border-line text-fg text-xs focus:outline-none focus:border-accent"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={busyAction === "add_task" || !newTaskTitle.trim()}
                  className="bg-accent text-accent-fg text-xs h-9 px-3 font-semibold rounded-xl"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </form>

              {tasksList.length === 0 ? (
                <p className="text-xs text-muted italic py-4 text-center">
                  No tasks added to this sprint yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {tasksList.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-surface/30 border border-line flex items-center justify-between gap-3 text-xs group"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={t.status === "done"}
                          onChange={() => handleToggleTask(t)}
                          disabled={busyAction === t.id}
                          className="rounded border-line text-accent w-4 h-4 focus:ring-0"
                        />
                        <div className="min-w-0">
                          <span className={`font-medium truncate block ${t.status === "done" ? "line-through text-muted" : "text-fg"}`}>
                            {t.title}
                          </span>
                          {/* P5 actual vs estimated + P4 due date */}
                          {t.estimated_hours ? (
                            <span className="text-[11px] font-mono text-muted">
                              {t.actual_hours?.toFixed(1) ?? 0}h / {t.estimated_hours}h est
                            </span>
                          ) : t.actual_hours ? (
                            <span className="text-[11px] font-mono text-muted">{t.actual_hours.toFixed(1)}h logged</span>
                          ) : null}
                        </div>
                      </label>

                      <div className="flex items-center gap-2 shrink-0">
                        {t.due_date && (
                          <span
                            className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${
                              t.status !== "done" && today && t.due_date < today
                                ? "text-danger border-danger/30 bg-danger/10"
                                : t.status !== "done" && t.due_date === today
                                ? "text-warn border-warn/30 bg-warn/10"
                                : "text-muted border-line"
                            }`}
                          >
                            {new Date(t.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {t.priority === "urgent" && (
                          <Badge className="bg-danger/15 text-danger border-danger/30 text-[10px]">urgent</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(t.id)}
                          className="text-muted hover:text-danger p-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* TAB: TODAY — overdue + due-today tasks (P4) */}
          {activeTab === "today" && (
            <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <h2 className="text-sm font-medium text-fg">Today&apos;s Work</h2>
                <span className="text-xs font-mono text-muted">
                  {overdueTasks.length} overdue · {dueTodayTasks.length} due today
                </span>
              </div>

              {overdueTasks.length === 0 && dueTodayTasks.length === 0 ? (
                <p className="text-xs text-muted italic py-4 text-center">
                  Nothing overdue or due today. Add due dates to tasks to build today&apos;s queue.
                </p>
              ) : (
                <div className="space-y-2">
                  {[...overdueTasks, ...dueTodayTasks].map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-surface/30 border border-line flex items-center justify-between gap-3 text-xs"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={t.status === "done"}
                          onChange={() => handleToggleTask(t)}
                          disabled={busyAction === t.id}
                          className="rounded border-line text-accent w-4 h-4 focus:ring-0"
                        />
                        <span className="font-medium truncate text-fg">{t.title}</span>
                      </label>
                      <span
                        className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${
                          t.due_date && today && t.due_date < today
                            ? "text-danger border-danger/30 bg-danger/10"
                            : "text-warn border-warn/30 bg-warn/10"
                        }`}
                      >
                        {t.due_date ? new Date(t.due_date).toLocaleDateString() : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* TAB: CHANGE REQUESTS — priced scope changes (P3) */}
          {activeTab === "changes" && (
            <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-medium text-fg">Change Requests &amp; Scope Creep Guard</h2>
                  <p className="text-xs text-muted">
                    Price each &ldquo;one more thing&rdquo; and let the client approve it in the portal.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddCR(!showAddCR)}
                  className="text-xs rounded-xl h-8 px-3 border-accent/30 text-accent hover:bg-accent-soft"
                >
                  <GitPullRequest className="w-3.5 h-3.5 mr-1" /> Add Change
                </Button>
              </div>

              {showAddCR && (
                <form onSubmit={handleAddChangeRequest} className="p-4 rounded-xl bg-surface/50 border border-line space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="What's the added scope? (e.g. Add multi-currency)"
                    value={crTitle}
                    onChange={(e) => setCrTitle(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-card border border-line text-fg text-xs focus:outline-none focus:border-accent"
                  />
                  <input
                    type="text"
                    placeholder="Detail / why it's out of scope..."
                    value={crDetail}
                    onChange={(e) => setCrDetail(e.target.value)}
                    className="w-full h-8 px-3 rounded-lg bg-card border border-line text-fg text-xs focus:outline-none focus:border-accent"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      min={0}
                      placeholder="Price"
                      value={crPrice ?? ""}
                      onChange={(e) => setCrPrice(Number(e.target.value) || 0)}
                      className="h-9 px-3 rounded-lg bg-card border border-line text-fg text-xs font-mono focus:outline-none focus:border-accent"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="Impact days"
                      value={crImpactDays ?? ""}
                      onChange={(e) => setCrImpactDays(Number(e.target.value) || 0)}
                      className="h-9 px-3 rounded-lg bg-card border border-line text-fg text-xs font-mono focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddCR(false)} className="text-xs h-7">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={busyAction === "add_cr"}
                      className="bg-accent text-accent-fg text-xs h-7 px-3 font-semibold"
                    >
                      Save Change
                    </Button>
                  </div>
                </form>
              )}

              {changeRequests.length === 0 ? (
                <p className="text-xs text-muted italic py-4 text-center">No change requests yet.</p>
              ) : (
                <div className="space-y-2">
                  {changeRequests.map((c) => (
                    <div key={c.id} className="p-3.5 rounded-xl bg-surface/30 border border-line flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg">{c.title}</p>
                        <p className="text-[11px] font-mono text-muted">
                          {currency} {c.price.toLocaleString("en-US")}
                          {c.impact_days > 0 && ` · +${c.impact_days}d`}
                          {c.decided_at && ` · decided ${new Date(c.decided_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          className={`text-[10px] capitalize border ${
                            c.status === "approved" || c.status === "implemented"
                              ? "bg-ok/15 text-ok border-ok/30"
                              : c.status === "rejected"
                              ? "bg-danger/15 text-danger border-danger/30"
                              : "bg-warn/20 text-warn border-warn/30"
                          }`}
                        >
                          {c.status}
                        </Badge>
                        {c.status === "approved" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkCRImplemented(c)}
                            disabled={busyAction === c.id}
                            className="text-xs h-7 px-2.5 rounded-lg border-line"
                          >
                            Mark done
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* TAB 3: TIME & VALUE TRACKER */}
          {activeTab === "time" && (
            <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <div>
                  <h2 className="text-sm font-medium text-fg">
                    Logged Work & Billable Time
                  </h2>
                  <p className="text-xs text-muted">
                    Total: <strong className="text-fg">{totalTrackedHours.toFixed(1)} hrs</strong> ({currency} {Math.round(workValue).toLocaleString("en-US")})
                  </p>
                </div>
                <Link href={`/dashboard/time-tracker`}>
                  <Button variant="outline" size="sm" className="text-xs rounded-xl h-8 px-3 border-line">
                    Open Timer ↗
                  </Button>
                </Link>
              </div>

              {timeEntries.length === 0 ? (
                <p className="text-xs text-muted italic py-4 text-center">
                  No time logged for this project yet. Start the live stopwatch in Time Tracker to log work.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {timeEntries.map((te) => {
                    const hours = (te.duration_seconds || 0) / 3600;
                    return (
                      <div
                        key={te.id}
                        className="p-3 rounded-xl bg-surface/30 border border-line flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-medium text-fg block">{te.description || "Development sprint"}</span>
                          <span className="text-[11px] text-muted font-mono">
                            {new Date(te.start_time).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-fg block">{hours.toFixed(2)} hrs</span>
                          <span className="text-[11px] text-accent font-mono">
                            {currency} {Math.round(hours * (te.hourly_rate || project.hourly_rate || 100))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* TAB 4: CONTRACTS & SOWS */}
          {activeTab === "contracts" && (
            <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <h2 className="text-sm font-medium text-fg">
                  Attached Contracts & SOW Agreements ({contracts.length})
                </h2>
              </div>

              {contracts.length === 0 ? (
                <p className="text-xs text-muted italic py-4 text-center">
                  No contracts attached to this project yet. Create one from the main Contracts tab.
                </p>
              ) : (
                <div className="space-y-3">
                  {contracts.map((c) => (
                    <div key={c.id} className="p-4 rounded-xl bg-surface/30 border border-line space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-fg">{c.title}</h4>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full border capitalize font-medium ${
                            c.status === "signed"
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                              : "bg-sky-500/15 text-sky-400 border-sky-500/25"
                          }`}
                        >
                          {c.status === "signed" ? "★ Signed" : c.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-line/60 text-xs">
                        <span className="text-muted font-mono">{c.recipient_email || "Direct client"}</span>
                        <a
                          href={`/sign-contract/${c.token || c.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent font-medium hover:underline inline-flex items-center gap-1"
                        >
                          <span>Sign Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* TAB: PROJECT DOCUMENTS & DROPZONE */}
          {activeTab === "documents" && (
            <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div>
                  <h2 className="text-sm font-medium text-fg">
                    Project Documents & Assets Vault
                  </h2>
                  <p className="text-xs text-muted">
                    Upload and manage project briefs, specs, design assets, and deliverables with instant preview.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={fileCategory}
                    onChange={(e) => setFileCategory(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-line bg-surface/60 text-fg text-xs focus:outline-none focus:border-accent"
                  >
                    <option value="document">General Doc</option>
                    <option value="brief">Client Brief</option>
                    <option value="spec">Specification</option>
                    <option value="asset">Design Asset</option>
                    <option value="deliverable">Deliverable</option>
                    <option value="contract">Contract/NDA</option>
                  </select>
                </div>
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  if (e.dataTransfer?.files?.length) {
                    handleUploadFiles(e.dataTransfer.files);
                  }
                }}
                className={`relative p-8 rounded-2xl border-2 border-dashed transition-all duration-200 text-center flex flex-col items-center justify-center cursor-pointer ${
                  isDragging
                    ? "border-accent bg-accent/10 ring-4 ring-accent/20 scale-[0.99]"
                    : "border-line/80 bg-surface/30 hover:border-line-strong hover:bg-surface/60"
                }`}
                onClick={() => {
                  const input = document.getElementById("project-file-upload-input");
                  input?.click();
                }}
              >
                <input
                  id="project-file-upload-input"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      handleUploadFiles(e.target.files);
                      e.target.value = "";
                    }
                  }}
                />
                <div className="w-12 h-12 rounded-2xl bg-surface border border-line flex items-center justify-center text-muted mb-3 group-hover:text-accent shadow-xs">
                  {uploadingFile ? (
                    <Loader2 className="w-6 h-6 text-accent animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6 text-accent" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-fg">
                    {uploadingFile
                      ? "Uploading & encrypting file..."
                      : isDragging
                      ? "Drop files here to upload"
                      : "Drag & drop project files, or click to browse"}
                  </p>
                  <p className="text-xs text-muted">
                    PDF, PNG, JPG, Figma, ZIP, MP4 up to 50MB
                  </p>
                </div>
              </div>

              {/* Uploaded Documents List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-medium text-muted">Uploaded Files</span>
                  {projectFiles.length > 0 && (
                    <span className="text-xs text-muted font-mono">
                      {projectFiles.length} {projectFiles.length === 1 ? "file" : "files"}
                    </span>
                  )}
                </div>

                {projectFiles.length === 0 ? (
                  <div className="p-8 text-center rounded-xl border border-dashed border-line bg-surface/20 text-muted text-xs">
                    No documents uploaded for this project yet. Drag and drop any file above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projectFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-line/70 bg-card hover:bg-surface/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-surface border border-line flex items-center justify-center text-muted shrink-0 group-hover:text-accent">
                            <Paperclip className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-fg truncate">
                              {f.file_name}
                            </p>
                            <p className="text-[11px] text-muted">
                              <span className="capitalize font-medium text-accent">
                                {f.category}
                              </span>{" "}
                              • {(f.size_bytes / 1024).toFixed(0)} KB •{" "}
                              {new Date(f.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenFile(f.file_key)}
                            className="h-8 px-2.5 text-xs text-muted hover:text-fg flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Download</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteFile(f.id)}
                            className="h-8 w-8 p-0 text-muted hover:text-danger hover:bg-danger/10"
                            title="Delete file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* TAB 5: LINKS VAULT */}
          {activeTab === "vault" && (
            <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
              <h2 className="text-sm font-medium text-fg pb-2 border-b border-line">
                Deliverables & Access Vault
              </h2>
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-surface/30 border border-line flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-fg font-medium block">Public Client Portal</span>
                    <span className="text-muted font-mono text-[11px] truncate block max-w-xs">{portalUrl || "Token active"}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={handleCopyPortal} className="text-xs h-8 px-3 rounded-lg border-line">
                      {copiedPortal ? "Copied" : "Copy"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRotatePortal()}
                      disabled={busyAction === "rotate-portal"}
                      className="text-xs h-8 px-3 rounded-lg border-line"
                      title="Issue a new link and revoke the current one"
                    >
                      {busyAction === "rotate-portal" ? "Rotating…" : "Rotate"}
                    </Button>
                    {project.share_token && (
                      <a href={`/portal/${project.share_token}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs text-accent hover:underline font-medium px-2 py-1">
                        <span>Open ↗</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* TAB 6: SCOPE & NOTES */}
          {activeTab === "notes" && (
            <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-3">
              <h2 className="text-sm font-medium text-fg pb-2 border-b border-line">
                Project Scope & Deliverable Notes
              </h2>
              {rawDescription ? (
                <p className="text-sm text-fg leading-relaxed whitespace-pre-wrap">
                  {rawDescription}
                </p>
              ) : (
                <p className="text-xs text-muted italic">
                  No additional scope notes added yet. Click &quot;Edit Project&quot; to add details.
                </p>
              )}
            </Card>
          )}
        </div>

        {/* Right Column: Metadata & Quick Links (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-5 rounded-2xl border-line bg-card space-y-4">
            <h2 className="text-sm font-medium text-fg pb-2 border-b border-line">
              Project Overview
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted block mb-0.5">Assigned Client</span>
                {project.client_id ? (
                  <Link href={`/dashboard/clients/${project.client_id}`} className="text-accent font-medium hover:underline">
                    {project.client_name || "View Client Profile"}
                  </Link>
                ) : (
                  <span className="text-fg font-medium">Internal / Direct</span>
                )}
              </div>

              <div>
                <span className="text-muted block mb-0.5">Category</span>
                <span className="text-fg font-medium capitalize">{category}</span>
              </div>

              <div>
                <span className="text-muted block mb-0.5">Budget Burn</span>
                <div className="space-y-1">
                  <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        budgetBurnPct >= 90 ? "bg-rose-500" : budgetBurnPct >= 70 ? "bg-amber-500" : "bg-accent"
                      }`}
                      style={{ width: `${budgetBurnPct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-muted">
                    {budgetBurnPct}% of budget spent
                  </span>
                </div>
              </div>

              <div>
                <span className="text-muted block mb-0.5">Hourly Rate</span>
                <span className="text-fg font-mono font-medium">
                  {currency} {project.hourly_rate || 100}/hr
                </span>
              </div>

              <div>
                <span className="text-muted block mb-0.5">Created Date</span>
                <span className="text-fg font-mono">
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Card>

          {/* Quick Module Shortcuts */}
          <div className="space-y-2">
            <Link href={`/dashboard/invoices?client=${project.client_id || ""}`} className="block">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between text-xs font-medium rounded-xl border-line bg-card hover:bg-surface/60 group transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2 text-fg">
                  <Receipt className="w-3.5 h-3.5 text-accent" />
                  Invoices & Statements
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-accent-soft text-accent text-[10px] font-mono px-2 py-0.5 border border-accent/20">
                    {invoices.length}
                  </Badge>
                  <ArrowUpRight className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors" />
                </div>
              </Button>
            </Link>

            <Link href="/dashboard/clients" className="block">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between text-xs font-medium rounded-xl border-line bg-card hover:bg-surface/60 group transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2 text-fg">
                  <Building2 className="w-3.5 h-3.5 text-accent" />
                  Clients Roster
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
