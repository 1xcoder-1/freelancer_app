"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  ClipboardList,
  CheckCircle2,
  Send,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicIntakeForm, submitPublicIntakeForm, PublicIntakeForm } from "@/lib/api";

export default function PublicIntakePage() {
  const params = useParams();
  const token = params?.token as string;

  const [form, setForm] = useState<PublicIntakeForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submission inputs
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    const fetchForm = async () => {
      try {
        const data = await getPublicIntakeForm(token);
        setForm(data);
      } catch (err: unknown) {
        const message = (err as Error)?.message || "Unable to load intake questionnaire.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    fetchForm();
  }, [token]);

  const handleAnswerChange = (label: string, value: unknown) => {
    setAnswers((prev) => ({
      ...prev,
      [label]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientEmail.trim()) return;

    setSubmitting(true);
    try {
      await submitPublicIntakeForm(token, {
        client_name: clientName,
        client_email: clientEmail,
        answers: answers,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const message = (err as Error)?.message || "Failed to submit questionnaire.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Card className="w-full max-w-xl bg-card border-line p-8 space-y-6">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <div className="space-y-4 pt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4 text-fg">
        <Card className="w-full max-w-md bg-card border-line p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-danger mx-auto" />
          <h2 className="text-xl font-bold">Questionnaire Not Found</h2>
          <p className="text-sm text-muted">
            {error || "This questionnaire link is invalid, expired, or has been removed."}
          </p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4 text-fg">
        <Card className="w-full max-w-lg bg-card border-line p-8 text-center space-y-5 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-xl bg-accent-soft text-accent flex items-center justify-center mx-auto border border-accent">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-fg">Thank You, {clientName}!</h2>
            <p className="text-sm text-fg mt-2">
              Your questionnaire responses have been received successfully and synced with the project team.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-bg border border-line text-xs text-muted text-left space-y-1">
            <div className="flex items-center gap-1.5 text-info font-semibold mb-1">
              <ShieldCheck className="w-4 h-4" /> Next Steps
            </div>
            <p>• We will review your answers and project scope.</p>
            <p>• A tailored proposal or project kickoff update will be delivered to <span className="text-fg font-mono">{clientEmail}</span>.</p>
          </div>
        </Card>
      </div>
    );
  }

  const questionsList = Array.isArray(form.questions) ? form.questions : [];

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col justify-between p-4 sm:p-8">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 pt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-soft border border-accent/20 text-info text-xs font-mono mb-2">
            <ClipboardList className="w-3.5 h-3.5" /> Client Project Intake
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
            {form.title}
          </h1>
          {form.description && (
            <p className="text-muted text-sm max-w-lg mx-auto leading-relaxed">
              {form.description}
            </p>
          )}
        </div>

        {/* Form Container */}
        <Card className="bg-card border-line shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 pt-6">
              {/* Client Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-line">
                <div>
                  <label className="text-xs font-semibold text-fg block mb-1">
                    Your Full Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Connor"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg block mb-1">
                    Email Address <span className="text-danger">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="sconnor@company.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Dynamic Questions */}
              <div className="space-y-5">
                {questionsList.map((q: { id?: string; label?: string; type?: string; required?: boolean }, idx: number) => {
                  const label = q.label || `Question ${idx + 1}`;
                  const isRequired = q.required;

                  return (
                    <div key={q.id || idx} className="space-y-1.5">
                      <label className="text-xs font-semibold text-fg block">
                        {idx + 1}. {label} {isRequired && <span className="text-danger">*</span>}
                      </label>

                      {q.type === "textarea" ? (
                        <textarea
                          rows={3}
                          required={isRequired}
                          placeholder="Type your response here..."
                          value={(answers[label] as string) || ""}
                          onChange={(e) => handleAnswerChange(label, e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      ) : q.type === "number" ? (
                        <input
                          type="number"
                          required={isRequired}
                          placeholder="0"
                          value={(answers[label] as string | number) ?? ""}
                          onChange={(e) => handleAnswerChange(label, e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      ) : (
                        <input
                          type="text"
                          required={isRequired}
                          placeholder="Type your answer..."
                          value={(answers[label] as string) || ""}
                          onChange={(e) => handleAnswerChange(label, e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>

            <CardFooter className="pt-4 pb-6 border-t border-line flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-faint">
                <ShieldCheck className="w-4 h-4 text-accent" />
                Encrypted & Secure Submission
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold px-6 shadow-sm"
              >
                {submitting ? (
                  "Submitting..."
                ) : (
                  <>
                    Submit Questionnaire <Send className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <div className="text-center py-6 text-xs text-faint">
        Powered by <span className="text-fg font-semibold">Freelancer OS</span>
      </div>
    </div>
  );
}
