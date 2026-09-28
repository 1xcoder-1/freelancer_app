"use client";

import { useState } from "react";
import {
  ClipboardList,
  Plus,
  Copy,
  CheckCircle2,
  ExternalLink,
  Trash2,
  Eye,
  MessageSquare,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getIntakeForms,
  createIntakeForm,
  deleteIntakeForm,
  getIntakeSubmissions,
  IntakeForm,
  IntakeSubmission
} from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { z } from "zod";
import { validateOrToast, nameSchema, optionalTextSchema } from "@/lib/validation";

const intakeFormSchema = z.object({
  title: nameSchema("Form title", 150),
  description: optionalTextSchema("Description", 1000),
});

export function IntakePanel() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewSubmissionsOpen, setViewSubmissionsOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<IntakeForm | null>(null);
  const [submissions, setSubmissions] = useState<IntakeSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Form creation inputs
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Array<{ id: string; label: string; type: string; required: boolean }>>([
    { id: "q1", label: "What is your project goal and target audience?", type: "textarea", required: true },
    { id: "q2", label: "What is your estimated timeline or launch target?", type: "text", required: true },
    { id: "q3", label: "Please share links to inspiration or existing brand assets:", type: "textarea", required: false },
  ]);
  const [creating, setCreating] = useState(false);

  const { data: formsData, loading, refresh: fetchForms, mutate } = useApiData<IntakeForm[]>(
    "intake:forms",
    async (token) => {
      return await getIntakeForms(token);
    },
    { reportContext: "intake" }
  );

  const forms = formsData ?? [];

  const handleCopy = (token: string, id: string) => {
    const url = `${window.location.origin}/intake/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `q${Date.now()}`,
        label: "",
        type: "text",
        required: false,
      },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, field: string, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOrToast(intakeFormSchema, { title, description })) return;

    setCreating(true);
    try {
      await createIntakeForm({
        title,
        description,
        questions,
      });
      setTitle("");
      setDescription("");
      setCreateModalOpen(false);
      await fetchForms();
      toast.success("Form created");
    } catch (err) {
      console.error("Failed to create form:", err);
      toast.error("Could not create form");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteForm = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete form",
      message: "This intake form and all the answers clients submitted through it will be removed permanently.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteIntakeForm(id);
      mutate((prev) => (prev ?? []).filter((f) => f.id !== id));
      toast.success("Form deleted");
    } catch (err) {
      console.error("Failed to delete form:", err);
      toast.error("Could not delete form");
    }
  };

  const handleOpenSubmissions = async (form: IntakeForm) => {
    setSelectedForm(form);
    setViewSubmissionsOpen(true);
    setLoadingSubmissions(true);
    try {
      const subs = await getIntakeSubmissions(form.id);
      setSubmissions(subs);
    } catch (err) {
      console.error("Failed to load submissions:", err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold tracking-tight text-fg">Intake forms</h2>
          </div>
          <p className="text-muted text-sm mt-1">
            Send clients a short questionnaire to collect project details before you start.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchForms(true)}
            disabled={loading}
            className="border-line text-fg"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Intake Form
          </Button>
        </div>
      </div>

      {/* Forms List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card border-line p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-9 w-32 rounded-lg" />
            </Card>
          ))}
        </div>
      ) : forms.length === 0 ? (
        <Card className="bg-card border-dashed border-line p-12 text-center">
          <ClipboardList className="w-12 h-12 text-faint mx-auto mb-4" />
          <h3 className="text-lg font-bold text-fg mb-1">No forms yet</h3>
          <p className="text-muted text-sm max-w-md mx-auto mb-6">
            Build a simple questionnaire so new clients give you everything you need up front.
          </p>
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-accent hover:bg-accent-hi text-accent-fg"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Your First Intake Form
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {forms.map((form) => {
            const questionList = Array.isArray(form.questions) ? form.questions : [];
            const formToken = form.token || form.id;
            return (
              <Card
                key={form.id}
                className="bg-card border-line p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md hover:border-line-strong transition-all"
              >
                <div className="flex items-start sm:items-center gap-4">
                  <div className="p-3 rounded-xl bg-accent-soft text-info shrink-0">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-fg">{form.title}</h3>
                    {form.description && (
                      <p className="text-xs text-muted line-clamp-1 mb-1">{form.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted font-mono">
                      <span>{questionList.length} Questions</span>
                      <span>•</span>
                      <span>{form.submissions_count || 0} Submissions</span>
                      <span>•</span>
                      <span className="text-faint">Created {new Date(form.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenSubmissions(form)}
                    className="border-line bg-bg hover:bg-surface text-fg"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1 text-info dark:text-info" />
                    Submissions ({form.submissions_count || 0})
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(formToken, form.id)}
                    className="border-line bg-bg hover:bg-surface text-fg hover:text-fg"
                  >
                    {copiedId === form.id ? (
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-accent" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 mr-1 text-info" />
                    )}
                    {copiedId === form.id ? "Copied Link!" : "Copy Link"}
                  </Button>

                  <a
                    href={`/intake/${formToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center p-2 rounded-lg border border-line bg-bg hover:bg-surface text-muted hover:text-fg text-xs transition-colors"
                    title="Open Live Public Form"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteForm(form.id)}
                    className="text-faint hover:text-danger hover:bg-danger/10 p-2"
                    title="Delete Form"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Create Intake Form */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-2xl bg-bg border-line text-fg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-lg font-bold text-fg">New intake form</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-muted hover:text-fg text-sm">✕</button>
            </div>

          <form onSubmit={handleCreateForm} className="space-y-5 py-2">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-fg block mb-1">
                  Form Title <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Website Discovery & Scope Questionnaire"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-fg block mb-1">
                  Description / Welcome Message
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Please fill out this brief questionnaire so we can hit the ground running with your project scope."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Questions Builder */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-fg uppercase tracking-wider">
                  Questions ({questions.length})
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddQuestion}
                  className="text-xs border-accent/30 text-info hover:bg-accent-soft"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Question
                </Button>
              </div>

              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="p-3.5 rounded-xl bg-card border border-line space-y-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-faint font-bold">#{idx + 1}</span>
                      <input
                        type="text"
                        required
                        placeholder="Enter your question label..."
                        value={q.label}
                        onChange={(e) => handleQuestionChange(idx, "label", e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      {questions.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveQuestion(idx)}
                          className="text-faint hover:text-danger p-1 h-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted">Response Type:</span>
                        <select
                          value={q.type}
                          onChange={(e) => handleQuestionChange(idx, "type", e.target.value)}
                          className="px-2 py-1 rounded bg-bg border border-line text-fg text-xs focus:outline-none"
                        >
                          <option value="text">Short Text</option>
                          <option value="textarea">Long Text / Paragraph</option>
                          <option value="number">Number</option>
                        </select>
                      </div>

                      <label className="flex items-center gap-1.5 text-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => handleQuestionChange(idx, "required", e.target.checked)}
                          className="rounded bg-bg border-line-strong text-info focus:ring-0"
                        />
                        Required
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-line">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateModalOpen(false)}
                className="text-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold"
              >
                {creating ? "Saving..." : "Create form & get link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: View Submissions */}
      <Dialog open={viewSubmissionsOpen} onOpenChange={setViewSubmissionsOpen}>
        <DialogContent className="max-w-3xl bg-bg border-line text-fg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-info dark:text-info" />
              Client Submissions: {selectedForm?.title}
            </DialogTitle>
            <DialogDescription className="text-muted text-xs">
              Live responses submitted by clients through the public intake questionnaire link.
            </DialogDescription>
          </DialogHeader>

          {loadingSubmissions ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="p-8 text-center bg-card rounded-xl border border-line my-4">
              <FileText className="w-10 h-10 text-faint mx-auto mb-2" />
              <p className="text-fg font-semibold text-sm">No answers yet</p>
              <p className="text-faint text-xs mt-1">
                Share the form link with your client — their answers will show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {submissions.map((sub) => (
                <Card key={sub.id} className="bg-card border-line p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-fg">{sub.client_name || "Anonymous Client"}</h4>
                      <p className="text-xs text-info font-mono">{sub.client_email || "No email provided"}</p>
                    </div>
                    <span className="text-[11px] text-muted font-mono">
                      {new Date(sub.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {Object.entries(sub.answers || {}).map(([key, val]) => (
                      <div key={key} className="bg-bg p-2.5 rounded-lg border border-line">
                        <span className="text-muted font-semibold block mb-1">{key}:</span>
                        <span className="text-fg whitespace-pre-wrap">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewSubmissionsOpen(false)}
              className="border-line text-fg"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
