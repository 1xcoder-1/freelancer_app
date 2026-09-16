'use client';

import { useState, useEffect } from 'react';
import { checkBackendHealth, getSystemStatus, HealthCheckResponse, SystemStatusResponse } from '@/lib/api';

export function BackendStatus() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const healthData = await checkBackendHealth();
      const statusData = await getSystemStatus();
      setHealth(healthData);
      setStatus(statusData);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Python FastAPI backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="p-6 max-w-2xl mx-auto my-8 bg-slate-900 border border-slate-800 rounded-xl text-white shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold tracking-tight text-emerald-400">
          Freelance Book Core Connection
        </h2>
        <button
          onClick={fetchStatus}
          className="px-3 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors"
        >
          Refresh Connection
        </button>
      </div>

      {loading && (
        <div className="flex items-center space-x-2 text-slate-400 text-sm">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Connecting to Python FastAPI backend...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800/50 rounded-lg text-red-300 text-sm">
          <p className="font-semibold mb-1">Backend Unreachable</p>
          <p>{error}</p>
          <p className="text-xs text-red-400 mt-2">
            Make sure FastAPI is running via: <code className="bg-slate-950 px-1 py-0.5 rounded">pnpm dev:api</code>
          </p>
        </div>
      )}

      {health && status && (
        <div className="space-y-4 text-sm">
          <div className="flex items-center space-x-2 text-emerald-400">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold">Connected to {status.app_name}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-slate-300">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-500 block">Service Status</span>
              <span className="font-medium text-emerald-400">{health.status}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-500 block">Environment</span>
              <span className="font-medium capitalize">{status.environment}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-500 block">Auth Engine</span>
              <span className="font-medium capitalize">{status.auth}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-500 block">API Version</span>
              <span className="font-medium">{health.version}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-slate-500 block mb-2">Active Backend Modules</span>
            <div className="flex flex-wrap gap-1.5">
              {status.modules.map((mod: string) => (
                <span
                  key={mod}
                  className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-md text-xs font-mono border border-slate-700"
                >
                  {mod}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
