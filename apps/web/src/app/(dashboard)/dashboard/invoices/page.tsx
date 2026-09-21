"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Receipt,
  Plus,
  DollarSign,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  Send,
  Trash2,
  RefreshCw,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getInvoices, createInvoice, getClients, updateInvoiceStatus, type Invoice, type Client } from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";

export default function InvoicesPage() {
  const { getToken } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [clientId, setClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [itemDesc, setItemDesc] = useState("Web App Design & Development");
  const [itemQty, setItemQty] = useState(1);
  const [itemRate, setItemRate] = useState(1200);

  const { data: pageData, loading, refresh: loadData } = useApiData(
    "invoices:data",
    async (token) => {
      const [invRes, clientRes] = await Promise.all([
        getInvoices(token).catch(() => []),
        getClients(token).catch(() => [])
      ]);
      return { invoices: invRes, clients: clientRes };
    },
    {
      reportContext: "invoices",
      onSuccess: (data) => {
        if (data.clients.length > 0) {
          setClientId((prev) => prev || data.clients[0].id);
        }
      }
    }
  );

  const invoices = pageData?.invoices ?? [];
  const clients = pageData?.clients ?? [];

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      alert("Please add or select a client first!");
      return;
    }
    try {
      const token = (await getToken()) || undefined;
      await createInvoice({
        client_id: clientId,
        invoice_number: invoiceNumber,
        status: "sent",
        items: [
          {
            description: itemDesc,
            quantity: Number(itemQty),
            unit_price: Number(itemRate)
          }
        ]
      }, token);
      setShowCreateModal(false);
      invalidateCache("dashboard:data");
      loadData();
    } catch (err) {
      console.error("Error creating invoice:", err);
    }
  };

  const handleMarkPaid = async (invId: string) => {
    try {
      const token = (await getToken()) || undefined;
      await updateInvoiceStatus(invId, "paid", token);
      invalidateCache("dashboard:data");
      loadData();
    } catch (err) {
      console.error("Error updating invoice:", err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">Invoices & Payments</h1>
            <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs">
              ⚡ Instant Get Paid
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Create professional itemized invoices, track payments, and get paid via Stripe or local gateways.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={loading} className="border-line text-fg">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Invoice
          </Button>
        </div>
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
                      Client: <span className="text-fg">{inv.client_name}</span> • Issue Date: {inv.issue_date?.slice(0, 10)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-auto">
                  <div className="text-right">
                    <div className="text-lg font-bold text-fg">${inv.total_amount?.toFixed(2)}</div>
                    <span className="text-[10px] text-faint">USD Currency</span>
                  </div>

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
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-dashed border-line p-12 text-center">
          <Receipt className="w-12 h-12 text-faint mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-fg">No Invoices in Database</h3>
          <p className="text-sm text-faint mt-1 max-w-md mx-auto">
            You haven&apos;t created any invoices yet. Click below to create your first real invoice.
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
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
                    No clients found. Please go to Clients CRM and add a client first.
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
                    Save to Neon DB
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
