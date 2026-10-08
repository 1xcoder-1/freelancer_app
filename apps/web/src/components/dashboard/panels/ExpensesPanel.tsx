"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Plus,
  Trash2,
  Receipt,
  RefreshCw,
  Laptop,
  Cpu,
  Wifi,
  Building2,
  Megaphone,
  Repeat,
  Check,
  Tag,
  DollarSign,
  Calendar,
  ShieldCheck,
  TrendingDown,
  Layers,
  Sparkles,
} from "@/components/animated-icons";
import type { LucideIcon } from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  getExpenses,
  createExpense,
  deleteExpense,
  updateExpense,
  getWorkspaceSettings,
  type Expense,
} from "@/lib/api";
import { useApiData, invalidateCache } from "@/hooks/use-api-data";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { z } from "zod";
import { validateOrToast, nameSchema, optionalTextSchema } from "@/lib/validation";
import { CategoryVisualCard, ChaiCupIcon } from "@/components/dashboard/CategoryVisualCard";

const expenseSchema = z.object({
  category: nameSchema("Category"),
  amount: z
    .number({ message: "Amount must be a number" })
    .positive("Amount must be greater than 0")
    .max(10_000_000, "Amount looks too large"),
  description: optionalTextSchema("Description", 300),
});

const DEFAULT_CATEGORIES: { name: string; icon: LucideIcon; tint: string }[] = [
  { name: "Software & Subscriptions", icon: Laptop, tint: "text-accent" },
  { name: "Hardware & Equipment", icon: Cpu, tint: "text-info" },
  { name: "Office & Coworking", icon: Building2, tint: "text-warn" },
  { name: "Advertising & Marketing", icon: Megaphone, tint: "text-danger" },
  { name: "Internet & Utilities", icon: Wifi, tint: "text-ok" },
  { name: "Travel & Meals", icon: Receipt, tint: "text-violet" },
  { name: "Taxes & Professional Fees", icon: ShieldCheck, tint: "text-accent" },
];

const QUICK_AMOUNTS = [15, 29, 49, 99, 199, 499];

