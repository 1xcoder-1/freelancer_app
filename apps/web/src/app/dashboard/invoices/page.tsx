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

export default function InvoicesPage() {
  const { getToken } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [clientId, setClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [itemDesc, setItemDesc] = useState("Web App Design & Development");
  const [itemQty, setItemQty] = useState(1);
  const [itemRate, setItemRate] = useState(1200);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = (await getToken()) || undefined;
      const [invRes, clientRes] = await Promise.all([
        getInvoices(token).catch(() => []),
        getClients(token).catch(() => [])
      ]);
      setInvoices(invRes);
      setClients(clientRes);
      if (clientRes.length > 0) {
        setClientId(clientRes[0].id);
      }
    } catch (err) {
      console.error("Failed to load invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
      loadData();
    } catch (err) {
      console.error("Error creating invoice:", err);
    }
  };

  const handleMarkPaid = async (invId: string) => {
    try {
      const token = (await getToken()) || undefined;
      await updateInvoiceStatus(invId, "paid", token);
      loadData();
    } catch (err) {
      console.error("Error updating invoice:", err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-white">Invoices & Payments</h1>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-xs">
              ⚡ Instant Get Paid
            </Badge>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Create professional itemized invoices, track payments, and get paid via Stripe or local gateways.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="border-white/10 text-slate-300">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Invoice List with Skeleton Loading */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-slate-900/40 border-white/5 p-5">
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
            <Card key={inv.id} className="bg-slate-900/40 border-white/10 hover:border-emerald-500/30 transition-all p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-white">{inv.invoice_number}</h3>
                      <Badge
                        variant="outline"
                        className={
                          inv.status === "paid"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }
                      >
                        {inv.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Client: <span className="text-slate-200">{inv.client_name}</span> • Issue Date: {inv.issue_date?.slice(0, 10)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-auto">
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">${inv.total_amount?.toFixed(2)}</div>
                    <span className="text-[10px] text-slate-500">USD Currency</span>
                  </div>

                  {inv.status !== "paid" && (
                    <Button
                      size="sm"
                      onClick={() => handleMarkPaid(inv.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
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
        <Card className="bg-slate-900/20 border-dashed border-white/10 p-12 text-center">
          <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-200">No Invoices in Database</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            You haven&apos;t created any invoices yet. Click below to create your first real invoice.
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create First Invoice
          </Button>
        </Card>
      )}

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-lg bg-slate-900 border-white/10 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white">Create New Invoice</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400">Invoice Number</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Select Client</label>
                {clients.length > 0 ? (
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.company_name || c.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-amber-400 mt-1">
                    No clients found. Please go to Clients CRM and add a client first.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Line Item Description</label>
                <input
                  type="text"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Quantity / Hours</label>
                  <input
                    type="number"
                    value={itemQty}
                    onChange={(e) => setItemQty(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400">Unit Price ($)</label>
                  <input
                    type="number"
                    value={itemRate}
                    onChange={(e) => setItemRate(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">
                  Total: ${(itemQty * itemRate).toFixed(2)}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    className="border-white/10 text-slate-300"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">
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
