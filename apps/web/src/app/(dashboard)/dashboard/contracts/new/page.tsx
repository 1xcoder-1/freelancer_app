"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  FileSignature,
  Send,
  Sparkles,
  Layers,
  User,
  Mail,
  ShieldCheck,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";
import { getProjects, getClients, createContract, type Project, type Client } from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { toast } from "sonner";
import { z } from "zod";
import { validateOrToast } from "@/lib/validation";

const contractSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(100, "Title is too long"),
  projectId: z.string().min(1, "Please select an associated project"),
  recipientName: z.string().trim().min(2, "Recipient name is required"),
  recipientEmail: z.string().trim().email("Please provide a valid recipient email"),
  content: z.string().trim().min(10, "Agreement content must be at least 10 characters"),
});

const TEMPLATES = [
  {
    name: "Master Services Agreement (MSA)",
    title: "Master Services Agreement (MSA)",
    content: `1. SCOPE OF SERVICES: Provider agrees to deliver software engineering and design services as outlined in associated project milestones.\n\n2. INTELLECTUAL PROPERTY: Upon receipt of full payment, all custom deliverables, source code, and design assets shall transfer to the Client.\n\n3. PAYMENT TERMS: Invoices are payable within 14 business days of issuance. Late payments incur a 1.5% monthly finance charge.\n\n4. CONFIDENTIALITY: Both parties agree to protect proprietary source code, credentials, and business insights.`,
  },
  {
    name: "Standard Statement of Work (SOW)",
    title: "Statement of Work — Deliverables & Milestones",
    content: `1. PROJECT OBJECTIVES: Deliver the approved MVP build, design systems, and cloud infrastructure deployment.\n\n2. REVISIONS & SIGN-OFF: Each milestone includes up to two rounds of review. Handover sign-off constitutes acceptance.\n\n3. TERMINATION: Either party may terminate with 14 days written notice; accrued milestone fees remain payable.`,
  },
  {
    name: "Retainer & Support Agreement",
    title: "Monthly Dedicated Engineering Retainer",
    content: `1. DEDICATED CAPACITY: Provider reserves agreed weekly sprint capacity for maintenance, feature iteration, and priority hotfixes.\n\n2. BILLING: Retainer fee is billed in advance on the 1st of each calendar month. Unused hours do not roll over.`,
  },
];

