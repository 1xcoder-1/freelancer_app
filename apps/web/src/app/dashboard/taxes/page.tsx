"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Calculator, Plus, Trash2, Receipt, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getExpenses, createExpense, deleteExpense, type Expense } from "@/lib/api";

export default function TaxesPage() {
  const { getToken } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState("Software & Subscriptions");
  const [amount, setAmount] = useState(49);
  const [description, setDescription] = useState("");

  const loadData = async (isManualRefresh?: unknown) => {
    try {
      if (isManualRefresh === true) setLoading(true);
      const token = (await getToken()) || undefined;
      const res = await getExpenses(token);
      setExpenses(res);
    } catch (err) {
      console.error("Error loading expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  const totalDeductions = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const estimatedTaxReserve = totalDeductions * 0.25;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = (await getToken()) || undefined;
      await createExpense({
        category,
        amount: Number(amount),
        description
      }, token);
      setShowModal(false);
      setDescription("");
      loadData();
    } catch (err) {
      console.error("Error saving expense:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = (await getToken()) || undefined;
      await deleteExpense(id, token);
      loadData();
    } catch (err) {
      console.error("Error deleting expense:", err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-white">Expenses & Tax Deductions Engine</h1>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-xs">
              Schedule C Categorizer
            </Badge>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Log business write-offs with Cloudinary receipt scanning and calculate quarterly tax reserves.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={loading} className="border-white/10 text-slate-300">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            onClick={() => setShowModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Log Business Expense
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </>
        ) : (
          <>
            <Card className="bg-slate-900 border-white/10 p-6 space-y-1">
              <span className="text-xs font-semibold text-slate-400">Total Logged Deductions (Write-Offs)</span>
              <div className="text-3xl font-bold text-white">${totalDeductions.toFixed(2)}</div>
              <p className="text-xs text-slate-500 font-mono">Stored in Neon PostgreSQL</p>
            </Card>

            <Card className="bg-slate-900 border-white/10 p-6 space-y-1">
              <span className="text-xs font-semibold text-slate-400">Estimated Tax Savings (25% Bracket)</span>
              <div className="text-3xl font-bold text-emerald-400">${estimatedTaxReserve.toFixed(2)}</div>
              <p className="text-xs text-slate-500 font-mono">Saved in your pocket</p>
            </Card>
          </>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-slate-900/40 border-white/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            </Card>
          ))}
        </div>
      ) : expenses.length > 0 ? (
        <div className="space-y-3">
          {expenses.map((exp) => (
            <Card key={exp.id} className="bg-slate-900/40 border-white/10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{exp.category}</h4>
                  <p className="text-xs text-slate-400">{exp.description || "General business cost"} • {exp.created_at?.slice(0, 10)}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-mono text-sm font-bold text-white">${exp.amount.toFixed(2)}</span>
                <button onClick={() => handleDelete(exp.id)} className="text-slate-500 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-slate-900/20 border-dashed border-white/10 p-12 text-center">
          <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-200">No Expenses Logged Yet</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Log software subscriptions, hardware, internet, and office expenses to reduce your taxes.
          </p>
        </Card>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md bg-slate-900 border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white">Log Expense</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400">Tax Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm"
                >
                  <option value="Software & Subscriptions">Software & Subscriptions</option>
                  <option value="Hardware & Equipment">Hardware & Equipment</option>
                  <option value="Internet & Utilities">Internet & Utilities</option>
                  <option value="Office & Coworking">Office & Coworking</option>
                  <option value="Advertising & Marketing">Advertising & Marketing</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400">Amount ($)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. GitHub Copilot & Hosting"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/10 text-white text-sm"
                />
              </div>
              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">Save Expense</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
