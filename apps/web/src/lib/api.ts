import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export interface HealthCheckResponse {
  status: string;
  service: string;
  timestamp: string;
  version: string;
}

export interface SystemStatusResponse {
  app_name: string;
  environment: string;
  database: string;
  auth: string;
  modules: string[];
}

export interface DashboardStats {
  monthly_revenue: number;
  revenue_growth_pct: number;
  active_projects_count: number;
  billable_hours_this_month: number;
  effective_hourly_rate: number;
  pending_invoices_amount: number;
  pending_invoices_count: number;
  active_clients_count: number;
  currency: string;
  timestamp: string;
  user_email: string;
}

export interface DashboardProject {
  id: string;
  title: string;
  client_name: string;
  status: string;
  progress_pct: number;
  budget: number;
  tracked_hours: number;
  due_date: string;
}

export interface DashboardInvoice {
  id: string;
  number: string;
  client: string;
  amount: number;
  status: string;
  issue_date: string;
}

export interface DashboardTimeEntry {
  id: string;
  project: string;
  task: string;
  duration: string;
  billable: boolean;
  date: string;
}

export interface DashboardOverview {
  summary: {
    monthly_revenue: number;
    active_projects: number;
    billable_hours: number;
    effective_rate: number;
  };
  recent_projects: DashboardProject[];
  recent_invoices: DashboardInvoice[];
  recent_time_entries: DashboardTimeEntry[];
  active_focus_timer: {
    is_running: boolean;
    project_name: string;
    task_name: string;
    elapsed_seconds: number;
    started_at: string;
  };
}

export const checkBackendHealth = async (): Promise<HealthCheckResponse> => {
  const response = await apiClient.get<HealthCheckResponse>('/health');
  return response.data;
};

export const getSystemStatus = async (): Promise<SystemStatusResponse> => {
  const response = await apiClient.get<SystemStatusResponse>('/status');
  return response.data;
};

export const getDashboardStats = async (token?: string): Promise<DashboardStats> => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await apiClient.get<DashboardStats>('/dashboard/stats', { headers });
  return response.data;
};

export const getDashboardOverview = async (token?: string): Promise<DashboardOverview> => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await apiClient.get<DashboardOverview>('/dashboard/overview', { headers });
  return response.data;
};

export const startFocusTimer = async (project_name: string, task_name: string, token?: string) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await apiClient.post('/dashboard/timer/start', { project_name, task_name }, { headers });
  return response.data;
};

export const stopFocusTimer = async (token?: string) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await apiClient.post('/dashboard/timer/stop', {}, { headers });
  return response.data;
};

export { cn } from './utils';
