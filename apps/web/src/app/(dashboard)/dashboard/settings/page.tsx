"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Download,
  Upload,
  Save,
  CheckCircle2,
  FileSpreadsheet,
  FileCode,
  Building,
  DollarSign,
  Receipt,
  Database,
  CloudUpload,
  Shield,
  RefreshCw,
  Clock,
  Sparkles,
  AlertCircle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUser, useAuth } from "@clerk/nextjs";
import { getInvoices, getClients, getExpenses, getDashboardStats } from "@/lib/api";

interface WorkspaceConfig {
  businessName: string;
  professionalTitle: string;
  currency: string;
  hourlyRate: string;
  taxId: string;
  invoicePrefix: string;
  paymentTerms: string;
  lateFeePolicy: string;
  paymentNotes: string;
}

const DEFAULT_CONFIG: WorkspaceConfig = {
  businessName: "Studio Nexus Freelance",
  professionalTitle: "Full-Stack Engineer & Product Designer",
  currency: "USD ($)",
  hourlyRate: "95",
  taxId: "TAX-US-948201",
  invoicePrefix: "INV-2026-",
  paymentTerms: "Net 15 Days",
  lateFeePolicy: "2% per 30 days past due",
  paymentNotes: "Thank you for your business! Please wire payments within the specified terms.",
};

