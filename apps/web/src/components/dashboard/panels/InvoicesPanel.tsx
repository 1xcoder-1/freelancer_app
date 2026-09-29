"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Receipt,
  Plus,
  CheckCircle2,
  Send,
  Trash2,
  Copy,
  Search,
  RefreshCw,
  FileText,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SubTabs, type SubTab } from "@/components/dashboard/SubTabs";
import {
  getInvoices,
  createInvoice,
  getClients,
  getWorkspaceSettings,
  getUnbilledTimeEntries,
  updateInvoiceStatus,
  deleteInvoice,
  type Invoice,
  type Client,
  type UnbilledTimeEntry,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { z } from "zod";
import { validateOrToast } from "../../../lib/validation";

const invoiceSchema = z.object({
  invoiceNumber: z
    .string()
    .trim()
    .min(1, "Invoice number is required")
    .max(50, "Invoice number must be 50 characters or fewer"),
  clientId: z.string().min(1, "Please add or select a client first"),
  itemDesc: z
    .string()
    .trim()
    .min(1, "Describe what you're billing for")
    .max(200, "Description must be 200 characters or fewer"),
  itemQty: z
    .number({ message: "Quantity must be a number" })
    .positive("Quantity must be greater than 0")
    .max(10000, "Quantity looks too large"),
  itemRate: z
    .number({ message: "Unit price must be a number" })
    .min(0, "Unit price cannot be negative")
    .max(10000000, "Unit price looks too large"),
  dueDate: z
    .string()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Pick a valid due date"),
});

const newInvoiceNumber = () => `INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

type SubTabValue = "new" | "unpaid" | "paid";

/**
 * Invoices split into three tiny pages: make one, chase the unpaid ones,
 * look at the paid history. Filter chips + search keep the lists short.
 */
export function InvoicesPanel() {
  const { getToken } = useAuth();
  const [subTab, setSubTab] = useState<SubTabValue>("new");
  const [filter, setFilter] = useState<"all" | "draft" | "sent" | "overdue">("all");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Create-form state (inline page, no modal)
  const [clientId, setClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(newInvoiceNumber);
  const [itemDesc, setItemDesc] = useState("Web App Design & Development");
  const [itemQty, setItemQty] = useState(1);
  const [itemRate, setItemRate] = useState(1200);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  // Tracked-time entries ticked into this invoice as extra line items.
  const [selectedTimeIds, setSelectedTimeIds] = useState<string[]>([]);

  const { data: pageData, loading, refresh: loadData } = useApiData(
    "invoices:data",
    async (token) => {
      const [invRes, clientRes] = await Promise.all([
        getInvoices(token).catch(() => []),
        getClients(token).catch(() => []),
      ]);
      return { invoices: invRes, clients: clientRes };
    },
    {
      reportContext: "invoices",
      pollMs: 15_000,
      onSuccess: (data) => {
        if (data.clients.length > 0) {
          setClientId((prev) => prev || data.clients[0].id);
        }
      },
    }
  );

  // Workspace currency for labels (shared cache key with other panels).
  const { data: ws } = useApiData(
    "workspace:settings",
    async (token) => await getWorkspaceSettings(token),
    { ttlMs: 10 * 60_000 }
  );
  const currency = ws?.currency ?? "USD";
  const money = (n: number) =>
    `${currency === "USD" ? "$" : `${currency} `}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const invoices = pageData?.invoices ?? [];
  const clients = pageData?.clients ?? [];

  // Billable tracked time never invoiced yet — "ready to bill" (timer → money).
  const { data: unbilledTimeData, refresh: reloadUnbilledTime } = useApiData<UnbilledTimeEntry[]>(
    "invoices:unbilled-time",
    async (token) => await getUnbilledTimeEntries(token)
  );
  const unbilledForClient = (unbilledTimeData ?? []).filter((e) => e.client_id === clientId);
  const pickedTime = unbilledForClient.filter((e) => selectedTimeIds.includes(e.id));
  const toggleTimeEntry = (id: string) =>
    setSelectedTimeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const unpaid = invoices.filter((i) => i.status !== "paid");
  const paid = invoices.filter((i) => i.status === "paid");

  const totalOwed = unpaid.reduce((acc, i) => acc + (i.total_amount || 0), 0);
  const totalOverdue = unpaid
    .filter((i) => i.status === "overdue")
    .reduce((acc, i) => acc + (i.total_amount || 0), 0);
  const thisMonthKey = new Date().toISOString().slice(0, 7);
  // paid_at is stamped by the backend when an invoice is marked paid; older
  // rows may lack it, so fall back to the issue date for those.
  const paidThisMonth = paid
    .filter((i) => (i.paid_at ?? i.issue_date ?? "").slice(0, 7) === thisMonthKey)
    .reduce((acc, i) => acc + (i.total_amount || 0), 0);

  const visibleUnpaid = (() => {
    const q = search.trim().toLowerCase();
    return unpaid.filter((i) => {
      if (filter !== "all" && i.status !== filter) return false;
      if (q === "") return true;
      return (
        i.invoice_number.toLowerCase().includes(q) ||
        (i.client_name ?? "").toLowerCase().includes(q)
      );
    });
  })();

  const visiblePaid = (() => {
    const q = search.trim().toLowerCase();
    return paid.filter(
      (i) =>
        q === "" ||
        i.invoice_number.toLowerCase().includes(q) ||
        (i.client_name ?? "").toLowerCase().includes(q)
    );
  })();

  const finalize = (v: string) => setSubTab(v as SubTabValue);
  const tabs: readonly SubTab[] = [
    { value: "new", label: "New invoice" },
    { value: "unpaid", label: "Unpaid", count: unpaid.length },
    { value: "paid", label: "Paid", count: paid.length },
  ] as const;

  const resetCreateForm = () => {
    setInvoiceNumber(newInvoiceNumber());
    setItemDesc("");
    setItemQty(1);
    setItemRate(0);
    setSelectedTimeIds([]);
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setDueDate(d.toISOString().slice(0, 10));
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOrToast(invoiceSchema, {
      invoiceNumber,
      clientId,
      itemDesc,
      itemQty: Number(itemQty),
      itemRate: Number(itemRate),
      dueDate,
    })) return;
    if (deleteId) return;
    try {
      const token = (await getToken()) || undefined;
      await createInvoice(
        {
          client_id: clientId,
          invoice_number: invoiceNumber,
          status: "sent",
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
          items: [
            {
              description: itemDesc,
              quantity: Number(itemQty),
              unit_price: Number(itemRate),
            },
            // Ticked timer entries become real invoice lines at their tracked
            // hours × rate; the server stamps them invoiced so they can never
            // be billed a second time.
            ...pickedTime.map((e) => ({
              description: `${e.project_title} — ${(e.description || "Tracked work").trim()} (${e.hours} h)`,
              quantity: e.hours,
              unit_price: e.hourly_rate,
            })),
          ],
          time_entry_ids: pickedTime.map((e) => e.id),
        },
        token
      );
      invalidateCache("invoices:data");
      invalidateCache("invoices:unbilled-time");
      invalidateCache("dashboard:data");
      invalidateCache("cashflow:summary");
      loadData();
      reloadUnbilledTime(true);
      toast.success("Invoice created — it is in the Unpaid list now");
      resetCreateForm();
      finalize("unpaid");
    } catch (err) {
      console.error("Error creating invoice:", err);
      toast.error("Could not create invoice");
    }
  };

  // Copy an existing invoice into a fresh draft with a new number — the
  // quickest way to bill the same client again (retainers, repeat work).
  const handleDuplicate = async (inv: Invoice) => {
    // Generate the number once so the value we validate is the value we save.
    const copyNumber = newInvoiceNumber();
    if (!validateOrToast(invoiceSchema, {
      invoiceNumber: copyNumber,
      clientId: inv.client_id,
      itemDesc: inv.items?.[0]?.description || "Repeat work",
      itemQty: inv.items?.[0]?.quantity || 1,
      itemRate: inv.items?.[0]?.unit_price || 0,
      dueDate,
    })) return;
    try {
      const token = (await getToken()) || undefined;
      await createInvoice(
        {
          client_id: inv.client_id,
          invoice_number: copyNumber,
          status: "draft",
          due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
          items: (inv.items ?? []).map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unit_price,
          })),
        },
        token
      );
      invalidateCache("invoices:data");
      invalidateCache("dashboard:data");
      loadData();
      toast.success("Copied into a new draft");
      finalize("unpaid");
    } catch (err) {
      console.error("Error duplicating invoice:", err);
      toast.error("Could not copy invoice");
    }
  };

  const handleMarkPaid = async (invId: string) => {
    try {
      const token = (await getToken()) || undefined;
      await updateInvoiceStatus(invId, "paid", token);
      invalidateCache("invoices:data");
      invalidateCache("dashboard:data");
      invalidateCache("cashflow:summary");
      loadData();
      toast.success("Invoice marked as paid");
    } catch (err) {
      console.error("Error updating invoice:", err);
      toast.error("Could not update invoice");
    }
  };

  const handleSetStatus = async (invId: string, statusVal: "draft" | "sent" | "paid" | "overdue") => {
    try {
      const token = (await getToken()) || undefined;
      await updateInvoiceStatus(invId, statusVal, token);
      invalidateCache("invoices:data");
      invalidateCache("dashboard:data");
      invalidateCache("cashflow:summary");
      loadData();
    } catch (err) {
      console.error("Error updating invoice:", err);
      toast.error("Could not update invoice");
    }
  };

  const handleDeleteInvoice = async (invId: string) => {
    const ok = await confirmDialog({
      title: "Delete invoice",
      message: "This invoice will be removed permanently. Paid invoices should be kept for your records.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setDeleteId(invId);
    try {
      const token = (await getToken()) || undefined;
      await deleteInvoice(invId, token);
      invalidateCache("invoices:data");
      invalidateCache("dashboard:data");
      invalidateCache("cashflow:summary");
      loadData();
      toast.success("Invoice deleted");
    } catch (err) {
      console.error("Error deleting invoice:", err);
      toast.error("Could not delete invoice");
    } finally {
      setDeleteId(null);
    }
  };

  const statusBadge = (status: string) => (
    <Badge
      variant="outline"
      className={
        status === "paid"
          ? "bg-accent-soft text-accent border-accent/20"
          : status === "overdue"
            ? "bg-danger/10 text-danger border-danger/20"
            : status === "draft"
              ? "bg-surface text-muted border-line"
              : "bg-warn/10 text-warn border-warn/20"
      }
    >
      {status.toUpperCase()}
    </Badge>
  );

  const invoiceRow = (inv: Invoice, isPaid: boolean) => (
    <Card key={inv.id} className="bg-card border-line hover:border-accent transition-all p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2.5 rounded-xl ${isPaid ? "bg-accent-soft" : "bg-surface"}`}>
            <Receipt className={`w-5 h-5 ${isPaid ? "text-accent" : "text-muted"}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-fg truncate">{inv.invoice_number}</h3>
              {statusBadge(inv.status)}
            </div>
            <p className="text-[11px] text-muted mt-0.5 truncate">
              {inv.client_name} • {inv.items?.[0]?.description || "Services"} • due {inv.due_date?.slice(0, 10) || "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <span className="font-mono text-sm font-bold text-fg mr-1">{money(inv.total_amount || 0)}</span>
          {inv.status === "draft" && (
            <Button size="sm" variant="outline" onClick={() => handleSetStatus(inv.id, "sent")} className="border-line text-fg h-7 px-2.5 text-xs">
              <Send className="w-3.5 h-3.5 mr-1" />
              Send
            </Button>
          )}
          {!isPaid && (
            <Button size="sm" onClick={() => handleMarkPaid(inv.id)} className="bg-accent hover:bg-accent-hi text-accent-fg h-7 px-2.5 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Paid
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDuplicate(inv)}
            className="border-line text-fg h-7 px-2.5 text-xs"
            title="Copy into a new draft"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <button
            onClick={() => handleDeleteInvoice(inv.id)}
            disabled={deleteId === inv.id}
            className="text-faint hover:text-danger p-1.5 rounded-lg hover:bg-danger/10 transition-colors disabled:opacity-50"
            title="Delete invoice"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  );

  if (loading && pageData === undefined) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-10 w-full max-w-md rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const filterChips: { value: "all" | "draft" | "sent" | "overdue"; label: string; count: number }[] = [
    { value: "all", label: "All", count: unpaid.length },
    { value: "draft", label: "Drafts", count: unpaid.filter((i) => i.status === "draft").length },
    { value: "sent", label: "Waiting", count: unpaid.filter((i) => i.status === "sent").length },
    { value: "overdue", label: "Late", count: unpaid.filter((i) => i.status === "overdue").length },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-fg">Invoices</h2>
          <p className="text-muted text-sm mt-1">Make a bill, chase it, tick it off. One page each.</p>
        </div>
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
      </div>

      <SubTabs tabs={tabs} value={subTab} onChange={finalize} />

      {/* ---------------- New invoice: inline form ------------- */}
      {subTab === "new" && (
        <Card className="bg-card border-line p-6 max-w-xl">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-accent" />
            <h3 className="text-base font-bold text-fg">Bill a client</h3>
          </div>
          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted">Who pays?</label>
              {clients.length > 0 ? (
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                >
                  {clients.map((c: Client) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.company_name || c.email})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-warn mt-1">No clients yet. Add one in Clients first.</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-muted">What did you do?</label>
              <input
                type="text"
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
                placeholder="e.g. Landing page redesign"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted">Quantity / Hours</label>
                <input
                  type="number"
                  value={itemQty}
                  onChange={(e) => setItemQty(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted">Unit price ({currency})</label>
                <input
                  type="number"
                  value={itemRate}
                  onChange={(e) => setItemRate(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                  min="0"
                  required
                />
              </div>
            </div>

            {unbilledForClient.length > 0 && (
              <div className="rounded-xl border border-line bg-bg p-3 space-y-2">
                <p className="flex items-center gap-2 text-xs font-semibold text-muted">
                  <Clock className="w-3.5 h-3.5 text-warn" />
                  Ready to bill — tick the tracked time you want on this invoice
                </p>
                {unbilledForClient.map((e) => (
                  <label
                    key={e.id}
                    className="flex items-center gap-3 text-xs cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTimeIds.includes(e.id)}
                      onChange={() => toggleTimeEntry(e.id)}
                      className="accent-[var(--accent)] w-4 h-4"
                    />
                    <span className="flex-1 min-w-0 truncate text-fg">
                      {e.project_title}
                      {e.description ? ` — ${e.description}` : ""}
                    </span>
                    <span className="font-mono text-muted shrink-0">{e.hours} h</span>
                    <span className="font-mono font-bold text-fg shrink-0">{money(e.amount)}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted">Invoice number</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm font-mono focus:outline-none focus:border-accent"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted">Pay by</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-line flex items-center justify-between">
              <span className="text-sm font-semibold text-fg">
                Total:{" "}
                <span className="font-mono">
                  {money(Number(itemQty || 0) * Number(itemRate || 0) + pickedTime.reduce((a, e) => a + e.amount, 0))}
                </span>
                {pickedTime.length > 0 && (
                  <span className="text-xs font-normal text-muted"> ({pickedTime.length} time {pickedTime.length === 1 ? "entry" : "entries"})</span>
                )}
              </span>
              <Button type="submit" className="bg-accent hover:bg-accent-hi text-accent-fg">
                <Plus className="w-4 h-4 mr-1.5" />
                Create invoice
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ---------------- Unpaid ------------- */}
      {subTab === "unpaid" && (
        <div className="space-y-4">
          <Card className="bg-card border-line p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0 overflow-x-auto">
              <div>
                <p className="text-[10px] font-semibold text-muted uppercase">Still owed</p>
                <p className="text-lg font-bold font-mono text-fg">{money(totalOwed)}</p>
              </div>
              {totalOverdue > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted uppercase">Of which late</p>
                  <p className="text-lg font-bold font-mono text-danger">{money(totalOverdue)}</p>
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted hidden sm:block shrink-0">Updates live when money is marked paid</p>
          </Card>

          <div className="flex items-center gap-2 flex-wrap">
            {filterChips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => setFilter(chip.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === chip.value ? "bg-accent-soft text-info border border-accent/30" : "bg-surface text-muted hover:text-fg"
                }`}
              >
                {chip.label}
                <span className="font-mono text-[10px]">{chip.count}</span>
              </button>
            ))}
            <div className="relative flex-1 min-w-40">
              <Search className="w-3.5 h-3.5 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search number or client…"
                className="w-full pl-8 pr-3 py-1.5 rounded-full bg-bg border border-line text-xs text-fg focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {visibleUnpaid.length === 0 ? (
            <Card className="bg-card border-dashed border-line p-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-ok mx-auto mb-3" />
              <p className="text-sm font-semibold text-fg">
                {unpaid.length === 0 ? "Nothing unpaid — all caught up!" : "No invoices match this filter"}
              </p>
              {unpaid.length === 0 && (
                <Button onClick={() => finalize("new")} className="mt-4 bg-accent hover:bg-accent-hi text-accent-fg">
                  <Plus className="w-4 h-4 mr-1.5" />
                  New invoice
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {visibleUnpaid.map((inv) => invoiceRow(inv, false))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- Paid history ------------- */}
      {subTab === "paid" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card border-line p-5">
              <p className="text-[10px] font-semibold text-muted uppercase">Paid this month</p>
              <p className="text-2xl font-bold font-mono text-ok mt-1">{money(paidThisMonth)}</p>
            </Card>
            <Card className="bg-card border-line p-5">
              <p className="text-[10px] font-semibold text-muted uppercase">All-time collected</p>
              <p className="text-2xl font-bold font-mono text-fg mt-1">
                {money(paid.reduce((acc, i) => acc + (i.total_amount || 0), 0))}
              </p>
            </Card>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search paid invoices…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-bg border border-line text-sm text-fg focus:outline-none focus:border-accent"
            />
          </div>

          {visiblePaid.length === 0 ? (
            <Card className="bg-card border-dashed border-line p-10 text-center">
              <Receipt className="w-10 h-10 text-faint mx-auto mb-3" />
              <p className="text-sm font-semibold text-fg">No paid invoices yet</p>
              <p className="text-[11px] text-muted mt-1">Mark one paid on the Unpaid page and it lands here.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {visiblePaid.map((inv) => invoiceRow(inv, true))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