export function ExpensesPanel() {
  const { getToken } = useAuth();

  // Modals state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Form Fields
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0].name);
  const [customCategory, setCustomCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  // Filter view: "all" | "recurring" | "tax_deductible"
  const [activeFilter, setActiveFilter] = useState<"all" | "recurring" | "tax">("all");

  const { data: expensesData, loading, refresh: loadData } = useApiData<Expense[]>(
    "taxes:expenses",
    async (token) => await getExpenses(token),
    { reportContext: "taxes", pollMs: 15_000 }
  );

  const { data: ws } = useApiData(
    "workspace:settings",
    async (token) => await getWorkspaceSettings(token),
    { ttlMs: 10 * 60_000 }
  );
  const currency = ws?.currency ?? "USD";
  const money = (n: number) =>
    `${currency === "USD" ? "$" : `${currency} `}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const expenses = useMemo(() => expensesData ?? [], [expensesData]);

  // Derived Financial Metrics
  const totalAmount = useMemo(
    () => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [expenses]
  );

  const recurringTotal = useMemo(
    () =>
      expenses
        .filter((e) => e.is_recurring)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [expenses]
  );

  const recurringCount = useMemo(
    () => expenses.filter((e) => e.is_recurring).length,
    [expenses]
  );

  const handleOpenCreate = (prefillCategory = DEFAULT_CATEGORIES[0].name) => {
    setCategory(prefillCategory);
    setCustomCategory("");
    setShowCreateDialog(true);
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount || "0");
    const chosenCategory = customCategory.trim() || category;

    if (!validateOrToast(expenseSchema, { category: chosenCategory, amount: numAmount, description })) return;

    setSaving(true);
    try {
      const token = (await getToken()) || undefined;
      const created = await createExpense(
        {
          category: chosenCategory,
          amount: numAmount,
          description: description || chosenCategory,
          is_recurring: isRecurring,
          created_at: expenseDate ? new Date(expenseDate).toISOString() : new Date().toISOString(),
        },
        token
      );

      setShowCreateDialog(false);
      setAmount("");
      setDescription("");
      setCustomCategory("");
      setIsRecurring(false);

      invalidateCache("taxes:expenses");
      invalidateCache("dashboard:data");
      await loadData();
      toast.success("Expense recorded successfully!");

      if (created) {
        setSelectedExpense(created);
      }
    } catch (err) {
      console.error("Error creating expense:", err);
      toast.error("Could not record expense");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRecurring = async (expense: Expense) => {
    try {
      const token = (await getToken()) || undefined;
      const updated = await updateExpense(
        expense.id,
        { is_recurring: !expense.is_recurring },
        token
      );
      if (selectedExpense?.id === expense.id) {
        setSelectedExpense({ ...selectedExpense, is_recurring: !expense.is_recurring });
      }
      invalidateCache("taxes:expenses");
      await loadData();
      toast.success(!expense.is_recurring ? "Marked as recurring monthly" : "Marked as one-time");
    } catch (err) {
      console.error("Error toggling recurring:", err);
      toast.error("Could not update recurring state");
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const ok = await confirmDialog({
      title: "Delete expense",
      message: "Are you sure you want to remove this expense entry? This will update your totals.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;

    try {
      const token = (await getToken()) || undefined;
      await deleteExpense(id, token);
      if (selectedExpense?.id === id) {
        setSelectedExpense(null);
      }
      invalidateCache("taxes:expenses");
      invalidateCache("dashboard:data");
      await loadData();
      toast.success("Expense deleted");
    } catch (err) {
      console.error("Error deleting expense:", err);
      toast.error("Could not delete expense");
    }
  };

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    if (activeFilter === "recurring") {
      return expenses.filter((e) => e.is_recurring);
    }
    return expenses;
  }, [expenses, activeFilter]);

  // Categories Present (only non-empty categories)
  const categoriesPresent = useMemo(() => {
    const existing = filteredExpenses
      .map((e) => {
        if (typeof e.category === "string" && e.category.trim() && e.category !== "[object Object]") {
          return e.category.trim();
        }
        if (typeof (e.category as any)?.name === "string") {
          return (e.category as any).name;
        }
        return "Software & Subscriptions";
      })
      .filter((cat) => Boolean(cat) && typeof cat === "string" && cat !== "[object Object]");
    const unique = Array.from(new Set(existing));
    if (unique.length === 0 && filteredExpenses.length > 0) {
      unique.push("Software & Subscriptions");
    }
    return unique;
  }, [filteredExpenses]);

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">Expense Tracker</h2>
            <Badge className="bg-accent-soft text-accent border-accent/20 font-mono text-xs font-semibold">
              {loading ? "Loading..." : `${expenses.length} Records`}
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Categorized business expenses, recurring subscriptions, and tax write-offs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading}
            className="border-line text-fg bg-card hover:bg-surface w-9 h-9 p-0 rounded-xl flex items-center justify-center shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenCreate()}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Financial Metrics Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border-line p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-muted text-xs font-semibold">
            <TrendingDown className="w-3.5 h-3.5 text-accent" /> Total Expenses
          </div>
          <p className="text-xl font-bold font-mono text-fg mt-1.5">{money(totalAmount)}</p>
          <p className="text-[11px] text-muted mt-0.5">{expenses.length} tracked items</p>
        </Card>

        <Card className="bg-card border-line p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-muted text-xs font-semibold">
            <Repeat className="w-3.5 h-3.5 text-info" /> Monthly Subscriptions
          </div>
          <p className="text-xl font-bold font-mono text-fg mt-1.5">{money(recurringTotal)}/mo</p>
          <p className="text-[11px] text-muted mt-0.5">{recurringCount} active subscriptions</p>
        </Card>

        <Card className="bg-card border-line p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-muted text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-ok" /> Tax Deductible
          </div>
          <p className="text-xl font-bold font-mono text-fg mt-1.5">{money(totalAmount)}</p>
          <p className="text-[11px] text-muted mt-0.5">100% write-off eligible</p>
        </Card>

        <Card className="bg-card border-line p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-muted text-xs font-semibold">
            <Layers className="w-3.5 h-3.5 text-warn" /> Categories Active
          </div>
          <p className="text-xl font-bold font-mono text-fg mt-1.5">{categoriesPresent.length}</p>
          <p className="text-[11px] text-muted mt-0.5">Organized & structured</p>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-xl border transition-all font-semibold ${
            activeFilter === "all"
              ? "bg-accent text-accent-fg border-accent shadow-xs"
              : "bg-surface text-muted border-line hover:border-accent/40"
          }`}
        >
          All Categorized Cards ({expenses.length})
        </button>
        <button
          onClick={() => setActiveFilter("recurring")}
          className={`text-xs px-3 py-1.5 rounded-xl border transition-all font-semibold flex items-center gap-1.5 ${
            activeFilter === "recurring"
              ? "bg-accent text-accent-fg border-accent shadow-xs"
              : "bg-surface text-muted border-line hover:border-accent/40"
          }`}
        >
          <Repeat className="w-3 h-3" />
          Recurring Subscriptions ({recurringCount})
        </button>
      </div>

      {/* Expense Cards Grouped by Category */}
      {loading && expenses.length === 0 ? (
        <div className="space-y-8">
          {[1, 2].map((group) => (
            <div key={group} className="space-y-3">
              <Skeleton className="h-6 w-36 rounded-md" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-36 w-full rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filteredExpenses.length === 0 ? (
        <Card className="bg-card border-dashed border-line p-12 text-center rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
            <ChaiCupIcon className="w-7 h-7" />
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-medium tracking-wide text-fg">No expenses recorded yet</h3>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">
            Add tools, subscriptions, software, and hardware to organize your expenses into visual cards.
          </p>
          <Button
            onClick={() => handleOpenCreate()}
            className="mt-6 bg-accent hover:bg-accent-hi text-accent-fg font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add First Expense
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {categoriesPresent.map((cat) => {
            const catExpenses = filteredExpenses.filter((e) => (e.category || "General") === cat);
            if (catExpenses.length === 0) return null;

            return (
              <div key={cat} className="space-y-3">
                {/* Category Header */}
                <h3 className="font-display text-base md:text-lg font-medium tracking-wide text-fg">{cat}</h3>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                  {catExpenses.map((exp, idx) => {
                    const expAmount = Number(exp.amount) || 0;
                    const numVal = Math.round(expAmount);
                    const maxVal = Math.max(numVal, 100 * Math.ceil(numVal / 100 || 1));

                    return (
                      <CategoryVisualCard
                        key={exp.id}
                        title={exp.description || exp.category || "Expense"}
                        currentCount={numVal}
                        totalCount={maxVal}
                        subtitle={`By ${exp.category || "Tools"}`}
                        onClick={() => setSelectedExpense(exp)}
                        tags={
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
                              {money(expAmount)}
                            </span>
                            {exp.is_recurring && (
                              <Badge className="bg-info/10 text-info border-transparent text-[10px] font-mono">
                                MONTHLY
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] text-muted border-line">
                              {new Date(exp.created_at || Date.now()).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </Badge>
                          </div>
                        }
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. ADD EXPENSE MODAL                                         */}
      {/* ============================================================ */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Business Expense</DialogTitle>
            <DialogDescription>
              Assign the expense to a category. It will generate a stylized card and update your totals.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateExpense} className="space-y-4">
            {/* Category Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-fg block flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-accent" /> Assign Category
                </span>
                <span className="text-[11px] text-muted font-normal">
                  Active: <strong className="text-accent">{customCategory.trim() || category}</strong>
                </span>
              </label>

              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set([...DEFAULT_CATEGORIES.map((c) => c.name), ...categoriesPresent])).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCategory(c);
                      setCustomCategory("");
                    }}
                    className={`text-xs px-2.5 py-1 rounded-xl border transition-all ${
                      category === c && !customCategory.trim()
                        ? "bg-accent text-accent-fg border-accent font-semibold shadow-xs scale-[1.02]"
                        : "bg-surface text-muted border-line hover:border-accent/40"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Or type a new category name (e.g. Cloud Hosting)..."
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
              />
            </div>

            {/* Description / Vendor */}
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">
                Vendor / Description <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. GitHub Copilot, Figma Pro, MacBook Pro M3"
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
              />
            </div>

            {/* Amount & Quick Chips */}
            <div>
              <label className="text-xs font-semibold text-fg block mb-1">
                Amount ({currency}) <span className="text-danger">*</span>
              </label>
              <div className="flex gap-1.5 mb-2 flex-wrap">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(q))}
                    className="text-xs px-2.5 py-1 rounded-lg bg-surface border border-line text-fg font-mono hover:border-accent/50"
                  >
                    +${q}
                  </button>
                ))}
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="29.00"
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm font-mono focus:outline-none focus:border-accent"
              />
            </div>

            {/* Date & Recurring Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-fg block mb-1">Expense Date</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-4 h-4 rounded bg-bg border-line text-accent focus:ring-accent"
                  />
                  <span className="text-xs font-semibold text-fg flex items-center gap-1">
                    <Repeat className="w-3.5 h-3.5 text-accent" /> Recurring Monthly Subscription
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-line flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="border-line text-fg"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold">
                {saving ? "Saving..." : "Record Expense & Open"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* 2. EXPENSE DETAIL MODAL (Auto opens on click or create)     */}
      {/* ============================================================ */}
      {selectedExpense && (
        <Dialog open={Boolean(selectedExpense)} onOpenChange={(open) => !open && setSelectedExpense(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <div>
                  <DialogTitle className="text-xl font-bold">
                    {selectedExpense.description || selectedExpense.category || "Expense"}
                  </DialogTitle>
                  <Badge variant="outline" className="border-line font-mono text-xs mt-1">
                    {selectedExpense.category || "General"}
                  </Badge>
                </div>
                <span className="text-2xl font-mono font-bold text-accent">
                  {money(Number(selectedExpense.amount) || 0)}
                </span>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Key Details Card */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-surface/80 border border-line text-xs">
                <div>
                  <span className="text-muted font-medium block">Date Recorded</span>
                  <span className="text-fg font-semibold mt-0.5 block">
                    {new Date(selectedExpense.created_at || Date.now()).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-muted font-medium block">Tax Status</span>
                  <span className="text-ok font-semibold mt-0.5 block flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> 100% Tax Deductible
                  </span>
                </div>
              </div>

              {/* Recurring Toggle Action */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-card border border-line">
                <div className="flex items-center gap-2.5">
                  <Repeat className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-xs font-bold text-fg">Monthly Subscription</p>
                    <p className="text-[11px] text-muted">
                      {selectedExpense.is_recurring ? "Counts toward monthly run rate" : "One-time purchase"}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleRecurring(selectedExpense)}
                  className="text-xs border-line text-fg"
                >
                  {selectedExpense.is_recurring ? "Make One-Time" : "Make Recurring"}
                </Button>
              </div>

              {/* Action Footer */}
              <div className="pt-4 border-t border-line flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteExpense(selectedExpense.id)}
                  className="text-danger hover:bg-danger/10 hover:text-danger text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete Expense
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedExpense(null)}
                  className="border-line text-fg"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
