"use client";

import Link from "next/link";
import {
  FolderKanban,
  FileCheck2,
  Receipt,
  CreditCard,
} from "@/components/animated-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiData } from "@/hooks/use-api-data";
import { getClientRelationship } from "@/lib/api";

const formatMoney = (amount: number | null | undefined, currency = "USD") => {
  const symbolMap: Record<string, string> = {
    USD: "$",
    PKR: "Rs ",
    EUR: "€",
    GBP: "£",
    AED: "AED ",
    CAD: "CA$",
    AUD: "AU$",
  };
  const sym = symbolMap[currency] ?? `${currency} `;
  const val = amount ?? 0;
  return `${sym}${val.toLocaleString("en-US", {
    minimumFractionDigits: val % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

export function ClientProductivityTabs({ clientId }: { clientId: string }) {
  const { data, loading } = useApiData(
    `clients:relationship:${clientId}`,
    (token) => getClientRelationship(clientId, token),
    { pollMs: 15000, reportContext: "clients-relationship" }
  );

  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const currency = data?.currency || "USD";

  // Card 1: Projects
  const totalProjects = data?.total_projects ?? 0;
  const completedProjects = data?.completed_projects ?? 0;
  const openProjects = data?.open_projects ?? 0;

  // Card 2: Revenue / Paid Amount
  const totalRevenue = data?.total_revenue ?? 0;
  const paidAmount = data?.paid_amount ?? 0;
  const pendingAmount = data?.pending_amount ?? 0;

  // Card 3: Contracts
  const totalContracts = data?.total_contracts ?? 0;
  const signedContracts = data?.signed_contracts ?? 0;
  const pendingContracts = data?.pending_contracts ?? 0;

  // Card 4: Invoices
  const totalInvoices = data?.total_invoices ?? 0;
  const paidInvoices = data?.paid_invoices ?? 0;
  const pendingInvoices = data?.pending_invoices ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Projects Card */}
      <Link
        href={`/dashboard/projects?client=${clientId}`}
        className="group relative p-5 rounded-2xl border border-line bg-card hover:border-line-strong hover:bg-surface/40 transition-all flex flex-col justify-between shadow-xs"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg sm:text-xl font-medium tracking-wide text-fg leading-tight">
            Projects
          </h3>
          <FolderKanban className="w-5 h-5 text-muted/70 group-hover:text-accent transition-colors shrink-0 mt-0.5" />
        </div>

        <div className="my-3">
          <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg">
            {totalProjects}
          </div>
        </div>

        <div className="space-y-1 pt-1 text-xs text-muted/90 font-sans">
          <div className="flex items-center gap-1.5">
            <span>{completedProjects} Completed</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
          </div>
          <div className="flex items-center gap-1.5">
            <span>{openProjects} Pending</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block shrink-0" />
          </div>
        </div>
      </Link>

      {/* 2. Total Revenue / Financials Card */}
      <Link
        href={`/dashboard/invoices?client=${clientId}`}
        className="group relative p-5 rounded-2xl border border-line bg-card hover:border-line-strong hover:bg-surface/40 transition-all flex flex-col justify-between shadow-xs"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg sm:text-xl font-medium tracking-wide text-fg leading-tight">
            Total Revenue
          </h3>
          <CreditCard className="w-5 h-5 text-muted/70 group-hover:text-accent transition-colors shrink-0 mt-0.5" />
        </div>

        <div className="my-3">
          <div className="font-display text-2xl sm:text-3xl font-normal tracking-tight text-fg truncate">
            {formatMoney(totalRevenue, currency)}
          </div>
        </div>

        <div className="space-y-1 pt-1 text-xs text-muted/90 font-sans">
          <div className="flex items-center gap-1.5">
            <span>{formatMoney(paidAmount, currency)} Paid</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
          </div>
          <div className="flex items-center gap-1.5">
            <span>{formatMoney(pendingAmount, currency)} Unpaid</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block shrink-0" />
          </div>
        </div>
      </Link>

      {/* 3. Contracts Card */}
      <Link
        href={`/dashboard/contracts?client=${clientId}`}
        className="group relative p-5 rounded-2xl border border-line bg-card hover:border-line-strong hover:bg-surface/40 transition-all flex flex-col justify-between shadow-xs"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg sm:text-xl font-medium tracking-wide text-fg leading-tight">
            Contracts
          </h3>
          <FileCheck2 className="w-5 h-5 text-muted/70 group-hover:text-accent transition-colors shrink-0 mt-0.5" />
        </div>

        <div className="my-3">
          <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg">
            {totalContracts}
          </div>
        </div>

        <div className="space-y-1 pt-1 text-xs text-muted/90 font-sans">
          <div className="flex items-center gap-1.5">
            <span>{signedContracts} Signed</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
          </div>
          <div className="flex items-center gap-1.5">
            <span>{pendingContracts} Pending</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block shrink-0" />
          </div>
        </div>
      </Link>

      {/* 4. Invoices Card */}
      <Link
        href={`/dashboard/invoices?client=${clientId}`}
        className="group relative p-5 rounded-2xl border border-line bg-card hover:border-line-strong hover:bg-surface/40 transition-all flex flex-col justify-between shadow-xs"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg sm:text-xl font-medium tracking-wide text-fg leading-tight">
            Invoices
          </h3>
          <Receipt className="w-5 h-5 text-muted/70 group-hover:text-accent transition-colors shrink-0 mt-0.5" />
        </div>

        <div className="my-3">
          <div className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-fg">
            {totalInvoices}
          </div>
        </div>

        <div className="space-y-1 pt-1 text-xs text-muted/90 font-sans">
          <div className="flex items-center gap-1.5">
            <span>{paidInvoices} Paid</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
          </div>
          <div className="flex items-center gap-1.5">
            <span>{pendingInvoices} Unpaid</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block shrink-0" />
          </div>
        </div>
      </Link>
    </div>
  );
}
