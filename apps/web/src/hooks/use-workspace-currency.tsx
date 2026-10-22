"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { getWorkspaceSettings } from "@/lib/api";
import { logHandledError } from "@/lib/log-error";

interface WorkspaceCurrencyContextValue {
  currency: string;
  setCurrency: (currency: string) => void;
  ready: boolean;
}

const WorkspaceCurrencyContext = createContext<WorkspaceCurrencyContextValue>({
  currency: "USD",
  setCurrency: () => {},
  ready: false,
});

// The workspace currency is mirrored in localStorage and read through
// useSyncExternalStore, so an unreachable API still renders amounts in the
// last-known currency instead of falling back to USD.
const STORAGE_KEY = "fb.workspaceCurrency";

const currencyListeners = new Set<() => void>();

function subscribeToStoredCurrency(onChange: () => void): () => void {
  currencyListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    currencyListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readStoredCurrency(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "USD";
  } catch {
    return "USD";
  }
}

function getServerCurrency(): string {
  return "USD";
}

function writeStoredCurrency(code: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // private mode / quota — the fetched value still governs this session
  }
  currencyListeners.forEach((notify) => notify());
}

// Loaded once per dashboard session; Settings calls setCurrency on save so
// every mounted page re-renders with the new currency immediately.
export function WorkspaceCurrencyProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const currency = useSyncExternalStore(
    subscribeToStoredCurrency,
    readStoredCurrency,
    getServerCurrency
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = (await getToken()) || undefined;
        const ws = await getWorkspaceSettings(token);
        if (mounted && ws?.currency) writeStoredCurrency(ws.currency);
      } catch (err) {
        logHandledError("Failed to load workspace currency:", err);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getToken]);

  const setCurrency = useCallback((c: string) => writeStoredCurrency(c), []);
  const value = useMemo(() => ({ currency, setCurrency, ready }), [currency, setCurrency, ready]);

  return <WorkspaceCurrencyContext.Provider value={value}>{children}</WorkspaceCurrencyContext.Provider>;
}

export function useWorkspaceCurrency(): WorkspaceCurrencyContextValue {
  return useContext(WorkspaceCurrencyContext);
}
