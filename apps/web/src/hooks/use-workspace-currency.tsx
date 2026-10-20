"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

// Loaded once per dashboard session; Settings calls setCurrency on save so
// every mounted page re-renders with the new currency immediately.
export function WorkspaceCurrencyProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const [currency, setCurrencyState] = useState("USD");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = (await getToken()) || undefined;
        const ws = await getWorkspaceSettings(token);
        if (mounted && ws?.currency) setCurrencyState(ws.currency);
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

  const setCurrency = useCallback((c: string) => setCurrencyState(c), []);
  const value = useMemo(() => ({ currency, setCurrency, ready }), [currency, setCurrency, ready]);

  return <WorkspaceCurrencyContext.Provider value={value}>{children}</WorkspaceCurrencyContext.Provider>;
}

export function useWorkspaceCurrency(): WorkspaceCurrencyContextValue {
  return useContext(WorkspaceCurrencyContext);
}
