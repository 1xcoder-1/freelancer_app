"use client";

import { useState, useEffect } from "react";
import {
  ClipboardList,
  Plus,
  Copy,
  CheckCircle2,
  ExternalLink,
  Trash2,
  Eye,
  MessageSquare,
  Sparkles,
  HelpCircle,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

export default function IntakePage() {
  const [forms, setForms] = useState<IntakeForm[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchForms = async () => {
    try {
      const data = await getIntakeForms();
      setForms(data);
    } catch (err) {
      console.error("Failed to load intake forms:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

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
    if (!title.trim()) return;

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
    } catch (err) {
      console.error("Failed to create form:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteForm = async (id: string) => {
    if (!confirm("Are you sure you want to delete this intake form?")) return;
    try {
      await deleteIntakeForm(id);
      setForms((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error("Failed to delete form:", err);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-white">Client Intake & Onboarding Forms</h1>
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-mono text-xs">
              Live Database Connected
            </Badge>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Send interactive questionnaires to collect design inspiration, project requirements, and brand assets automatically.
          </p>
        </div>

        <Button
          onClick={() => setCreateModalOpen(true)}
          className="bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-cyan-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Intake Form
        </Button>
      </div>

      {/* Forms List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-slate-900/40 border-white/5 p-6 flex items-center justify-between">
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
        <Card className="bg-slate-900/30 border-dashed border-white/10 p-12 text-center">
          <ClipboardList className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">No Intake Forms Created Yet</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            Create your first client discovery questionnaire to streamline onboarding and collect project briefs.
          </p>
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
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
                className="bg-slate-900/40 border-white/10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md hover:border-white/20 transition-all"
              >
                <div className="flex items-start sm:items-center gap-4">
                  <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{form.title}</h3>
                    {form.description && (
                      <p className="text-xs text-slate-400 line-clamp-1 mb-1">{form.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                      <span>{questionList.length} Questions</span>
                      <span>•</span>
                      <span>{form.submissions_count || 0} Submissions</span>
                      <span>•</span>
                      <span className="text-slate-500">Created {new Date(form.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenSubmissions(form)}
                    className="border-white/10 bg-slate-950/60 hover:bg-white/5 text-slate-300"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                    Submissions ({form.submissions_count || 0})
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(formToken, form.id)}
                    className="border-white/10 bg-slate-950/60 hover:bg-white/5 text-slate-300 hover:text-white"
                  >
                    {copiedId === form.id ? (
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                    )}
                    {copiedId === form.id ? "Copied Link!" : "Copy Link"}
                  </Button>

                  <a
                    href={`/intake/${formToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center p-2 rounded-lg border border-white/10 bg-slate-950/60 hover:bg-white/10 text-slate-400 hover:text-white text-xs transition-colors"
                    title="Open Live Public Form"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteForm(form.id)}
                    className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 p-2"
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
        <DialogContent className="max-w-2xl bg-slate-950 border-white/10 text-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-cyan-400" />
              Build Client Intake Questionnaire
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Design the custom questions you want prospective or onboarding clients to answer.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateForm} className="space-y-5 py-2">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Form Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Website Discovery & Scope Questionnaire"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Description / Welcome Message
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Please fill out this brief questionnaire so we can hit the ground running with your project scope."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
            </div>

            {/* Questions Builder */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Questions ({questions.length})
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddQuestion}
                  className="text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Question
                </Button>
              </div>

              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-500 font-bold">#{idx + 1}</span>
                      <input
                        type="text"
                        required
                        placeholder="Enter your question label..."
                        value={q.label}
                        onChange={(e) => handleQuestionChange(idx, "label", e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
                      />
                      {questions.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveQuestion(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1 h-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Response Type:</span>
                        <select
                          value={q.type}
                          onChange={(e) => handleQuestionChange(idx, "type", e.target.value)}
                          className="px-2 py-1 rounded bg-slate-950 border border-white/10 text-white text-xs focus:outline-none"
                        >
                          <option value="text">Short Text</option>
                          <option value="textarea">Long Text / Paragraph</option>
                          <option value="number">Number</option>
                        </select>
                      </div>

                      <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => handleQuestionChange(idx, "required", e.target.checked)}
                          className="rounded bg-slate-950 border-white/20 text-cyan-500 focus:ring-0"
                        />
                        Required
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-white/10">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
              >
                {creating ? "Saving to Database..." : "Save & Generate Share Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: View Submissions */}
      <Dialog open={viewSubmissionsOpen} onOpenChange={setViewSubmissionsOpen}>
        <DialogContent className="max-w-3xl bg-slate-950 border-white/10 text-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              Client Submissions: {selectedForm?.title}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Live responses submitted by clients through the public intake questionnaire link.
            </DialogDescription>
          </DialogHeader>

          {loadingSubmissions ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-white/5 my-4">
              <FileText className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-300 font-semibold text-sm">No Client Submissions Yet</p>
              <p className="text-slate-500 text-xs mt-1">
                Share this questionnaire with clients using the public share link to collect live answers.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {submissions.map((sub) => (
                <Card key={sub.id} className="bg-slate-900/70 border-white/10 p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">{sub.client_name || "Anonymous Client"}</h4>
                      <p className="text-xs text-cyan-400 font-mono">{sub.client_email || "No email provided"}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(sub.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {Object.entries(sub.answers || {}).map(([key, val]) => (
                      <div key={key} className="bg-slate-950 p-2.5 rounded-lg border border-white/5">
                        <span className="text-slate-400 font-semibold block mb-1">{key}:</span>
                        <span className="text-slate-200 whitespace-pre-wrap">{String(val)}</span>
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
              className="border-white/10 text-slate-300"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
