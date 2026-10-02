"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Loader2,
  ChevronDown,
  AlertCircle,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { getClient, updateClient, type Client } from "@/lib/api";
import { invalidateCache } from "@/hooks/use-api-data";
import { z } from "zod";
import { toast } from "sonner";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";

const clientFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Client name must be at least 2 characters")
    .max(100, "Client name cannot exceed 100 characters"),
  companyName: z
    .string()
    .trim()
    .max(100, "Company name cannot exceed 100 characters")
    .optional(),
  email: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .email("Please enter a valid email address"),
  ]),
  phone: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .min(6, "Phone number must be at least 6 digits")
      .max(25, "Phone number cannot exceed 25 characters"),
  ]),
  website: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .refine(
        (val) => {
          if (!val) return true;
          const normalized =
            val.startsWith("http://") || val.startsWith("https://")
              ? val
              : `https://${val}`;
          try {
            new URL(normalized);
            return true;
          } catch {
            return false;
          }
        },
        { message: "Please enter a valid URL (e.g. company.com)" }
      ),
  ]),
  rateOrBudget: z.string().max(50, "Rate cannot exceed 50 characters").optional(),
});

const DEFAULT_CATEGORIES = [
  "Featured",
  "VIP & Enterprise",
  "Repeat Clients",
  "Active Retainers",
  "High Growth",
  "Strategy & Consulting",
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD ($)" },
  { value: "PKR", label: "PKR (₨)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "AED", label: "AED (د.إ)" },
  { value: "CAD", label: "CAD ($)" },
  { value: "AUD", label: "AUD ($)" },
];

const PAYMENT_TERMS = [
  { value: "50_advance_50_completion", label: "50% Advance / 50% on Completion" },
  { value: "100_advance", label: "100% Advance Payment" },
  { value: "30_advance_70_completion", label: "30% Advance / 70% on Completion" },
  { value: "on_completion", label: "100% on Project Completion" },
  { value: "net_7", label: "Net 7 Days" },
  { value: "net_15", label: "Net 15 Days" },
  { value: "net_30", label: "Net 30 Days" },
  { value: "monthly_advance", label: "Monthly Fixed (Advance)" },
];

const formatAmountWithCommas = (val: string): string => {
  if (!val) return "";
  const suffixMatch = val.match(/\s*(\/.*|[a-zA-Z]+)$/);
  const suffix = suffixMatch ? suffixMatch[0] : "";
  const numericOnly = suffixMatch ? val.slice(0, suffixMatch.index) : val;

  const clean = numericOnly.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!clean) return suffix.trim();

  const parts = clean.split(".");
  const intStr = parts[0];
  const formattedInt = intStr ? Number(intStr).toLocaleString("en-US") : "0";

  if (parts.length > 1) {
    const decStr = parts[1].slice(0, 2);
    return `${formattedInt}.${decStr}${suffix}`;
  }

  return `${formattedInt}${suffix}`;
};

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = String(params?.id || "");
  const { getToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form State
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [rateOrBudget, setRateOrBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [category, setCategory] = useState("Featured");
  const [customCategory, setCustomCategory] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("50_advance_50_completion");
  const [clientNotes, setClientNotes] = useState("");
  const [isVip, setIsVip] = useState(false);

  const effectiveCategory = customCategory.trim() || category || "Featured";

  // Load existing client data
  useEffect(() => {
    let mounted = true;

    async function loadClientData() {
      if (!clientId) return;
      try {
        const token = (await getToken()) || undefined;
        const c: Client = await getClient(clientId, token);

        if (!mounted || !c) return;

        setName(c.name || "");
        setCompanyName(c.company_name || "");
        setEmail(c.email || "");
        setPhone(c.phone || "");
        setWebsite(c.website || "");
        setIsVip(c.status === "vip");

        if (c.notes) {
          const raw = c.notes;

          const catMatch = raw.match(/\[category:\s*([^\]]+)\]/i);
          if (catMatch && catMatch[1]) {
            const val = catMatch[1].trim();
            if (DEFAULT_CATEGORIES.includes(val)) {
              setCategory(val);
              setCustomCategory("");
            } else if (val !== "[object Object]") {
              setCategory("Featured");
              setCustomCategory(val);
            }
          }

          const rateMatch = raw.match(/\[rate:\s*([A-Z]{3})?\s*([^\]]+)\]/i);
          if (rateMatch) {
            if (rateMatch[1] && rateMatch[1].trim() !== "[object Object]") setCurrency(rateMatch[1].trim());
            if (rateMatch[2] && rateMatch[2].trim() !== "[object Object]") {
              setRateOrBudget(formatAmountWithCommas(rateMatch[2].trim()));
            }
          }

          const termsMatch = raw.match(/\[terms:\s*([^\]]+)\]/i);
          if (termsMatch && termsMatch[1] && termsMatch[1].trim() !== "[object Object]") {
            setPaymentTerms(termsMatch[1].trim());
          }

          let cleanNotes = raw
            .replace(/\[category:\s*[^\]]+\]/gi, "")
            .replace(/\[role:\s*[^\]]+\]/gi, "")
            .replace(/\[vip:\s*[^\]]+\]/gi, "")
            .replace(/\[channel:\s*[^\]]+\]/gi, "")
            .replace(/\[rate:\s*[^\]]+\]/gi, "")
            .replace(/\[terms:\s*[^\]]+\]/gi, "")
            .replace(/\[address:\s*[^\]]+\]/gi, "")
            .replace(/\[object Object\]/gi, "")
            .trim();
          setClientNotes(cleanNotes);
        }
      } catch (err) {
        console.error("Error loading client:", err);
        toast.error("Failed to load client details");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadClientData();

    return () => {
      mounted = false;
    };
  }, [clientId, getToken]);

  const handleToggleVip = () => {
    const nextVip = !isVip;
    setIsVip(nextVip);
    if (nextVip) {
      setCategory("VIP & Enterprise");
      setCustomCategory("");
    } else if (category === "VIP & Enterprise" && !customCategory) {
      setCategory("Featured");
    }
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAmountWithCommas(e.target.value);
    setRateOrBudget(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = clientFormSchema.safeParse({
      name,
      companyName,
      email,
      phone,
      website,
      rateOrBudget,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[String(err.path[0])] = err.message;
        }
      });
      setErrors(fieldErrors);
      toast.error(result.error.issues[0]?.message || "Please check required fields");
      return;
    }

    setSaving(true);
    const chosenCategory = customCategory.trim() || category;

    const meta: string[] = [];
    meta.push(`[category: ${chosenCategory}]`);
    if (isVip) meta.push(`[vip: true]`);
    if (rateOrBudget.trim()) meta.push(`[rate: ${currency} ${rateOrBudget.trim()}]`);
    if (paymentTerms) meta.push(`[terms: ${paymentTerms}]`);

    let finalNotes = meta.join("\n");
    if (clientNotes.trim()) {
      finalNotes += `\n\n${clientNotes.trim()}`;
    }

    try {
      const token = (await getToken()) || undefined;
      await updateClient(
        clientId,
        {
          name: name.trim(),
          company_name: companyName.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          website: website.trim() || undefined,
          notes: finalNotes,
          status: isVip ? "vip" : "active",
        },
        token
      );

      invalidateCache("clients:data");
      invalidateCache("dashboard:data");
      invalidateCache("invoices:data");

      toast.success("Client updated successfully");
      router.push(`/dashboard/clients/${clientId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update client");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-7 h-7 animate-spin text-accent" />
        <p className="text-xs text-muted font-medium">Loading client details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 pt-2 px-3 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <Link
            href={`/dashboard/clients/${clientId}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Client</span>
          </Link>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            Edit Client Profile
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/dashboard/clients/${clientId}`)}
            disabled={saving}
            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg border border-line bg-card hover:bg-surface text-fg font-medium text-xs sm:text-sm transition-all duration-150 cursor-pointer disabled:opacity-50 h-9"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="edit-client-form"
            disabled={saving || !name.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hi text-accent-fg font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:pointer-events-none h-9"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </Button>
        </div>
      </div>

      {/* Main Form Layout */}
      <form id="edit-client-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Fields (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Contact Information */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-fg">
                Client & Business Info
              </h2>
              <button
                type="button"
                onClick={handleToggleVip}
                className={`text-xs px-2.5 py-1 rounded-xl border flex items-center gap-1.5 font-medium transition-all cursor-pointer ${isVip
                  ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                  : "bg-surface/50 text-muted border-line hover:text-fg"
                  }`}
              >
                <Crown className="w-3 h-3" />
                {isVip ? "VIP Client" : "Mark as VIP"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Client Name <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                  }}
                  placeholder="e.g. Alex Henderson"
                  className={`w-full h-10 px-3.5 rounded-xl border bg-surface/50 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all ${errors.name ? "border-danger" : "border-line"
                    }`}
                />
                {errors.name && (
                  <p className="text-[11px] text-danger flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Company / Organization
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Labs"
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  placeholder="alex@company.com"
                  className={`w-full h-10 px-3.5 rounded-xl border bg-surface/50 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all ${errors.email ? "border-danger" : "border-line"
                    }`}
                />
                {errors.email && (
                  <p className="text-[11px] text-danger flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Phone / WhatsApp
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Website URL (Optional)
                </label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://company.com"
                  className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all"
                />
              </div>
            </div>
          </Card>

          {/* 2. Billing & Category */}
          <Card className="p-5 sm:p-6 rounded-2xl border border-line bg-card space-y-5 shadow-xs">
            <div className="flex items-center justify-between pb-1 border-b border-line/50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <h2 className="text-sm font-medium text-fg">
                  Billing
                </h2>
              </div>
              <span className="text-[11px] font-mono text-muted  tracking-wider">Ts</span>
            </div>

            {/* Category Pills */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-fg">
                  Client Category
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                {DEFAULT_CATEGORIES.map((c) => {
                  const active = category === c && !customCategory;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCategory(c);
                        setCustomCategory("");
                      }}
                      className={`text-xs px-3.5 py-1.5 rounded-xl border font-medium transition-all cursor-pointer ${active
                        ? "bg-accent text-accent-fg border-accent shadow-xs"
                        : "bg-surface/60 text-muted border-line hover:border-line-strong hover:text-fg"
                        }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Or enter custom category name..."
                className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/60 text-fg text-xs placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all mt-1"
              />
            </div>

            {/* Billing Rate & Payment Terms */}
            <div className="space-y-4 pt-3 border-t border-line/60">
              {/* Rate Row */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-fg">
                    Billing Rate
                  </label>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-32 sm:w-36 shrink-0">
                    <CustomSelect
                      value={currency}
                      onChange={setCurrency}
                      options={CURRENCY_OPTIONS}
                    />
                  </div>
                  <input
                    type="text"
                    value={rateOrBudget}
                    onChange={handleRateChange}
                    placeholder="5,000 / mo"
                    className="flex-1 min-w-0 w-full h-11 px-4 rounded-xl border border-line bg-surface/60 text-fg text-sm font-mono focus:border-accent focus:bg-card focus:outline-none transition-all placeholder:text-muted/50"
                  />
                </div>
              </div>

              {/* Terms Row (Full Width - no truncated text) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-fg">
                    Payment Terms
                  </label>
                </div>
                <CustomSelect
                  value={paymentTerms}
                  onChange={setPaymentTerms}
                  options={PAYMENT_TERMS}
                />
              </div>
            </div>
          </Card>


          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <h2 className="text-sm font-medium text-fg">
              Notes & Instructions
            </h2>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <textarea
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  rows={7}
                  placeholder="Client preferences, key contacts, or milestone agreements..."
                  className="w-full p-3 rounded-xl border border-line bg-surface/50 text-fg no-scrollbar scrollbar-none placeholder:text-muted/60 text-xs sm:text-sm focus:border-accent focus:bg-card focus:outline-none transition-all resize-y"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Clean Sticky Card Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-6">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted">Card Preview</span>
            <span className="text-[11px] font-mono text-muted">{effectiveCategory}</span>
          </div>

          <CategoryVisualCard
            title={name.trim() || "Client Name"}
            subtitle={companyName.trim() || "Direct Client"}
            category={effectiveCategory}
            topRightContent={
              isVip ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/15 to-yellow-500/15 dark:from-amber-500/20 dark:to-yellow-500/20 border border-amber-500/30 dark:border-amber-500/35 text-amber-700 dark:text-amber-300 text-xs font-semibold shadow-sm tracking-wide">
                  <span className="text-amber-600 dark:text-amber-400 text-sm">★</span>
                  <span className="font-display font-bold tracking-wider text-[11px]">VIP</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/10 dark:bg-white/5 border border-slate-200/90 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-medium shadow-2xs tracking-wide">
                  <span className="text-slate-400 dark:text-slate-500 text-[10px]">✦</span>
                  <span className="font-medium text-[11px] tracking-wide">Standard</span>
                </div>
              )
            }
            tags={
              <div className="flex flex-wrap items-center gap-1.5">
                {rateOrBudget && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-orange-500/10 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/20 dark:border-orange-500/25 font-mono">
                    {currency} {formatAmountWithCommas(rateOrBudget)}
                  </span>
                )}
              </div>
            }
          />
        </div>
      </form>
    </div>
  );
}
