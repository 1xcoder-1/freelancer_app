"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Save,
  CalendarDays,
  RefreshCw,
  Unplug,
  Video,
  Loader2,
} from "@/components/animated-icons";
import { Button } from "@/components/ui/button";
import { useAuth } from "@clerk/nextjs";
import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
  getGoogleCalendarStatus,
  startGoogleCalendarConnect,
  syncGoogleCalendar,
  disconnectGoogleCalendar,
  setGoogleMeetEnabled,
  type GoogleConnectionStatus,
} from "@/lib/api";
import { invalidateCache } from "@/hooks/use-api-data";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useWorkspaceCurrency } from "@/hooks/use-workspace-currency";
import { CURRENCY_CODES } from "@/lib/currency";
import { confirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { z } from "zod";
import { validateOrToast, nameSchema } from "@/lib/validation";
import { logHandledError } from "@/lib/log-error";
import { FeatureVisibilityTab } from "@/components/dashboard/FeatureVisibilityTab";

const workspaceSchema = z.object({
  businessName: nameSchema("Business name", 150),
});

interface WorkspaceConfig {
  businessName: string;
  professionalTitle: string;
  taxId: string;
  currency: string;
  defaultHourlyRate: number;
}

const DEFAULT_CONFIG: WorkspaceConfig = {
  businessName: "",
  professionalTitle: "",
  taxId: "",
  currency: "USD",
  defaultHourlyRate: 0,
};

const CURRENCY_LABELS: Record<string, string> = {
  USD: "USD ($) - US Dollar",
  EUR: "EUR (€) - Euro",
  GBP: "GBP (£) - British Pound",
  CAD: "CAD (CA$) - Canadian Dollar",
  AUD: "AUD (A$) - Australian Dollar",
  PKR: "PKR (Rs) - Pakistani Rupee",
  INR: "INR (₹) - Indian Rupee",
};

/** Workspace-level settings (business identity, currency, integrations,
 * feature visibility) — the original settings page, reborn as one tab. */
export function WorkspaceTab({ onLoaded }: { onLoaded?: () => void }) {
  const { getToken } = useAuth();
  const { setCurrency } = useWorkspaceCurrency();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<WorkspaceConfig>(DEFAULT_CONFIG);
  const [google, setGoogle] = useState<GoogleConnectionStatus | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const configValues = useMemo<Record<string, unknown>>(() => ({ ...config }), [config]);
  const guard = useUnsavedChangesGuard({
    values: configValues,
    enabled: !loading,
    draftKey: "workspace-settings",
    onRestoreDraft: useCallback((draft: Record<string, unknown>) => {
      setConfig((prev) => ({
        businessName: typeof draft.businessName === "string" ? draft.businessName : prev.businessName,
        professionalTitle: typeof draft.professionalTitle === "string" ? draft.professionalTitle : prev.professionalTitle,
        taxId: typeof draft.taxId === "string" ? draft.taxId : prev.taxId,
        currency: typeof draft.currency === "string" ? draft.currency : prev.currency,
        defaultHourlyRate: typeof draft.defaultHourlyRate === "number" ? draft.defaultHourlyRate : prev.defaultHourlyRate,
      }));
    }, []),
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = (await getToken()) || undefined;
        const ws = await getWorkspaceSettings(token);
        if (!mounted) return;
        setConfig({
          businessName: ws.business_name ?? "",
          professionalTitle: ws.professional_title ?? "",
          taxId: ws.tax_id ?? "",
          currency: ws.currency ?? "USD",
          defaultHourlyRate: ws.default_hourly_rate ?? 0,
        });
      } catch (err) {
        logHandledError("Failed to load workspace settings:", err);
      } finally {
        if (mounted) {
          setLoading(false);
          onLoaded?.();
        }
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const token = (await getToken()) || undefined;
        const status = await getGoogleCalendarStatus(token);
        if (mounted) setGoogle(status);
      } catch (err) {
        logHandledError("Failed to load Google Calendar status:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getToken]);

  const handleSave = async () => {
    if (!validateOrToast(workspaceSchema, {
      businessName: config.businessName,
    })) return;
    setSaving(true);
    try {
      const token = (await getToken()) || undefined;
      await updateWorkspaceSettings(
        {
          business_name: config.businessName,
          professional_title: config.professionalTitle,
          tax_id: config.taxId,
          currency: config.currency,
          default_hourly_rate: config.defaultHourlyRate,
        },
        token
      );
      setCurrency(config.currency);
      invalidateCache("dashboard:data");
      invalidateCache("dashboard:overview");
      guard.markSaved();
      toast.success("Workspace settings saved");
    } catch (err) {
      logHandledError("Failed to save workspace settings:", err);
      toast.error("Could not save settings. Please check your input and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleGoogleConnect = async () => {
    setGoogleBusy(true);
    try {
      const token = (await getToken()) || undefined;
      const { auth_url } = await startGoogleCalendarConnect(token);
      window.location.href = auth_url;
    } catch (err) {
      logHandledError("Failed to start Google connect:", err);
      toast.error(err instanceof Error ? err.message : "Could not start Google connect");
      setGoogleBusy(false);
    }
  };

  const handleGoogleSync = async () => {
    setGoogleBusy(true);
    try {
      const token = (await getToken()) || undefined;
      const res = await syncGoogleCalendar(token);
      toast.success(`Synced: ${res.created} new, ${res.updated} updated`);
      const token2 = (await getToken()) || undefined;
      setGoogle(await getGoogleCalendarStatus(token2));
    } catch (err) {
      logHandledError("Google sync failed:", err);
      toast.error("Google sync failed");
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    const ok = await confirmDialog({
      title: "Disconnect Google Calendar",
      message: "Your Google meetings will stop appearing in the calendar, and new bookings won't get Meet links. You can reconnect any time.",
      confirmLabel: "Disconnect",
      danger: true,
    });
    if (!ok) return;
    setGoogleBusy(true);
    try {
      const token = (await getToken()) || undefined;
      await disconnectGoogleCalendar(token);
      setGoogle(await getGoogleCalendarStatus(token));
      toast.success("Google Calendar disconnected");
    } catch (err) {
      logHandledError("Failed to disconnect Google Calendar:", err);
      toast.error("Could not disconnect Google Calendar");
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleMeetToggle = async () => {
    if (!google?.connected) return;
    const next = !google.meet_enabled;
    setGoogleBusy(true);
    setGoogle({ ...google, meet_enabled: next });
    try {
      const token = (await getToken()) || undefined;
      const saved = await setGoogleMeetEnabled(next, token);
      setGoogle(saved);
      toast.success(next
        ? "Google Meet links will be added to new bookings"
        : "New bookings won't get a Google Meet link");
    } catch (err) {
      logHandledError("Failed to update Google Meet:", err);
      setGoogle((prev) => (prev ? { ...prev, meet_enabled: !next } : prev));
      toast.error("Could not update Google Meet");
    } finally {
      setGoogleBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 animate-pulse">
        <div className="h-10 rounded-xl bg-surface" />
        <div className="h-10 rounded-xl bg-surface" />
        <div className="h-10 rounded-xl bg-surface" />
        <div className="h-10 rounded-xl bg-surface" />
        <div className="sm:col-span-2 h-32 rounded-2xl bg-surface" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
        <div>
          <label className="text-xs font-semibold text-fg block mb-0.5">
            Business / Display Name
          </label>
          <input
            type="text"
            value={config.businessName}
            onChange={(e) => setConfig({ ...config, businessName: e.target.value })}
            className="w-full bg-transparent border-0 border-b border-line py-2 text-sm text-fg placeholder:text-muted/60 focus:outline-none focus:border-accent transition-colors"
            placeholder="e.g. Nexus Design Studio"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-fg block mb-0.5">
            Professional Title
          </label>
          <input
            type="text"
            value={config.professionalTitle}
            onChange={(e) => setConfig({ ...config, professionalTitle: e.target.value })}
            className="w-full bg-transparent border-0 border-b border-line py-2 text-sm text-fg placeholder:text-muted/60 focus:outline-none focus:border-accent transition-colors"
            placeholder="e.g. Senior Full-Stack Engineer"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-fg block mb-0.5">
            Tax ID / VAT Registration
          </label>
          <input
            type="text"
            value={config.taxId}
            onChange={(e) => setConfig({ ...config, taxId: e.target.value })}
            className="w-full bg-transparent border-0 border-b border-line py-2 text-sm text-fg placeholder:text-muted/60 focus:outline-none focus:border-accent transition-colors"
            placeholder="e.g. US-EIN-948201"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-fg block mb-0.5">
            Primary Currency
          </label>
          <select
            value={config.currency}
            onChange={(e) => setConfig({ ...config, currency: e.target.value })}
            className="w-full bg-transparent border-0 border-b border-line py-2 text-sm text-fg focus:outline-none focus:border-accent transition-colors cursor-pointer"
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code} className="bg-card text-fg">
                {CURRENCY_LABELS[code]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-fg block mb-0.5">
            Default Rate ({config.currency})
          </label>
          <input
            type="number"
            min="0"
            value={config.defaultHourlyRate || ""}
            onChange={(e) => setConfig({ ...config, defaultHourlyRate: Number(e.target.value) || 0 })}
            className="w-full bg-transparent border-0 border-b border-line py-2 text-sm text-fg placeholder:text-muted/60 focus:outline-none focus:border-accent transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="e.g. 50"
          />
        </div>
      </div>

      {/* Integrations — Google Calendar & Meet */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-bg border border-line">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-accent-soft text-accent shrink-0">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-fg flex items-center gap-2">
                Google Calendar
                {google?.connected && (
                  <span className="flex items-center gap-1.5 text-[10px] font-mono text-ok">
                    <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
                    Connected
                  </span>
                )}
              </div>
              <div className="text-xs text-muted truncate">
                {google === null
                  ? "Checking connection…"
                  : !google.configured
                    ? "Not configured on this server (needs GOOGLE_CLIENT_ID / SECRET)."
                    : google.connected
                      ? (google.google_email || "Google account")
                      : "Sync events and bookings with your Google account."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {google?.configured && !google.connected && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGoogleConnect}
                disabled={googleBusy}
                className="rounded-lg border-line-strong text-fg hover:bg-surface gap-1.5"
              >
                {googleBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5 text-accent" />}
                Connect
              </Button>
            )}
            {google?.connected && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGoogleSync}
                  disabled={googleBusy}
                  className="rounded-lg border-line-strong text-fg hover:bg-surface gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${googleBusy ? "animate-spin" : ""}`} />
                  Sync Now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGoogleDisconnect}
                  disabled={googleBusy}
                  className="rounded-lg border-line-strong text-fg hover:bg-surface gap-1.5"
                >
                  <Unplug className="w-3.5 h-3.5 text-danger" />
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-bg border border-line">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${google?.connected && google.meet_enabled ? "bg-accent-soft text-accent" : "bg-surface text-muted"}`}>
              <Video className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-fg flex items-center gap-2">
                Google Meet
                {google?.connected && (
                  <span className="text-[10px] font-mono text-muted">
                    {google.meet_enabled ? "On" : "Off"}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted">
                {!google?.connected
                  ? "Connect Google Calendar to add automatic Meet links to bookings."
                  : google.meet_enabled
                    ? "New bookings get a real Google Meet link automatically."
                    : "New bookings won't get a Meet link. Calendar events still sync."}
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(google?.connected && google.meet_enabled)}
            disabled={!google?.connected || googleBusy}
            onClick={handleMeetToggle}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
              google?.connected && google.meet_enabled ? "bg-accent" : "bg-line"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                google?.connected && google.meet_enabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Feature visibility — rendered only for the owner account */}
      <FeatureVisibilityTab />

      <div className="flex justify-end pt-2 border-t border-dashed border-line">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-accent hover:bg-accent-hi text-accent-fg font-semibold shadow-sm rounded-full"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? "Saving…" : "Save Workspace"}
        </Button>
      </div>
    </div>
  );
}