export default function NewContractPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [title, setTitle] = useState("Master Services Agreement (MSA)");
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [content, setContent] = useState(TEMPLATES[0].content);
  const [senderSignature, setSenderSignature] = useState("");
  // N2: how long the public sign link stays valid (server seeds expires_at).
  const [expireDays, setExpireDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  const { data: pageData } = useApiData<{ projects: Project[]; clients: Client[] }>(
    "contracts:form-data",
    async (token) => {
      const [pRes, cRes] = await Promise.all([
        getProjects(token).catch(() => []),
        getClients(token).catch(() => []),
      ]);
      return { projects: pRes, clients: cRes };
    }
  );

  const projects = pageData?.projects ?? [];
  const clients = pageData?.clients ?? [];

  const handleProjectSelect = (pId: string) => {
    setProjectId(pId);
    const selected = projects.find((p) => p.id === pId);
    if (selected) {
      if (selected.client_id) {
        setClientId(selected.client_id);
        const cl = clients.find((c) => c.id === selected.client_id);
        if (cl) {
          if (!recipientName) setRecipientName(cl.name);
          if (!recipientEmail && cl.email) setRecipientEmail(cl.email);
        }
      }
    }
  };

  const handleApplyTemplate = (tmpl: (typeof TEMPLATES)[0]) => {
    setTitle(tmpl.title);
    setContent(tmpl.content);
    toast.success(`Applied "${tmpl.name}" template`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !validateOrToast(contractSchema, {
        title,
        projectId,
        recipientName,
        recipientEmail,
        content,
      })
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const token = (await getToken()) || undefined;
      const created = await createContract(
        {
          project_id: projectId,
          client_id: clientId || undefined,
          title,
          content,
          recipient_name: recipientName,
          recipient_email: recipientEmail,
          sender_signature: senderSignature || undefined,
          expire_days: expireDays,
        },
        token
      );

      invalidateCache("contracts:data");
      invalidateCache("projects:data");
      toast.success("Contract created & public signing link generated!");
      router.push(`/dashboard/contracts/${created.id}`);
    } catch (err: any) {
      console.error("Error creating contract:", err);
      toast.error(err?.response?.data?.detail || "Could not create contract");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === projectId);
  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 no-scrollbar max-w-7xl mx-auto pb-16">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/contracts"
              className="inline-flex items-center text-xs font-semibold text-muted hover:text-fg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Contracts
            </Link>
            <span className="text-muted text-xs">•</span>
            <span className="text-xs text-accent font-semibold font-mono">Draft New</span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            Draft New Contract
          </h1>
          <p className="text-muted text-sm">
            Generate an agreement, configure legal terms, and send a client signature link.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/contracts">
            <Button variant="outline" className="border-line text-xs font-semibold h-9 rounded-xl">
              Cancel
            </Button>
          </Link>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-bold text-xs h-9 px-4 rounded-xl shadow-xs"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {submitting ? "Drafting..." : "Generate Agreement"}
          </Button>
        </div>
      </div>

      {/* 2-Column Grid: Form (7 cols) + Sticky Live Visual Card Preview (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Controls */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
          {/* Quick Templates */}
          <Card className="bg-card border-line p-5 rounded-2xl space-y-3">
            <span className="text-xs font-bold text-fg flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-accent" />
              Quick Templates
            </span>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => handleApplyTemplate(t)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-line bg-surface/50 hover:bg-accent-soft hover:text-accent hover:border-accent/40 transition-all text-fg"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </Card>

          {/* Project & Client Selector */}
          <Card className="bg-card border-line p-5 rounded-2xl space-y-4">
            <span className="text-xs font-bold text-fg">Link to Project & Client</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">Select Project *</label>
                <select
                  value={projectId}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                  className="w-full h-10 rounded-xl bg-surface border border-line px-3 text-xs text-fg focus:outline-none focus:border-accent"
                  required
                >
                  <option value="">-- Choose Project --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">Client (Auto-detected)</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full h-10 rounded-xl bg-surface border border-line px-3 text-xs text-fg focus:outline-none focus:border-accent"
                >
                  <option value="">-- Direct Engagement --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Agreement Title & Signer Details */}
          <Card className="bg-card border-line p-5 rounded-2xl space-y-4">
            <span className="text-xs font-bold text-fg">Signer & Document Details</span>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">Contract Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  placeholder="e.g. Master Services Agreement"
                  className="w-full h-10 px-3 rounded-xl bg-surface border border-line text-xs text-fg focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted">Recipient Full Name *</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3 top-3.5 text-muted" />
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientName(e.target.value)}
                      placeholder="Alex Taylor"
                      className="w-full pl-9 pr-3 h-10 rounded-xl bg-surface border border-line text-xs text-fg focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted">Recipient Email *</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-3.5 text-muted" />
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientEmail(e.target.value)}
                      placeholder="alex@acme.com"
                      className="w-full pl-9 pr-3 h-10 rounded-xl bg-surface border border-line text-xs text-fg focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">Your Sign-off / Authorized Sender</label>
                <input
                  type="text"
                  value={senderSignature}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSenderSignature(e.target.value)}
                  placeholder="e.g. John Doe (Lead Consultant)"
                  className="w-full h-10 px-3 rounded-xl bg-surface border border-line text-xs text-fg focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">Sign link valid for (days)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={expireDays}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setExpireDays(Math.max(1, Math.min(365, Number(e.target.value) || 30)))
                  }
                  className="w-full h-10 px-3 rounded-xl bg-surface border border-line text-xs text-fg focus:outline-none focus:border-accent"
                />
                <p className="text-[11px] text-muted">After this the link expires and the client must be sent a new copy.</p>
              </div>
            </div>
          </Card>

          {/* Agreement Body / Clauses */}
          <Card className="bg-card border-line p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-fg">Agreement Clauses & Legal Scope *</span>
              <span className="text-[11px] text-muted font-mono">{content.length} chars</span>
            </div>
            <textarea
              rows={12}
              value={content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
              placeholder="Paste or write the contract terms..."
              className="w-full p-3 rounded-xl bg-surface border border-line text-xs font-mono text-fg leading-relaxed resize-y focus:outline-none focus:border-accent"
              required
            />
          </Card>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent hover:bg-accent-hi text-accent-fg font-bold h-11 rounded-xl shadow-md text-sm"
          >
            <Send className="w-4 h-4 mr-2" />
            {submitting ? "Drafting..." : "Generate Agreement & Get E-Sign Link"}
          </Button>
        </form>

        {/* Right Column: Live Sticky Card Preview */}
        <div className="lg:col-span-5 sticky top-24 space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-fg">Live Preview Card</span>
            <span className="text-[11px] text-accent font-semibold font-mono">Real-time sync</span>
          </div>

          <CategoryVisualCard
            title={title || "Agreement Title"}
            currentCount="Draft"
            totalCount="Review"
            subtitle={
              recipientName
                ? `Signer: ${recipientName}`
                : selectedProject
                ? `Project: ${selectedProject.title}`
                : "Standard Agreement"
            }
            category="Draft Statements of Work"
            tags={
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-sky-500/15 text-sky-400 border-sky-500/25">
                  Sent / Awaiting
                </span>
                <span className="text-[11px] font-mono font-medium text-orange-400 bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/25">
                  {selectedProject?.title || "Project Attached"}
                </span>
              </div>
            }
          />

          <Card className="bg-card border-line p-4 rounded-2xl space-y-2.5 text-xs text-muted">
            <div className="flex items-center gap-2 text-fg font-semibold">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span>Real-time Audit Trail Guarantee</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              When the client opens this link, the system captures timestamps, client IP, and browser signature metadata into an immutable audit log.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
