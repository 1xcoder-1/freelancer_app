"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Receipt,
  Plus,
  CheckCircle2,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getInvoices,
  createInvoice,
  getClients,
  updateInvoiceStatus,
  deleteInvoice,
  type Invoice,
  type Client,
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

export function InvoicesPanel() {
  const { getToken } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [clientId, setClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [itemDesc, setItemDesc] = useState("Web App Design & Development");
  const [itemQty, setItemQty] = useState(1);
  const [itemRate, setItemRate] = useState(1200);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });

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
      onSuccess: (data) => {
        if (data.clients.length > 0) {
          setClientId((prev) => prev || data.clients[0].id);
        }
      },
    }
  );

  const invoices = pageData?.invoices ?? [];
  const clients = pageData?.clients ?? [];

  // Generate the suggested invoice number on open (event handler), not during
  // render — keeps the component pure.
  const openCreateModal = () => {
    setInvoiceNumber(`INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
    setShowCreateModal(true);
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
          ],
        },
        token
      );
      setShowCreateModal(false);
      invalidateCache("dashboard:data");
      loadData();
      toast.success("Invoice created");
    } catch (err) {
      console.error("Error creating invoice:", err);
      toast.error("Could not create invoice");
    }
  };

  const handleMarkPaid = async (invId: string) => {
    try {
      const token = (await getToken()) || undefined;
      await updateInvoiceStatus(invId, "paid", token);
      invalidateCache("dashboard:data");
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
      invalidateCache("dashboard:data");
      loadData();
    } catch (err) {
      console.error("Error updating invoice:", err);
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
    try {
      const token = (await getToken()) || undefined;
      await deleteInvoice(invId, token);
      invalidateCache("dashboard:data");
      loadData();
      toast.success("Invoice deleted");
    } catch (err) {
      console.error("Error deleting invoice:", err);
      toast.error("Could not delete invoice");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted text-sm">
          Create itemized invoices, track payments, and mark them paid when the money lands.
        </p>
        <Button
          size="sm"
          onClick={openCreateModal}
          className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm shrink-0"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Create Invoice
        </Button>
      </div>

      {/* Invoice List with Skeleton Loading */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card border-line p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right space-y-1">
                    <Skeleton className="h-6 w-24 ml-auto" />
                    <Skeleton className="h-3 w-16 ml-auto" />
                  </div>
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : invoices.length > 0 ? (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <Card key={inv.id} className="bg-card border-line hover:border-accent transition-all p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-accent text-accent">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-fg">{inv.invoice_number}</h3>
                      <Badge
                        variant="outline"
                        className={
                          inv.status === "paid"
                            ? "bg-accent-soft text-accent border-accent/20"
                            : inv.status === "overdue"
                              ? "bg-danger/10 text-danger border-danger/20"
                              : "bg-warn/10 text-warn border-warn/20"
                        }
                      >
                        {inv.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      Client: <span className="text-fg">{inv.client_name}</span> • Issue: {inv.issue_date?.slice(0, 10)}
                      {inv.due_date ? ` • Due: ${inv.due_date.slice(0, 10)}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="text-right">
                    <div className="text-lg font-bold text-fg">${inv.total_amount?.toFixed(2)}</div>
                    <span className="text-[10px] text-faint">USD Currency</span>
                  </div>

                  {inv.status === "draft" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetStatus(inv.id, "sent")}
                      className="border-line text-fg text-xs"
                    >
                      <Send className="w-3.5 h-3.5 mr-1" />
                      Send
                    </Button>
                  )}

                  {inv.status !== "paid" && (
                    <Button
                      size="sm"
                      onClick={() => handleMarkPaid(inv.id)}
                      className="bg-accent hover:bg-accent-hi text-accent-fg text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Mark Paid
                    </Button>
                  )}

                  <button
                    onClick={() => handleDeleteInvoice(inv.id)}
                    className="text-faint hover:text-danger p-1.5 rounded-lg hover:bg-danger/10 transition-colors"
                    title="Delete invoice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-dashed border-line p-12 text-center">
          <Receipt className="w-12 h-12 text-faint mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-fg">No invoices yet</h3>
          <p className="text-sm text-faint mt-1 max-w-md mx-auto">
            Press below to create your first invoice.
          </p>
          <Button
            onClick={openCreateModal}
            className="mt-6 bg-accent hover:bg-accent-hi text-accent-fg"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create First Invoice
          </Button>
        </Card>
      )}

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-lg bg-card border-line p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <h3 className="text-lg font-bold text-fg">Create New Invoice</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted hover:text-fg text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted">Invoice Number</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted">Select Client</label>
                {clients.length > 0 ? (
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.company_name || c.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-warn mt-1">
                    No clients yet. Add one in Clients first.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted">Line Item Description</label>
                <input
                  type="text"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
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
                  <label className="text-xs font-semibold text-muted">Unit Price ($)</label>
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

              <div>
                <label className="text-xs font-semibold text-muted">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div className="pt-2 border-t border-line flex items-center justify-between">
                <span className="text-sm font-semibold text-fg">
                  Total: ${(itemQty * itemRate).toFixed(2)}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    className="border-line text-fg"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-accent hover:bg-accent-hi text-accent-fg">
                    Save Invoice
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
