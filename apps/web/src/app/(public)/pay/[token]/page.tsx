"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Receipt,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Loader2,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  getPublicInvoice,
  recordPublicInvoicePayment,
  type PublicInvoice,
} from "@/lib/api";

const METHODS: { value: string; label: string }[] = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

function money(n?: number): string {
  return `$${(n ?? 0).toFixed(2)}`;
}

export default function PublicPaymentPage() {
  const params = useParams();
  const token = params?.token as string;

  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [paying, setPaying] = useState(false);
  const [justPaid, setJustPaid] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getPublicInvoice(token);
      setInvoice(data);
      // Default the amount field to whatever is still owed.
      setAmount((prev) => (prev === "" ? data.amount_due.toFixed(2) : prev));
    } catch (err: any) {
      setError(err?.message || "This payment link is not valid.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    // Lightweight real-time: re-pull every 15s so a payment made in another tab
    // is reflected without a manual refresh.
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }
    setPaying(true);
    setError(null);
    try {
      await recordPublicInvoicePayment(token, {
        amount: value,
        method,
        reference: reference || undefined,
      });
      setJustPaid(true);
      await load();
    } catch (err: any) {
      setError(err?.message || "We could not record that payment. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Card className="w-full max-w-xl bg-card border-line p-8 space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4 text-fg">
        <Card className="w-full max-w-md bg-card border-line p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-danger mx-auto" />
          <h2 className="text-xl font-bold">Payment Link Unavailable</h2>
          <p className="text-sm text-muted">{error}</p>
        </Card>
      </div>
    );
  }

  if (!invoice) return null;

  const isPaid = invoice.status === "paid" || invoice.amount_due <= 0.009;

  return (
    <div className="min-h-screen bg-bg text-fg flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-xl space-y-6">
        <Card className="bg-card border-line p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-accent" />
              <h1 className="text-lg font-bold">Invoice {invoice.invoice_number}</h1>
            </div>
            <Badge
              className={
                isPaid
                  ? "bg-ok/10 text-ok border-ok/20 font-semibold"
                  : "bg-warn/10 text-warn border-warn/20 font-semibold"
              }
            >
              {isPaid ? "Paid" : invoice.status}
            </Badge>
          </div>
          <p className="text-sm text-muted mt-1">
            Billed to <span className="text-fg font-medium">{invoice.client_name || "you"}</span>
            {invoice.due_date ? ` · Due ${new Date(invoice.due_date).toLocaleDateString()}` : ""}
          </p>

          {/* Line items */}
          <div className="mt-5 rounded-xl border border-line divide-y divide-line">
            {invoice.items.map((it) => (
              <div key={it.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-fg">{it.description}</span>
                <span className="font-mono text-muted">{money(it.amount)}</span>
              </div>
            ))}
          </div>

          {/* Money summary */}
          <div className="mt-4 p-4 rounded-xl bg-bg border border-line space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-faint">Total</span>
              <span className="font-mono text-fg">{money(invoice.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">Paid</span>
              <span className="font-mono text-ok">{money(invoice.amount_paid)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-line">
              <span className="text-muted font-semibold">Amount due</span>
              <span className="font-mono text-lg font-bold text-accent">{money(invoice.amount_due)}</span>
            </div>
          </div>
        </Card>

        {justPaid && (
          <Card className="bg-card border-line p-5 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-ok mx-auto" />
            <p className="font-semibold text-fg">Payment recorded — thank you!</p>
            <p className="text-xs text-muted">
              Your payment has been noted on this invoice. The freelancer has been notified.
            </p>
          </Card>
        )}

        {!isPaid ? (
          <Card className="bg-card border-line p-6">
            <h2 className="text-base font-bold mb-4">Pay this invoice</h2>
            <form onSubmit={handlePay} className="space-y-4">
              <div>
                <label className="text-xs text-muted font-medium">Amount ({invoice.currency})</label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted font-medium">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-bg border border-line px-3 py-2 text-sm text-fg"
                >
                  {METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted font-medium">Reference (optional)</label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Transaction / cheque number"
                  className="mt-1"
                />
              </div>

              <Button type="submit" disabled={paying} className="w-full">
                {paying ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Recording…</span>
                ) : (
                  `Record payment of ${money(parseFloat(amount) || 0)}`
                )}
              </Button>
              {error && <p className="text-xs text-danger text-center">{error}</p>}

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-faint pt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                This is a secure payment confirmation for the exact invoice above.
              </div>
            </form>
          </Card>
        ) : (
          <Card className="bg-card border-line p-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-ok mx-auto" />
            <p className="font-semibold text-fg">This invoice is fully paid.</p>
            <p className="text-xs text-muted">Nothing further is due.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
