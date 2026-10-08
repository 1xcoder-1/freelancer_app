"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import {
  ArrowLeft,
  Send,
  Clock,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategoryVisualCard } from "@/components/dashboard/CategoryVisualCard";
import {
  getClients,
  createInvoice,
  getUnbilledTimeEntries,
  type Client,
  type UnbilledTimeEntry,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { toast } from "sonner";
import { z } from "zod";
import { validateOrToast } from "@/lib/validation";

const invoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1, "Invoice number is required"),
  clientId: z.string().min(1, "Please choose a client"),
  itemDesc: z.string().trim().min(1, "Item description is required"),
  itemQty: z.number().positive("Quantity must be greater than 0"),
  itemRate: z.number().min(0, "Unit price cannot be negative"),
});

const newInvoiceNumber = () =>
  `INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

export default function NewInvoicePage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [clientId, setClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(newInvoiceNumber);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("Payment due within 14 days of invoice issue date. Thank you for your business!");
  const [itemDesc, setItemDesc] = useState("Web App Design & Development Services");
  const [itemQty, setItemQty] = useState(1);
  const [itemRate, setItemRate] = useState(1500);
  const [selectedTimeIds, setSelectedTimeIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Unsaved-changes guard — an accidental click away asks before the drafted
  // invoice is lost, and the autosaved draft can be restored on return.
  const formValues = useMemo(
    () => ({
      clientId,
      invoiceNumber,
      dueDate,
      notes,
      itemDesc,
      itemQty: String(itemQty),
      itemRate: String(itemRate),
      selectedTimeIds: selectedTimeIds.join(","),
    }),
    [clientId, invoiceNumber, dueDate, notes, itemDesc, itemQty, itemRate, selectedTimeIds]
  );

  const applyDraft = useCallback((draft: Record<string, unknown>) => {
    const s = (v: unknown) => (v == null ? null : String(v));
    if (s(draft.clientId) != null) setClientId(s(draft.clientId)!);
    if (s(draft.invoiceNumber) != null) setInvoiceNumber(s(draft.invoiceNumber)!);
    if (s(draft.dueDate) != null) setDueDate(s(draft.dueDate)!);
    if (s(draft.notes) != null) setNotes(s(draft.notes)!);
    if (s(draft.itemDesc) != null) setItemDesc(s(draft.itemDesc)!);
    const qty = Number(s(draft.itemQty));
    if (Number.isFinite(qty) && qty > 0) setItemQty(qty);
    const rate = Number(s(draft.itemRate));
    if (Number.isFinite(rate) && rate >= 0) setItemRate(rate);
    if (s(draft.selectedTimeIds) != null) {
      setSelectedTimeIds(s(draft.selectedTimeIds)!.split(",").filter(Boolean));
    }
  }, []);

  const guard = useUnsavedChangesGuard({
    values: formValues,
    draftKey: "invoice-new",
    onRestoreDraft: applyDraft,
  });

  const { data: pageData } = useApiData<{ clients: Client[]; unbilled: UnbilledTimeEntry[] }>(
    "invoices:form-data",
    async (token) => {
      const [cRes, uRes] = await Promise.all([
        getClients(token).catch(() => []),
        getUnbilledTimeEntries(token).catch(() => []),
      ]);
      return { clients: cRes, unbilled: uRes };
    }
  );

  const clients = pageData?.clients ?? [];
  const unbilledTime = pageData?.unbilled ?? [];

  const handleToggleTimeEntry = (entry: UnbilledTimeEntry) => {
    setSelectedTimeIds((prev) =>
      prev.includes(entry.id) ? prev.filter((id) => id !== entry.id) : [...prev, entry.id]
    );
  };

  const selectedUnbilledTotal = unbilledTime
    .filter((e) => selectedTimeIds.includes(e.id))
    .reduce((sum, e) => sum + e.amount, 0);

  const totalAmount = itemQty * itemRate + selectedUnbilledTotal;
  const selectedClient = clients.find((c) => c.id === clientId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !validateOrToast(invoiceSchema, {
        invoiceNumber,
        clientId,
        itemDesc,
        itemQty,
        itemRate,
      })
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const token = (await getToken()) || undefined;

      const items = [
        {
          description: itemDesc,
          quantity: itemQty,
          unit_price: itemRate,
        },
        ...unbilledTime
          .filter((e) => selectedTimeIds.includes(e.id))
          .map((e) => ({
            description: `${e.project_title}: ${e.description || "Logged Time"} (${e.hours}h @ $${e.hourly_rate}/h)`,
            quantity: e.hours,
            unit_price: e.hourly_rate,
          })),
      ];

      const created = await createInvoice(
        {
          client_id: clientId,
          invoice_number: invoiceNumber,
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
          status: "sent",
          notes,
          items,
          time_entry_ids: selectedTimeIds.length > 0 ? selectedTimeIds : undefined,
        },
        token
      );

      invalidateCache("invoices:data");
      invalidateCache("projects:data");
      guard.markSaved();
      toast.success("Invoice created & sent to client!");
      router.push(`/dashboard/invoices/${created.id}`);
    } catch (err: any) {
      console.error("Error creating invoice:", err);
      toast.error(err?.response?.data?.detail || "Could not create invoice");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 no-scrollbar max-w-7xl mx-auto pb-16">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/invoices"
              className="inline-flex items-center text-xs font-semibold text-muted hover:text-fg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Invoices & Billing
            </Link>
            <span className="text-muted text-xs">•</span>
            <span className="text-xs text-accent font-semibold font-mono">Create New</span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">
            Issue New Invoice
          </h1>
          <p className="text-muted text-sm">
            Bill for project deliverables or pull unbilled logged hours directly into line items.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => guard.guardedPush("/dashboard/invoices")}
            className="border-line text-xs font-semibold h-9 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-bold text-xs h-9 px-4 rounded-xl shadow-xs"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {submitting ? "Creating..." : "Send Invoice"}
          </Button>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Controls */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
          {/* Client & Invoice Meta */}
          <Card className="bg-card border-line p-5 rounded-2xl space-y-4">
            <span className="text-xs font-bold text-fg">Invoice Details & Recipient</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">Select Client *</label>
                <select
                  value={clientId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClientId(e.target.value)}
                  className="w-full h-10 rounded-xl bg-surface border border-line px-3 text-xs text-fg focus:outline-none focus:border-accent"
                  required
                >
                  <option value="">-- Choose Client --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">Invoice Number *</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInvoiceNumber(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface border border-line text-xs font-mono text-fg focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">Payment Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDueDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface border border-line text-xs text-fg focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </Card>

          {/* Primary Line Item */}
          <Card className="bg-card border-line p-5 rounded-2xl space-y-4">
            <span className="text-xs font-bold text-fg">Primary Deliverable / Service Line Item</span>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">Service Description *</label>
                <input
                  type="text"
                  value={itemDesc}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemDesc(e.target.value)}
                  placeholder="e.g. Design System & Frontend Architecture"
                  className="w-full h-10 px-3 rounded-xl bg-surface border border-line text-xs text-fg focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted">Quantity / Units *</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={itemQty}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemQty(parseFloat(e.target.value) || 1)}
                    className="w-full h-10 px-3 rounded-xl bg-surface border border-line text-xs font-mono text-fg focus:outline-none focus:border-accent"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted">Rate / Price ($) *</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={itemRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemRate(parseFloat(e.target.value) || 0)}
                    className="w-full h-10 px-3 rounded-xl bg-surface border border-line text-xs font-mono text-fg focus:outline-none focus:border-accent"
                    required
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Unbilled Tracked Time Sync */}
          {unbilledTime.length > 0 && (
            <Card className="bg-card border-line p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" />
                  <span className="text-xs font-bold text-fg">Import Unbilled Logged Hours</span>
                </div>
                <span className="text-xs text-accent font-mono font-semibold">
                  {selectedTimeIds.length} selected (${selectedUnbilledTotal.toLocaleString()})
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {unbilledTime.map((entry) => {
                  const isChecked = selectedTimeIds.includes(entry.id);
                  return (
                    <label
                      key={entry.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${isChecked
                        ? "bg-accent-soft border-accent/40 text-fg"
                        : "bg-surface/40 border-line text-muted hover:text-fg"
                        }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleTimeEntry(entry)}
                          className="rounded border-line text-accent focus:ring-accent"
                        />
                        <div>
                          <p className="font-semibold text-fg">{entry.project_title}</p>
                          <p className="text-[11px] text-muted">{entry.description || "Logged Work"}</p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-accent">
                        {entry.hours}h (${entry.amount})
                      </span>
                    </label>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Notes & Terms */}
          <Card className="bg-card border-line p-5 rounded-2xl space-y-3">
            <span className="text-xs font-bold text-fg">Payment Terms & Client Note</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              className="w-full p-3 rounded-xl bg-surface border border-line text-xs text-fg resize-none focus:outline-none focus:border-accent"
            />
          </Card>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent hover:bg-accent-hi text-accent-fg font-bold h-11 rounded-xl shadow-md text-sm"
          >
            <Send className="w-4 h-4 mr-2" />
            {submitting ? "Creating..." : `Create & Send Invoice ($${totalAmount.toLocaleString()})`}
          </Button>
        </form>

        {/* Right Column: Live Sticky Card Preview */}
        <div className="lg:col-span-5 sticky top-24 space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-fg">Live Invoice Summary</span>
            <span className="text-[11px] text-accent font-semibold font-mono">
              ${totalAmount.toLocaleString()} Total
            </span>
          </div>

          <CategoryVisualCard
            title={invoiceNumber || "INV-001"}
            currentCount={`$${totalAmount.toLocaleString()}`}
            totalCount="Due"
            subtitle={selectedClient ? `Client: ${selectedClient.name}` : "Direct Invoice"}
            category="Invoices & Billing"
            tags={
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border bg-sky-500/15 text-sky-400 border-sky-500/25">
                  Sent
                </span>
                <span className="text-[11px] font-mono font-medium text-orange-400 bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-500/25">
                  {selectedClient?.name || "Direct Client"}
                </span>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