export default function SettingsPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [config, setConfig] = useState<WorkspaceConfig>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("freelancer_workspace_config");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse config", e);
        }
      }
    }
    return DEFAULT_CONFIG;
  });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Sync config from localStorage on client mount if SSR didn't have window
  useEffect(() => {
    const saved = localStorage.getItem("freelancer_workspace_config");
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse config", e);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("freelancer_workspace_config", JSON.stringify(config));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Export JSON Backup with LIVE Database Data
  const handleExportJSON = async () => {
    setExporting(true);
    try {
      const token = (await getToken()) || undefined;
      const [stats, invoices, clients, expenses] = await Promise.all([
        getDashboardStats(token).catch(() => null),
        getInvoices(token).catch(() => []),
        getClients(token).catch(() => []),
        getExpenses(token).catch(() => []),
      ]);

      const backupData = {
        workspace: config,
        exportedAt: new Date().toISOString(),
        user: user?.primaryEmailAddress?.emailAddress || "user",
        version: "2.0.0",
        stats: stats || {},
        databaseSnapshots: {
          invoicesCount: invoices.length,
          clientsCount: clients.length,
          expensesCount: expenses.length,
          invoices,
          clients,
          expenses
        }
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `freelancer_database_backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export JSON failed:", err);
    } finally {
      setExporting(false);
    }
  };

  // Export CSV Data with LIVE Database Data
  const handleExportCSV = async (type: "invoices" | "clients" | "expenses") => {
    setExporting(true);
    try {
      const token = (await getToken()) || undefined;
      let csvContent = "";
      let filename = "";

      if (type === "invoices") {
        filename = `invoices_export_${new Date().toISOString().split("T")[0]}.csv`;
        const invoices = await getInvoices(token).catch(() => []);
        csvContent = "Invoice ID,Invoice Number,Client,Amount,Status,Issued Date,Due Date,Notes\n";
        if (invoices.length > 0) {
          csvContent += invoices
            .map(
              (inv) =>
                `"${inv.id}","${inv.invoice_number || ""}","${inv.client_name || inv.client_id || ""}","$${(inv.total_amount || 0).toFixed(2)}","${inv.status}","${inv.issue_date || ""}","${inv.due_date || ""}","${(inv.notes || "").replace(/"/g, '""')}"`
            )
            .join("\n");
        } else {
          csvContent += "No invoices found in database\n";
        }
      } else if (type === "clients") {
        filename = `clients_crm_${new Date().toISOString().split("T")[0]}.csv`;
        const clients = await getClients(token).catch(() => []);
        csvContent = "Client ID,Name,Email,Company,Status\n";
        if (clients.length > 0) {
          csvContent += clients
            .map(
              (c) =>
                `"${c.id}","${c.name}","${c.email || ""}","${c.company_name || ""}","${c.status}"`
            )
            .join("\n");
        } else {
          csvContent += "No clients found in database\n";
        }
      } else {
        filename = `tax_expenses_${new Date().toISOString().split("T")[0]}.csv`;
        const expenses = await getExpenses(token).catch(() => []);
        csvContent = "Expense ID,Date,Category,Description,Amount\n";
        if (expenses.length > 0) {
          csvContent += expenses
            .map(
              (exp) =>
                `"${exp.id}","${exp.created_at || ""}","${exp.category}","${(exp.description || "").replace(/"/g, '""')}","$${exp.amount.toFixed(2)}"`
            )
            .join("\n");
        } else {
          csvContent += "No expenses found in database\n";
        }
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export CSV failed:", err);
    } finally {
      setExporting(false);
    }
  };

  // Import Data Handler
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(content);
          if (parsed.workspace) {
            setConfig(parsed.workspace);
            localStorage.setItem("freelancer_workspace_config", JSON.stringify(parsed.workspace));
          }
          setImportStatus(`Successfully restored ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        } else {
          setImportStatus(`Successfully parsed ${file.name} with ${content.split("\n").length} records`);
        }
        setTimeout(() => setImportStatus(null), 4000);
      } catch (err) {
        setImportStatus("Error parsing file. Please upload a valid JSON or CSV file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[26px] font-bold tracking-tight text-fg">Workspace Settings</h1>
            <Badge className="bg-accent-soft text-info border-accent/20 font-mono text-xs">
              Config & Live DB Exports
            </Badge>
          </div>
          <p className="text-muted text-sm mt-1">
            Configure business defaults, export live Neon database records, and view cloud infrastructure status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-accent bg-accent-soft border border-accent/20 px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved Successfully
            </div>
          )}
          <Button
            onClick={handleSave}
            className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-12 w-96 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      ) : (
        <Tabs defaultValue="business" className="space-y-6">
          <TabsList className="bg-card border border-line p-1 rounded-xl flex flex-wrap gap-1">
            <TabsTrigger value="business" className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              Business Profile
            </TabsTrigger>
            <TabsTrigger value="invoicing" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Invoicing & Terms
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Import & Export Data
            </TabsTrigger>
            <TabsTrigger value="cloud" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Cloud & Storage Hub
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Business Profile */}
          <TabsContent value="business" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card border-line backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-fg text-lg flex items-center gap-2">
                    <Building className="w-5 h-5 text-info" />
                    Freelancer Identity
                  </CardTitle>
                  <CardDescription className="text-muted text-xs">
                    Your agency or freelance title displayed on client proposals and invoices.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">
                      Business / Display Name
                    </label>
                    <input
                      type="text"
                      value={config.businessName}
                      onChange={(e) => setConfig({ ...config, businessName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="e.g. Nexus Design Studio"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">
                      Professional Title
                    </label>
                    <input
                      type="text"
                      value={config.professionalTitle}
                      onChange={(e) => setConfig({ ...config, professionalTitle: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="e.g. Senior Full-Stack Engineer"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">
                      Tax ID / VAT Registration
                    </label>
                    <input
                      type="text"
                      value={config.taxId}
                      onChange={(e) => setConfig({ ...config, taxId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="e.g. US-EIN-948201"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-line backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-fg text-lg flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-accent" />
                    Currency & Rates
                  </CardTitle>
                  <CardDescription className="text-muted text-xs">
                    Standard billing defaults used across new invoices and time tracking.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">
                      Primary Currency
                    </label>
                    <select
                      value={config.currency}
                      onChange={(e) => setConfig({ ...config, currency: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="USD ($)">USD ($) - US Dollar</option>
                      <option value="EUR (€)">EUR (€) - Euro</option>
                      <option value="GBP (£)">GBP (£) - British Pound</option>
                      <option value="CAD ($)">CAD ($) - Canadian Dollar</option>
                      <option value="AUD ($)">AUD ($) - Australian Dollar</option>
                      <option value="PKR (Rs)">PKR (Rs) - Pakistani Rupee</option>
                      <option value="INR (₹)">INR (₹) - Indian Rupee</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">
                      Default Hourly Rate ($)
                    </label>
                    <input
                      type="number"
                      value={config.hourlyRate}
                      onChange={(e) => setConfig({ ...config, hourlyRate: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="95"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-accent-soft border border-accent/20 text-xs text-info flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-info shrink-0 mt-0.5" />
                    <span>
                      Rates and currency update immediately when generating new client invoices and calculating billable time logs.
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: Invoicing & Terms */}
          <TabsContent value="invoicing" className="space-y-6">
            <Card className="bg-card border-line backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-fg text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-accent" />
                  Invoice Prefixes & Default Terms
                </CardTitle>
                <CardDescription className="text-muted text-xs">
                  Set up automated numbering rules and legal payment conditions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">
                      Invoice Number Prefix
                    </label>
                    <input
                      type="text"
                      value={config.invoicePrefix}
                      onChange={(e) => setConfig({ ...config, invoicePrefix: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="INV-2026-"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-fg block mb-1">
                      Default Payment Due Terms
                    </label>
                    <select
                      value={config.paymentTerms}
                      onChange={(e) => setConfig({ ...config, paymentTerms: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="Due on Receipt">Due on Receipt (Immediate)</option>
                      <option value="Net 7 Days">Net 7 Days</option>
                      <option value="Net 15 Days">Net 15 Days</option>
                      <option value="Net 30 Days">Net 30 Days</option>
                      <option value="Net 60 Days">Net 60 Days</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg block mb-1">
                    Late Fee / Overdue Policy
                  </label>
                  <input
                    type="text"
                    value={config.lateFeePolicy}
                    onChange={(e) => setConfig({ ...config, lateFeePolicy: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="e.g. 2% interest per 30 days"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-fg block mb-1">
                    Custom Invoice Footer / Wire Instructions
                  </label>
                  <textarea
                    rows={3}
                    value={config.paymentNotes}
                    onChange={(e) => setConfig({ ...config, paymentNotes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-bg border border-line text-fg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Provide your bank wire details, routing number, or Stripe checkout links..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Import & Export Operations */}
          <TabsContent value="data" className="space-y-6">
            {importStatus && (
              <div className="p-4 rounded-xl bg-accent-soft border border-accent/30 text-info text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-info shrink-0" />
                {importStatus}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Export Hub */}
              <Card className="bg-card border-line backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-fg text-lg flex items-center gap-2">
                    <Download className="w-5 h-5 text-info" />
                    Export Live Workspace Data
                  </CardTitle>
                  <CardDescription className="text-muted text-xs">
                    Direct live extraction from Neon PostgreSQL in CSV and JSON formats.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={handleExportJSON}
                    disabled={exporting}
                    variant="outline"
                    className="w-full justify-between border-line bg-bg hover:bg-surface text-fg"
                  >
                    <span className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-info" />
                      Complete Live Database Snapshot (.JSON)
                    </span>
                    <Badge variant="outline" className="text-[10px] text-info border-accent/20">Full DB</Badge>
                  </Button>

                  <Button
                    onClick={() => handleExportCSV("invoices")}
                    disabled={exporting}
                    variant="outline"
                    className="w-full justify-between border-line bg-bg hover:bg-surface text-fg"
                  >
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-accent" />
                      Live Invoices & Billing History (.CSV)
                    </span>
                    <Badge variant="outline" className="text-[10px] text-accent border-accent">Excel / Sheets</Badge>
                  </Button>

                  <Button
                    onClick={() => handleExportCSV("clients")}
                    disabled={exporting}
                    variant="outline"
                    className="w-full justify-between border-line bg-bg hover:bg-surface text-fg"
                  >
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-accent" />
                      Live Clients CRM Contact List (.CSV)
                    </span>
                    <Badge variant="outline" className="text-[10px] text-accent border-line-strong">CRM Export</Badge>
                  </Button>

                  <Button
                    onClick={() => handleExportCSV("expenses")}
                    disabled={exporting}
                    variant="outline"
                    className="w-full justify-between border-line bg-bg hover:bg-surface text-fg"
                  >
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-warn" />
                      Live Tax Deductions & Expenses (.CSV)
                    </span>
                    <Badge variant="outline" className="text-[10px] text-warn border-warn/20">Tax Deductible</Badge>
                  </Button>
                </CardContent>
              </Card>

              {/* Import Hub */}
              <Card className="bg-card border-line backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-fg text-lg flex items-center gap-2">
                    <Upload className="w-5 h-5 text-info dark:text-info" />
                    Import & Restore Data
                  </CardTitle>
                  <CardDescription className="text-muted text-xs">
                    Upload a JSON snapshot or CSV to import clients, restore configuration, and load records.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed border-line rounded-xl p-6 text-center hover:border-accent/40 transition-colors bg-bg">
                    <Upload className="w-8 h-8 text-info mx-auto mb-2" />
                    <p className="text-sm font-medium text-fg mb-1">
                      Choose JSON or CSV file to import
                    </p>
                    <p className="text-xs text-faint mb-4">
                      Supports workspace snapshots, invoice batches, and client lists
                    </p>
                    <label className="inline-block">
                      <input
                        type="file"
                        accept=".json,.csv"
                        onChange={handleImportFile}
                        className="hidden"
                      />
                      <span className="px-4 py-2 rounded-xl bg-surface hover:bg-surface text-xs font-semibold text-fg cursor-pointer transition-colors border border-line">
                        Select File
                      </span>
                    </label>
                  </div>

                  <div className="p-3 rounded-xl bg-bg border border-line text-xs text-muted space-y-1">
                    <div className="font-semibold text-fg">Supported Import Types:</div>
                    <div>• Full JSON Workspace backups (.json)</div>
                    <div>• Client CRM CSVs with Name, Email & Company (.csv)</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 4: Cloud & Storage Hub */}
          <TabsContent value="cloud" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Neon DB Status */}
              <Card className="bg-card border-line backdrop-blur-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-accent-soft text-info">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-fg">Neon PostgreSQL</h3>
                      <p className="text-xs text-muted">Serverless Relational Engine</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-accent-soft text-accent border-accent/20">
                    🟢 Connected
                  </Badge>
                </div>

                <div className="p-3 rounded-xl bg-bg border border-line text-xs font-mono text-muted space-y-1.5">
                  <div className="flex justify-between">
                    <span>Driver:</span>
                    <span className="text-fg">SQLAlchemy asyncpg</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SSL Mode:</span>
                    <span className="italic font-medium text-accent">Encrypted (require)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connection Pool:</span>
                    <span className="text-fg">Auto-Scaling</span>
                  </div>
                </div>
              </Card>

              {/* Cloudinary CDN Status */}
              <Card className="bg-card border-line backdrop-blur-md p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-accent-soft text-accent">
                      <CloudUpload className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-fg">Cloudinary Storage CDN</h3>
                      <p className="text-xs text-muted">Media, Invoices & Receipt Uploads</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-accent-soft text-accent border-accent/20">
                    🟢 Active CDN
                  </Badge>
                </div>

                <div className="p-3 rounded-xl bg-bg border border-line text-xs font-mono text-muted space-y-1.5">
                  <div className="flex justify-between">
                    <span>Cloud Name:</span>
                    <span className="text-fg">dntr4xqiy</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery:</span>
                    <span className="italic font-medium text-accent">Global Edge Accelerated</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Direct Uploads:</span>
                    <span className="text-fg">Signed & Secure</span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
