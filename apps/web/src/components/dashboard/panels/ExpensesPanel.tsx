"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Trash2, Receipt, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getExpenses, createExpense, deleteExpense, type Expense } from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { z } from "zod";
import { validateOrToast, nameSchema } from "@/lib/validation";

const expenseSchema = z.object({
  category: nameSchema("Category"),
  amount: z
    .number({ message: "Amount must be a number" })
    .positive("Amount must be greater than 0")
    .max(10_000_000, "Amount looks too large"),
  description: nameSchema("Description", 300),
});

export function ExpensesPanel() {
  const { getToken } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState("Software & Subscriptions");
  const [amount, setAmount] = useState(49);
  const [description, setDescription] = useState("");

  const { data: expensesData, loading, refresh: loadData } = useApiData<Expense[]>(
    "taxes:expenses",
    async (token) => {
      return await getExpenses(token);
    },
    { reportContext: "taxes" }
  );

  const expenses = expensesData ?? [];
  const totalDeductions = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const estimatedTaxReserve = totalDeductions * 0.25;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOrToast(expenseSchema, { category, amount: Number(amount), description })) return;
    try {
      const token = (await getToken()) || undefined;
      await createExpense({
        category,
        amount: Number(amount),
        description
      }, token);
      setShowModal(false);
      setDescription("");
      invalidateCache("dashboard:data");
      loadData();
      toast.success("Expense added");
    } catch (err) {
      console.error("Error saving expense:", err);
      toast.error("Could not add expense");
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete expense",
      message: "This expense will be removed from your records and your tax deductions will change.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      const token = (await getToken()) || undefined;
      await deleteExpense(id, token);
      invalidateCache("dashboard:data");
      loadData();
      toast.success("Expense deleted");
    } catch (err) {
      console.error("Error deleting expense:", err);
      toast.error("Could not delete expense");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold tracking-tight text-fg">Expenses</h2>
          </div>
          <p className="text-muted text-sm mt-1">
            Write down what you spent on business stuff. It lowers your tax bill.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={loading} className="border-line text-fg">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setShowModal(true)}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Expense
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
            <Card className="bg-card border-line p-6 space-y-1">
              <span className="text-xs font-semibold text-muted">Total spent this year</span>
              <div className="font-display text-[26px] font-bold tracking-tight text-fg">${totalDeductions.toFixed(2)}</div>
            </Card>

            <Card className="bg-card border-line p-6 space-y-1">
              <span className="text-xs font-semibold text-muted">Tax you likely save (at 25%)</span>
              <div className="text-3xl font-bold text-accent">${estimatedTaxReserve.toFixed(2)}</div>
            </Card>
          </>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card border-line p-4 flex items-center justify-between">
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
            <Card key={exp.id} className="bg-card border-line p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-accent text-accent">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-fg">{exp.category}</h4>
                  <p className="text-xs text-muted">{exp.description || "General business cost"} • {exp.created_at?.slice(0, 10)}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-mono text-sm font-bold text-fg">${exp.amount.toFixed(2)}</span>
                <button onClick={() => handleDelete(exp.id)} className="text-faint hover:text-danger">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-dashed border-line p-12 text-center">
          <Receipt className="w-12 h-12 text-faint mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-fg">No expenses yet</h3>
          <p className="text-sm text-faint mt-1 max-w-md mx-auto">
            Add software, internet, hardware or office costs here — they count as tax deductions.
          </p>
        </Card>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md bg-card border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-lg font-bold text-fg">Add expense</h3>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-fg text-sm">✕</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted">What was it for?</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm"
                >
                  <option value="Software & Subscriptions">Software & Subscriptions</option>
                  <option value="Hardware & Equipment">Hardware & Equipment</option>
                  <option value="Internet & Utilities">Internet & Utilities</option>
                  <option value="Office & Coworking">Office & Coworking</option>
                  <option value="Advertising & Marketing">Advertising & Marketing</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted">Amount ($)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted">Note (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. GitHub Copilot & Hosting"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-bg border border-line text-fg text-sm"
                />
              </div>
              <div className="pt-3 border-t border-line flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" className="bg-accent hover:bg-accent-hi text-accent-fg">Save Expense</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
