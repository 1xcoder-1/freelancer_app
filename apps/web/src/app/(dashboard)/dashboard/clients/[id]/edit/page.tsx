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
  roleTitle: z
    .string()
    .trim()
    .max(100, "Role title cannot exceed 100 characters")
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
  billingAddress: z.string().max(300, "Billing address cannot exceed 300 characters").optional(),
});

const DEFAULT_CATEGORIES = [
  "Featured",
  "VIP & Enterprise",
  "Active Retainers",
  "High Growth",
  "Strategy & Consulting",
];

const PAYMENT_TERMS = [
  { value: "50_advance_50_completion", label: "50% Advance / 50% on Completion" },
  { value: "100_advance", label: "100% Advance Payment" },
  { value: "30_advance_70_completion", label: "30% Advance / 70% on Completion" },
  { value: "on_completion", label: "100% on Project Completion" },
  { value: "net_7", label: "Net 7 Days" },
  { value: "net_15", label: "Net 15 Days" },
  { value: "net_30", label: "Net 30 Days" },
  { value: "monthly_advance", label: "Monthly Retainer (Advance)" },
];

const CHANNELS = ["Email", "Slack Connect", "WhatsApp", "Discord", "Telegram", "Phone"];

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
  const [roleTitle, setRoleTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [rateOrBudget, setRateOrBudget] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [category, setCategory] = useState("Featured");
  const [customCategory, setCustomCategory] = useState("");
  const [preferredChannel, setPreferredChannel] = useState("Email");
  const [paymentTerms, setPaymentTerms] = useState("50_advance_50_completion");
  const [billingAddress, setBillingAddress] = useState("");
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

          const roleMatch = raw.match(/\[role:\s*([^\]]+)\]/i);
          if (roleMatch && roleMatch[1] && roleMatch[1].trim() !== "[object Object]") {
            setRoleTitle(roleMatch[1].trim());
          }

          const chanMatch = raw.match(/\[channel:\s*([^\]]+)\]/i);
          if (chanMatch && chanMatch[1] && chanMatch[1].trim() !== "[object Object]") {
            setPreferredChannel(chanMatch[1].trim());
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

          const addrMatch = raw.match(/\[address:\s*([^\]]+)\]/i);
          if (addrMatch && addrMatch[1] && addrMatch[1].trim() !== "[object Object]") {
            setBillingAddress(addrMatch[1].trim());
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
      roleTitle,
      email,
      phone,
      website,
      rateOrBudget,
      billingAddress,
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
    if (roleTitle.trim()) meta.push(`[role: ${roleTitle.trim()}]`);
    if (isVip) meta.push(`[vip: true]`);
    if (preferredChannel) meta.push(`[channel: ${preferredChannel}]`);
    if (rateOrBudget.trim()) meta.push(`[rate: ${currency} ${rateOrBudget.trim()}]`);
    if (paymentTerms) meta.push(`[terms: ${paymentTerms}]`);
    if (billingAddress.trim()) meta.push(`[address: ${billingAddress.trim()}]`);

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
          <h1 className="text-xl sm:text-2xl font-medium tracking-wide text-fg">
            Edit Client Profile
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/dashboard/clients/${clientId}`)}
            disabled={saving}
            className="text-xs rounded-xl h-9 px-4 border-line"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="edit-client-form"
            disabled={saving || !name.trim()}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-medium text-xs rounded-xl h-9 px-5 shadow-xs"
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
                onClick={() => setIsVip(!isVip)}
                className={`text-xs px-2.5 py-1 rounded-xl border flex items-center gap-1.5 font-medium transition-all ${
                  isVip
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
                  className={`w-full h-10 px-3.5 rounded-xl border bg-surface/50 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all ${
                    errors.name ? "border-danger" : "border-line"
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
                  Role / Job Title
                </label>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="e.g. Founder, Product Lead"
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
                  className={`w-full h-10 px-3.5 rounded-xl border bg-surface/50 text-fg text-sm placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all ${
                    errors.email ? "border-danger" : "border-line"
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

              <div className="sm:col-span-2 space-y-1.5">
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
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-5">
            <h2 className="text-sm font-medium text-fg">
              Billing & Category
            </h2>

            {/* Category Pills */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-fg block">
                Client Roster Category
              </label>
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
                      className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all ${
                        active
                          ? "bg-accent text-accent-fg border-accent shadow-xs"
                          : "bg-surface/50 text-muted border-line hover:border-accent/40 hover:text-fg"
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
                className="w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-xs placeholder:text-muted/60 focus:border-accent focus:bg-card focus:outline-none transition-all mt-2"
              />
            </div>

            {/* Billing Rate, Terms, Channel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-line/60">
              <div className="space-y-1.5 min-w-0">
                <label className="text-xs font-medium text-fg block">
                  Billing Rate / Retainer
                </label>
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="text"
                    value={rateOrBudget}
                    onChange={handleRateChange}
                    placeholder="5,000 / mo"
                    className="flex-1 min-w-0 w-full h-10 px-3.5 rounded-xl border border-line bg-surface/50 text-fg text-sm font-mono focus:border-accent focus:bg-card focus:outline-none transition-all"
                  />
                  <div className="relative w-24 sm:w-28 shrink-0">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full h-10 appearance-none px-2.5 sm:px-3 pr-7 rounded-xl border border-line bg-surface/50 text-fg text-xs font-medium focus:border-accent focus:bg-card focus:outline-none cursor-pointer transition-all"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="PKR">PKR (₨)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="AED">AED (د.إ)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="AUD">AUD ($)</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-muted pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 min-w-0">
                <label className="text-xs font-medium text-fg block">
                  Payment Terms
                </label>
                <div className="relative w-full">
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full h-10 appearance-none px-3.5 pr-8 rounded-xl border border-line bg-surface/50 text-fg text-xs font-medium focus:border-accent focus:bg-card focus:outline-none cursor-pointer transition-all"
                  >
                    {PAYMENT_TERMS.map((term) => (
                      <option key={term.value} value={term.value}>{term.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-fg block">
                  Preferred Communication Channel
                </label>
                <div className="relative">
                  <select
                    value={preferredChannel}
                    onChange={(e) => setPreferredChannel(e.target.value)}
                    className="w-full h-10 appearance-none px-3.5 pr-8 rounded-xl border border-line bg-surface/50 text-fg text-xs font-medium focus:border-accent focus:bg-card focus:outline-none cursor-pointer transition-all"
                  >
                    {CHANNELS.map((ch) => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </Card>

          {/* 3. Billing Address & Notes */}
          <Card className="p-5 sm:p-6 rounded-2xl border-line bg-card space-y-4">
            <h2 className="text-sm font-medium text-fg">
              Address & Notes (Optional)
            </h2>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Billing Address / Tax Info
                </label>
                <textarea
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  rows={2}
                  placeholder="Street address, Tax/VAT ID, postal code..."
                  className="w-full p-3 rounded-xl border border-line bg-surface/50 text-fg placeholder:text-muted/60 text-xs sm:text-sm focus:border-accent focus:bg-card focus:outline-none transition-all resize-y"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg block">
                  Internal Notes & Instructions
                </label>
                <textarea
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  rows={3}
                  placeholder="Client preferences, key contacts, or milestone agreements..."
                  className="w-full p-3 rounded-xl border border-line bg-surface/50 text-fg placeholder:text-muted/60 text-xs sm:text-sm focus:border-accent focus:bg-card focus:outline-none transition-all resize-y"
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
            subtitle={companyName.trim() || roleTitle || "Direct Client"}
            currentCount={isVip ? "★" : "1"}
            totalCount={isVip ? "VIP" : "10"}
            category={effectiveCategory}
            tags={
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/10 text-zinc-200 border border-white/10 capitalize">
                  {isVip ? "VIP" : "Active"}
                </span>
                {rateOrBudget && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-orange-500/15 text-white border border-orange-500/25 font-mono">
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
