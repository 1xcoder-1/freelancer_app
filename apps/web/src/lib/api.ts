import axios from 'axios';
import * as Sentry from '@sentry/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

function formatApiErrorMessage(error: any): string {
  if (!error) return 'An unexpected network error occurred. Please try again.';

  const data = error?.response?.data;
  if (data) {
    if (typeof data.detail === 'string' && data.detail.trim() && data.detail !== '[object Object]') {
      return data.detail.trim();
    }
    if (Array.isArray(data.detail)) {
      const messages = data.detail
        .map((d: any) => {
          if (typeof d === 'string' && d !== '[object Object]') return d;
          if (d && typeof d === 'object') {
            const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : '';
            const msg = d.msg || d.message || '';
            if (field && msg && field !== 'body') return `${field}: ${msg}`;
            if (msg) return msg;
          }
          return null;
        })
        .filter(Boolean);
      if (messages.length > 0) return messages.join(' • ');
    }
    if (typeof data.message === 'string' && data.message.trim() && data.message !== '[object Object]') {
      return data.message.trim();
    }
  }

  if (typeof error.message === 'string' && error.message.trim() && error.message !== '[object Object]') {
    return error.message;
  }

  return 'Unable to complete request. Please check your connection and try again.';
}

// Response interceptor for unified error formatting and resilience.
// The HTTP status is copied onto the thrown Error so callers can branch on
// 403/404/410 (e.g. revoked / expired share links) instead of parsing text.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const customMessage = formatApiErrorMessage(error);
    const wrapped = new Error(customMessage) as Error & {
      status?: number;
      response?: unknown;
    };
    wrapped.status = error?.response?.status;
    wrapped.response = error?.response;
    reportApiFailure(error, wrapped);
    return Promise.reject(wrapped);
  }
);

// Central Sentry reporting for background API failures: pages swallow errors
// to degrade gracefully (.catch(() => [])), so without this the SDK would
// never see outages. Only server-side failures are reported — 4xx responses
// are expected app states (expired share links, validation), and public
// anonymous endpoints failing 4xx would otherwise pollute the error feed.
// Metadata only: never the Authorization header or token contents.
interface AxiosFailureShape {
  response?: { status?: number };
  config?: {
    method?: string;
    url?: string;
    headers?: { Authorization?: string; get?: (name: string) => unknown };
  };
}

function reportApiFailure(axiosError: AxiosFailureShape, reportedError: Error): void {
  try {
    const status = axiosError?.response?.status;
    const isServerFailure = typeof status === 'number' ? status >= 500 : true;
    if (!isServerFailure) return;

    Sentry.withScope((scope) => {
      scope.setTag('error_type', 'api-request');
      scope.setContext('api', {
        method: axiosError?.config?.method?.toUpperCase?.() ?? axiosError?.config?.method,
        url: axiosError?.config?.url,
        status,
        hasAuthHeader: Boolean(axiosError?.config?.headers?.Authorization ?? axiosError?.config?.headers?.get?.('Authorization')),
      });
      Sentry.captureException(reportedError);
    });
  } catch {
    // Reporting must never break the request path.
  }
}

// Helper to attach authorization header
const authHeaders = (token?: string) => (token ? { headers: { Authorization: `Bearer ${token}` } } : {});

/** Error thrown by every API helper: `status` is the HTTP code (if any). */
export interface ApiError extends Error {
  status?: number;
  response?: { status?: number };
}

// ------------------------------------------------------------------------------
// Dashboard Overview & Stats
// ------------------------------------------------------------------------------
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

export const getDashboardStats = async (token?: string): Promise<DashboardStats> => {
  const response = await apiClient.get<DashboardStats>('/dashboard/stats', authHeaders(token));
  return response.data;
};

export const getDashboardOverview = async (token?: string): Promise<DashboardOverview> => {
  const response = await apiClient.get<DashboardOverview>('/dashboard/overview', authHeaders(token));
  return response.data;
};

// ------------------------------------------------------------------------------
// Clients CRM
// ------------------------------------------------------------------------------
export interface Client {
  id: string;
  workspace_id: string;
  name: string;
  company_name?: string;
  email: string;
  phone?: string;
  website?: string;
  status: string;
  notes?: string;
  health_score: number;
  // Revenue tracking (computed server-side from this client's invoices):
  // total_billed = non-draft invoices, total_paid = the settled subset.
  total_billed?: number;
  total_paid?: number;
  created_at: string;
}

export const getClients = async (token?: string): Promise<Client[]> => {
  const response = await apiClient.get<Client[]>('/clients', authHeaders(token));
  return response.data;
};

export const getClient = async (clientId: string, token?: string): Promise<Client> => {
  const response = await apiClient.get<Client>(`/clients/${clientId}`, authHeaders(token));
  return response.data;
};

export const createClient = async (payload: Partial<Client>, token?: string): Promise<Client> => {
  const response = await apiClient.post<Client>('/clients', payload, authHeaders(token));
  return response.data;
};

export const updateClient = async (clientId: string, payload: Partial<Client>, token?: string): Promise<Client> => {
  const response = await apiClient.patch<Client>(`/clients/${clientId}`, payload, authHeaders(token));
  return response.data;
};

export const deleteClient = async (clientId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/clients/${clientId}`, authHeaders(token));
};

// ------------------------------------------------------------------------------
// Lead Pipeline — client-acquisition CRM (stage board, follow-ups, insights)
// ------------------------------------------------------------------------------
export type LeadStage = 'new' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface Lead {
  id: string;
  workspace_id: string;
  name: string;
  company?: string | null;
  email: string;
  phone?: string | null;
  source?: string | null;
  stage: LeadStage;
  estimated_value: number;
  priority: 'low' | 'medium' | 'high';
  last_contact_at?: string | null;
  next_follow_up_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineInsights {
  total_leads: number;
  stage_counts: Record<string, number>;
  open_pipeline_value: number;
  weighted_pipeline_value: number;
  win_rate_pct: number;
  won_count: number;
  lost_count: number;
  due_follow_up_count: number;
  stale_deal_count: number;
  stale_after_days: number;
  due_follow_ups: Array<{ id: string; name: string; company?: string | null; stage: string; estimated_value: number; priority: string }>;
  stale_deals: Array<{ id: string; name: string; company?: string | null; stage: string; estimated_value: number; priority: string; days_since_contact: number }>;
  currency: string;
  timestamp: string;
}

export const getLeads = async (token?: string): Promise<Lead[]> => {
  const response = await apiClient.get<Lead[]>('/leads', authHeaders(token));
  return response.data;
};

export const getLead = async (leadId: string, token?: string): Promise<Lead> => {
  const response = await apiClient.get<Lead>(`/leads/${leadId}`, authHeaders(token));
  return response.data;
};

export const createLead = async (payload: Partial<Lead>, token?: string): Promise<Lead> => {
  const response = await apiClient.post<Lead>('/leads', payload, authHeaders(token));
  return response.data;
};

export const updateLead = async (leadId: string, payload: Partial<Lead>, token?: string): Promise<Lead> => {
  const response = await apiClient.patch<Lead>(`/leads/${leadId}`, payload, authHeaders(token));
  return response.data;
};

export const logLeadContact = async (
  leadId: string,
  payload: { note?: string; next_follow_up_at?: string },
  token?: string
): Promise<Lead> => {
  const response = await apiClient.post<Lead>(`/leads/${leadId}/log-contact`, payload, authHeaders(token));
  return response.data;
};

export const deleteLead = async (leadId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/leads/${leadId}`, authHeaders(token));
};

// One action turns a prospect into a roster client (idempotent by email —
// re-converting returns the existing client, never a duplicate).
export const convertLeadToClient = async (leadId: string, token?: string): Promise<Client> => {
  const response = await apiClient.post<Client>(`/leads/${leadId}/convert-to-client`, {}, authHeaders(token));
  return response.data;
};

export const getPipelineInsights = async (token?: string): Promise<PipelineInsights> => {
  const response = await apiClient.get<PipelineInsights>('/leads/insights', authHeaders(token));
  return response.data;
};

// ------------------------------------------------------------------------------
// Cash Flow Guard — receivables aging, 90-day forecast, safe-to-spend
// ------------------------------------------------------------------------------
export interface CashflowSummary {
  currency: string;
  bank_balance: number;
  bank_balance_updated_at: string | null;
  receivables_total: number;
  at_risk_total: number;
  aging: Record<'not_due_yet' | 'days_1_15' | 'days_16_30' | 'days_31_plus', { count: number; amount: number }>;
  overdue_invoices: Array<{ id: string; invoice_number: string; amount: number; due_date: string; days_overdue: number }>;
  // Cumulative cash expected within 14 / 30 / 60 days (not-yet-due invoices).
  expected_cash: { days_14: number; days_30: number; days_60: number };
  history_6m: Array<{ month: string; collected: number; expenses: number; net: number; invoiced: number }>;
  avg_monthly_collected: number;
  avg_monthly_expenses: number;
  monthly_burn_rate: number;
  weekly_burn_rate: number;
  // null = burn unknown (no expenses recorded yet), not "infinite".
  runway_weeks: number | null;
  runway_weeks_with_incoming: number | null;
  vacation_reserve_target: number;
  vacation_reserve_progress_pct: number | null;
  income_volatility_pct: number;
  avg_days_to_payment: number | null;
  forecast_90d: Array<{ month: string; expected_invoices: number; expected_new_work: number; total_expected: number }>;
  weighted_pipeline_value: number;
  safe_to_spend_next_30d: number;
  timestamp: string;
}

export const getCashflowSummary = async (token?: string): Promise<CashflowSummary> => {
  const response = await apiClient.get<CashflowSummary>('/cashflow/summary', authHeaders(token));
  return response.data;
};

// ------------------------------------------------------------------------------
// Projects & Tasks
// ------------------------------------------------------------------------------
export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  estimated_hours: number;
  created_at: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  amount: number;
  is_completed: boolean;
  deliverable_note?: string;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  client_id?: string;
  client_name?: string;
  title: string;
  description?: string;
  status: string;
  budget: number;
  hourly_rate: number;
  share_token: string;
  progress_pct: number;
  tracked_hours: number;
  tasks: Task[];
  milestones: Milestone[];
  created_at: string;
}

export interface PublicMilestone {
  id: string;
  title: string;
  description?: string;
  amount: number;
  is_completed: boolean;
  deliverable_note?: string;
  created_at: string;
}

export interface PublicProjectPortal {
  id: string;
  title: string;
  description?: string;
  status: string;
  budget: number;
  share_token: string;
  progress_pct: number;
  freelancer_name: string;
  client_name?: string;
  milestones: PublicMilestone[];
  completed_milestones_count: number;
  total_milestones_count: number;
  active_tasks_count: number;
  completed_tasks_count: number;
  contract_status?: string;
  contract_signed: boolean;
  created_at: string;
}

export const getProjects = async (token?: string): Promise<Project[]> => {
  const response = await apiClient.get<Project[]>('/projects', authHeaders(token));
  return response.data;
};

export const createProject = async (payload: Partial<Project>, token?: string): Promise<Project> => {
  const response = await apiClient.post<Project>('/projects', payload, authHeaders(token));
  return response.data;
};

export const getPublicProjectPortal = async (token: string): Promise<PublicProjectPortal> => {
  const response = await apiClient.get<PublicProjectPortal>(`/projects/portal/${token}`);
  return response.data;
};

export const approvePublicMilestone = async (token: string, milestoneId: string): Promise<PublicProjectPortal> => {
  const response = await apiClient.post<PublicProjectPortal>(`/projects/portal/${token}/milestones/${milestoneId}/approve`);
  return response.data;
};

export const deleteProject = async (projectId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/projects/${projectId}`, authHeaders(token));
};

export const updateProject = async (
  projectId: string,
  payload: Partial<Pick<Project, 'title' | 'client_id' | 'description' | 'status' | 'budget' | 'hourly_rate'>>,
  token?: string
): Promise<Project> => {
  const response = await apiClient.patch<Project>(`/projects/${projectId}`, payload, authHeaders(token));
  return response.data;
};

export const createTask = async (
  projectId: string,
  payload: { title: string; description?: string; priority?: string; estimated_hours?: number },
  token?: string
): Promise<Task> => {
  const response = await apiClient.post<Task>(`/projects/${projectId}/tasks`, payload, authHeaders(token));
  return response.data;
};

export const createMilestone = async (
  projectId: string,
  payload: { title: string; description?: string; amount?: number; deliverable_note?: string },
  token?: string
): Promise<Milestone> => {
  const response = await apiClient.post<Milestone>(`/projects/${projectId}/milestones`, payload, authHeaders(token));
  return response.data;
};

export const updateTask = async (
  projectId: string,
  taskId: string,
  payload: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'estimated_hours'>>,
  token?: string
): Promise<Task> => {
  const response = await apiClient.patch<Task>(`/projects/${projectId}/tasks/${taskId}`, payload, authHeaders(token));
  return response.data;
};

export const deleteTask = async (projectId: string, taskId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/projects/${projectId}/tasks/${taskId}`, authHeaders(token));
};

export const updateMilestone = async (
  projectId: string,
  milestoneId: string,
  payload: Partial<Pick<Milestone, 'title' | 'description' | 'amount' | 'is_completed' | 'deliverable_note'>>,
  token?: string
): Promise<Milestone> => {
  const response = await apiClient.patch<Milestone>(`/projects/${projectId}/milestones/${milestoneId}`, payload, authHeaders(token));
  return response.data;
};

export const deleteMilestone = async (projectId: string, milestoneId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/projects/${projectId}/milestones/${milestoneId}`, authHeaders(token));
};

// ------------------------------------------------------------------------------
// Invoices & Payments
// ------------------------------------------------------------------------------
export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount?: number;
}

export interface Invoice {
  id: string;
  workspace_id: string;
  client_id: string;
  client_name?: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date?: string;
  total_amount: number;
  notes?: string;
  paid_at?: string | null;
  items: InvoiceItem[];
  // Tracked-time entry ids imported as line items; the server stamps them
  // invoiced so the same hours can never be billed twice.
  time_entry_ids?: string[];
  created_at: string;
}

export const getInvoices = async (token?: string): Promise<Invoice[]> => {
  const response = await apiClient.get<Invoice[]>('/invoices', authHeaders(token));
  return response.data;
};

export interface UnbilledTimeEntry {
  id: string;
  project_id: string;
  project_title: string;
  client_id?: string | null;
  description?: string | null;
  start_time: string;
  duration_seconds: number;
  hours: number;
  hourly_rate: number;
  amount: number;
}

// Billable tracked time that has never been invoiced ("ready to bill").
export const getUnbilledTimeEntries = async (token?: string): Promise<UnbilledTimeEntry[]> => {
  const response = await apiClient.get<UnbilledTimeEntry[]>('/invoices/unbilled-time', authHeaders(token));
  return response.data;
};

export const createInvoice = async (payload: Partial<Invoice>, token?: string): Promise<Invoice> => {
  const response = await apiClient.post<Invoice>('/invoices', payload, authHeaders(token));
  return response.data;
};

export const updateInvoiceStatus = async (invoiceId: string, statusVal: 'draft' | 'sent' | 'paid' | 'overdue', token?: string): Promise<{ id: string; status: string; paid_at?: string | null }> => {
  // Status travels in a JSON body validated by the InvoiceStatusUpdate whitelist
  // (a query string was silently ignored by the new endpoint).
  const response = await apiClient.patch(`/invoices/${invoiceId}/status`, { status: statusVal }, authHeaders(token));
  return response.data;
};

export const deleteInvoice = async (invoiceId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/invoices/${invoiceId}`, authHeaders(token));
};

// ------------------------------------------------------------------------------
// Time Tracking
// ------------------------------------------------------------------------------
export interface TimeEntry {
  id: string;
  workspace_id: string;
  project_id: string;
  project_title?: string;
  task_id?: string;
  description?: string;
  start_time: string;
  end_time?: string;
  duration_seconds: number;
  hourly_rate: number;
  is_billable: boolean;
  is_invoiced: boolean;
  created_at: string;
}

export const getTimeEntries = async (token?: string): Promise<TimeEntry[]> => {
  const response = await apiClient.get<TimeEntry[]>('/time-entries', authHeaders(token));
  return response.data;
};

export const logTimeEntry = async (payload: Partial<TimeEntry>, token?: string): Promise<TimeEntry> => {
  const response = await apiClient.post<TimeEntry>('/time-entries', payload, authHeaders(token));
  return response.data;
};

export const deleteTimeEntry = async (entryId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/time-entries/${entryId}`, authHeaders(token));
};

// ------------------------------------------------------------------------------
// Live Timer Sessions — the stopwatch runs on the server clock, so a refresh,
// a closed tab or a second device resumes the exact same run.
// ------------------------------------------------------------------------------
export interface TimerSession {
  id: string;
  workspace_id: string;
  project_id: string;
  project_title?: string;
  description?: string;
  is_billable: boolean;
  is_running: boolean;
  started_at: string;
  paused_at?: string;
  accumulated_seconds: number;
  elapsed_seconds: number;
  ended_at?: string;
}

export const getActiveTimer = async (token?: string): Promise<TimerSession | null> => {
  const response = await apiClient.get<TimerSession | null>('/timer/active', authHeaders(token));
  return response.data;
};

export const startTimer = async (
  payload: { project_id: string; description?: string; is_billable?: boolean },
  token?: string
): Promise<TimerSession> => {
  const response = await apiClient.post<TimerSession>('/timer/start', payload, authHeaders(token));
  return response.data;
};

export const pauseTimer = async (sessionId: string, token?: string): Promise<TimerSession> => {
  const response = await apiClient.post<TimerSession>(`/timer/${sessionId}/pause`, {}, authHeaders(token));
  return response.data;
};

export const resumeTimer = async (sessionId: string, token?: string): Promise<TimerSession> => {
  const response = await apiClient.post<TimerSession>(`/timer/${sessionId}/resume`, {}, authHeaders(token));
  return response.data;
};

export const stopTimer = async (sessionId: string, token?: string): Promise<TimeEntry | null> => {
  const response = await apiClient.post<TimeEntry | null>(`/timer/${sessionId}/stop`, {}, authHeaders(token));
  return response.data;
};

// ------------------------------------------------------------------------------
// Workspace Settings — business profile + billing defaults (persisted on the
// workspace row, shared across every device instead of browser localStorage).
// ------------------------------------------------------------------------------
export interface WorkspaceSettings {
  id: string;
  name: string;
  slug: string;
  business_name?: string;
  professional_title?: string;
  tax_id?: string;
  currency: string;
  default_hourly_rate: number;
  invoice_prefix: string;
  payment_terms?: string;
  late_fee_policy?: string;
  payment_notes?: string;
  bank_balance: number;
  bank_balance_updated_at?: string | null;
}

export const getWorkspaceSettings = async (token?: string): Promise<WorkspaceSettings> => {
  const response = await apiClient.get<WorkspaceSettings>('/workspace', authHeaders(token));
  return response.data;
};

export const updateWorkspaceSettings = async (
  payload: Partial<Omit<WorkspaceSettings, 'id' | 'slug'>>,
  token?: string
): Promise<WorkspaceSettings> => {
  const response = await apiClient.put<WorkspaceSettings>('/workspace', payload, authHeaders(token));
  return response.data;
};

// ------------------------------------------------------------------------------
// Expenses & Taxes
// ------------------------------------------------------------------------------
export interface Expense {
  id: string;
  workspace_id: string;
  project_id?: string;
  category: string;
  amount: number;
  description?: string;
  receipt_cloudinary_url?: string;
  is_recurring?: boolean;
  created_at: string;
}

export const getExpenses = async (token?: string): Promise<Expense[]> => {
  const response = await apiClient.get<Expense[]>('/expenses', authHeaders(token));
  return response.data;
};

export const createExpense = async (payload: Partial<Expense>, token?: string): Promise<Expense> => {
  const response = await apiClient.post<Expense>('/expenses', payload, authHeaders(token));
  return response.data;
};

export const updateExpense = async (
  expenseId: string,
  payload: Partial<Pick<Expense, 'category' | 'amount' | 'description' | 'is_recurring'>>,
  token?: string
): Promise<Expense> => {
  const response = await apiClient.patch<Expense>(`/expenses/${expenseId}`, payload, authHeaders(token));
  return response.data;
};

export const deleteExpense = async (expenseId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/expenses/${expenseId}`, authHeaders(token));
};

// ------------------------------------------------------------------------------
// Contracts & E-Signature Tracking
// ------------------------------------------------------------------------------
export interface Contract {
  id: string;
  workspace_id: string;
  project_id: string;
  project_title?: string;
  client_id?: string;
  client_name?: string;
  title: string;
  content: string;
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'declined';
  token: string;
  recipient_name?: string;
  recipient_email?: string;
  sender_signature?: string;
  sender_signed_at?: string;
  viewed_at?: string;
  viewed_user_agent?: string;
  client_signature?: string;
  client_signed_at?: string;
  client_ip?: string;
  client_user_agent?: string;
  file_url?: string;
  created_at: string;
}

export interface PublicContract {
  id: string;
  title: string;
  content: string;
  status: string;
  token: string;
  project_title?: string;
  freelancer_name?: string;
  recipient_name?: string;
  recipient_email?: string;
  sender_signature?: string;
  sender_signed_at?: string;
  viewed_at?: string;
  client_signature?: string;
  client_signed_at?: string;
  created_at: string;
}

export interface ContractCreatePayload {
  project_id: string;
  client_id?: string;
  title: string;
  content: string;
  recipient_name?: string;
  recipient_email?: string;
  sender_signature?: string;
}

export interface ContractSignPayload {
  client_signature: string;
  recipient_name?: string;
  recipient_email?: string;
}

export const getContracts = async (projectId?: string, token?: string): Promise<Contract[]> => {
  const url = projectId ? `/contracts?project_id=${projectId}` : '/contracts';
  const response = await apiClient.get<Contract[]>(url, authHeaders(token));
  return response.data;
};

export const createContract = async (payload: ContractCreatePayload, token?: string): Promise<Contract> => {
  const response = await apiClient.post<Contract>('/contracts', payload, authHeaders(token));
  return response.data;
};

export const deleteContract = async (contractId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/contracts/${contractId}`, authHeaders(token));
};

export const getPublicContract = async (token: string): Promise<PublicContract> => {
  const response = await apiClient.get<PublicContract>(`/contracts/public/${token}`);
  return response.data;
};

export const signPublicContract = async (token: string, payload: ContractSignPayload): Promise<PublicContract> => {
  const response = await apiClient.post<PublicContract>(`/contracts/public/${token}/sign`, payload);
  return response.data;
};

// ------------------------------------------------------------------------------
// Proposals & AI Pitch Generator
// ------------------------------------------------------------------------------
export interface Proposal {
  id: string;
  workspace_id: string;
  client_id?: string;
  client_name?: string;
  project_id?: string;
  title: string;
  client_scope: string;
  budget: number;
  status: string;
  pitch_content: string;
  token: string;
  created_at: string;
}

export interface ProposalAIGenerateResponse {
  title: string;
  pitch_content: string;
  deliverables: string[];
  suggested_budget: number;
  estimated_timeline: string;
}

export const getProposals = async (token?: string): Promise<Proposal[]> => {
  const response = await apiClient.get<Proposal[]>('/proposals', authHeaders(token));
  return response.data;
};

export const createProposal = async (payload: Partial<Proposal>, token?: string): Promise<Proposal> => {
  const response = await apiClient.post<Proposal>('/proposals', payload, authHeaders(token));
  return response.data;
};

export const deleteProposal = async (proposalId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/proposals/${proposalId}`, authHeaders(token));
};

export const updateProposalStatus = async (
  proposalId: string,
  statusVal: 'draft' | 'sent' | 'accepted' | 'declined',
  token?: string
): Promise<Proposal> => {
  const response = await apiClient.patch<Proposal>(`/proposals/${proposalId}/status`, { status: statusVal }, authHeaders(token));
  return response.data;
};

export const generateAIProposalPitch = async (
  client_scope: string,
  target_budget: number = 1500,
  token?: string
): Promise<ProposalAIGenerateResponse> => {
  const response = await apiClient.post<ProposalAIGenerateResponse>(
    '/proposals/ai-generate',
    { client_scope, target_budget },
    authHeaders(token)
  );
  return response.data;
};

// ------------------------------------------------------------------------------
// Client Intake Forms
// ------------------------------------------------------------------------------
export interface IntakeQuestion {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface IntakeForm {
  id: string;
  workspace_id: string;
  client_id?: string;
  title: string;
  description?: string;
  questions: IntakeQuestion[];
  status: string;
  token: string;
  submissions_count: number;
  created_at: string;
}

export interface PublicIntakeForm {
  id: string;
  title: string;
  description?: string;
  questions: IntakeQuestion[];
  freelancer_name: string;
  token: string;
  created_at: string;
}

export interface IntakeSubmission {
  id: string;
  form_id: string;
  client_name?: string;
  client_email?: string;
  answers: Record<string, unknown>;
  created_at: string;
}

export const getIntakeForms = async (token?: string): Promise<IntakeForm[]> => {
  const response = await apiClient.get<IntakeForm[]>('/intake', authHeaders(token));
  return response.data;
};

export const getIntakeForm = async (formId: string, token?: string): Promise<IntakeForm> => {
  const response = await apiClient.get<IntakeForm>(`/intake/${formId}`, authHeaders(token));
  return response.data;
};

export const createIntakeForm = async (payload: Partial<IntakeForm>, token?: string): Promise<IntakeForm> => {
  const response = await apiClient.post<IntakeForm>('/intake', payload, authHeaders(token));
  return response.data;
};

export const updateIntakeForm = async (
  formId: string,
  payload: Partial<IntakeForm>,
  token?: string
): Promise<IntakeForm> => {
  const response = await apiClient.patch<IntakeForm>(`/intake/${formId}`, payload, authHeaders(token));
  return response.data;
};

export const deleteIntakeForm = async (formId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/intake/${formId}`, authHeaders(token));
};

export const getPublicIntakeForm = async (token: string): Promise<PublicIntakeForm> => {
  const response = await apiClient.get<PublicIntakeForm>(`/intake/public/${token}`);
  return response.data;
};

export const submitPublicIntakeForm = async (
  token: string,
  payload: { client_name?: string; client_email?: string; answers: Record<string, unknown> }
): Promise<IntakeSubmission> => {
  const response = await apiClient.post<IntakeSubmission>(`/intake/public/${token}/submit`, payload);
  return response.data;
};

export const getIntakeSubmissions = async (formId: string, token?: string): Promise<IntakeSubmission[]> => {
  const response = await apiClient.get<IntakeSubmission[]>(`/intake/${formId}/submissions`, authHeaders(token));
  return response.data;
};

// Turn a live intake response into a pipeline lead in one click.
export const convertIntakeSubmissionToLead = async (submissionId: string, token?: string): Promise<Lead> => {
  const response = await apiClient.post<Lead>(`/intake/submissions/${submissionId}/convert-to-lead`, {}, authHeaders(token));
  return response.data;
};

// ------------------------------------------------------------------------------
// Booking & Consultation Calendar
// ------------------------------------------------------------------------------
export interface BookingConsultation {
  id: string;
  workspace_id: string;
  title: string;
  description?: string;
  duration_minutes: number;
  price: number;
  meeting_provider: string;
  is_active: boolean;
  token: string;
  appointments_count: number;
  created_at: string;
}

export interface BookingAppointment {
  id: string;
  consultation_id: string;
  consultation_title?: string;
  client_name: string;
  client_email: string;
  appointment_time: string;
  meeting_link?: string;
  payment_status: string;
  notes?: string;
  created_at: string;
}

export interface PublicBookingConsultation {
  id: string;
  title: string;
  description?: string;
  duration_minutes: number;
  price: number;
  freelancer_name: string;
  token: string;
  created_at: string;
}

export const getBookings = async (token?: string): Promise<BookingConsultation[]> => {
  const response = await apiClient.get<BookingConsultation[]>('/booking', authHeaders(token));
  return response.data;
};

export const createBooking = async (payload: Partial<BookingConsultation>, token?: string): Promise<BookingConsultation> => {
  const response = await apiClient.post<BookingConsultation>('/booking', payload, authHeaders(token));
  return response.data;
};

export const deleteBooking = async (bookingId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/booking/${bookingId}`, authHeaders(token));
};

export const getBookingAppointments = async (token?: string): Promise<BookingAppointment[]> => {
  const response = await apiClient.get<BookingAppointment[]>('/booking/appointments', authHeaders(token));
  return response.data;
};

export const getPublicBooking = async (token: string): Promise<PublicBookingConsultation> => {
  const response = await apiClient.get<PublicBookingConsultation>(`/booking/public/${token}`);
  return response.data;
};

export const schedulePublicBooking = async (
  token: string,
  payload: { client_name: string; client_email: string; appointment_time: string; notes?: string }
): Promise<BookingAppointment> => {
  const response = await apiClient.post<BookingAppointment>(`/booking/public/${token}/schedule`, payload);
  return response.data;
};

// ------------------------------------------------------------------------------
// Dashboard Calendar — live feed (DB), event CRUD, Google Calendar sync
// ------------------------------------------------------------------------------
export interface CalendarFeedItem {
  id: string;
  title: string;
  description?: string | null;
  event_type: 'meeting' | 'client_work' | 'deadline' | 'personal';
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  source: 'local' | 'google' | 'booking' | 'invoice';
  client_name?: string | null;
  meeting_link?: string | null;
  status?: string | null;
}

export interface CalendarEventCreatePayload {
  title: string;
  description?: string;
  event_type: string;
  start_time: string;
  end_time: string;
  is_all_day?: boolean;
  client_name?: string;
  project_id?: string;
  meeting_link?: string;
}

export interface CalendarEvent extends CalendarEventCreatePayload {
  id: string;
  workspace_id: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface GoogleConnectionStatus {
  connected: boolean;
  configured: boolean;
  google_email?: string | null;
  last_synced_at?: string | null;
  sync_enabled: boolean;
}

export interface CalendarSyncResult {
  created: number;
  updated: number;
  deleted: number;
  synced_at: string;
}

export const getCalendarEvents = async (
  start: string,
  end: string,
  token?: string
): Promise<CalendarFeedItem[]> => {
  const response = await apiClient.get<CalendarFeedItem[]>(
    `/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    authHeaders(token)
  );
  return response.data;
};

export const createCalendarEvent = async (
  payload: CalendarEventCreatePayload,
  token?: string
): Promise<CalendarEvent> => {
  const response = await apiClient.post<CalendarEvent>('/calendar/events', payload, authHeaders(token));
  return response.data;
};

export const updateCalendarEvent = async (
  eventId: string,
  payload: Partial<CalendarEventCreatePayload>,
  token?: string
): Promise<CalendarEvent> => {
  const response = await apiClient.patch<CalendarEvent>(`/calendar/events/${eventId}`, payload, authHeaders(token));
  return response.data;
};

export const deleteCalendarEvent = async (eventId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/calendar/events/${eventId}`, authHeaders(token));
};

export const getGoogleCalendarStatus = async (token?: string): Promise<GoogleConnectionStatus> => {
  const response = await apiClient.get<GoogleConnectionStatus>('/calendar/google/status', authHeaders(token));
  return response.data;
};

export const startGoogleCalendarConnect = async (
  token?: string
): Promise<{ auth_url: string; configured: boolean }> => {
  const response = await apiClient.post<{ auth_url: string; configured: boolean }>(
    '/calendar/google/connect', {}, authHeaders(token)
  );
  return response.data;
};

export const completeGoogleCalendarConnect = async (
  payload: { code: string; state: string },
  token?: string
): Promise<GoogleConnectionStatus> => {
  const response = await apiClient.post<GoogleConnectionStatus>('/calendar/google/callback', payload, authHeaders(token));
  return response.data;
};

export const syncGoogleCalendar = async (token?: string): Promise<CalendarSyncResult> => {
  const response = await apiClient.post<CalendarSyncResult>('/calendar/google/sync', {}, authHeaders(token));
  return response.data;
};

export const disconnectGoogleCalendar = async (token?: string): Promise<void> => {
  await apiClient.delete('/calendar/google/disconnect', authHeaders(token));
};

// ------------------------------------------------------------------------------
// Report Card — editable, shareable personal card (persisted in Neon per user)
// ------------------------------------------------------------------------------
export interface SectionItem {
  id: string;
  title: string;
  description: string;
  link?: string | null;
  icon: string;   // lucide icon key or brand logo key rendered by the frontend
  color: string;  // icon chip background colour
  logo_url?: string | null; // optional custom logo image URL or SVG identifier
}

export interface WritingItem {
  id: string;
  title: string;
  date: string;
  link?: string | null;
}

export interface ProjectItem {
  id: string;
  title: string;
  description: string;
  category?: string;
  link?: string | null;
  icon: string;
  color: string;
  logo_url?: string | null;
  tags?: string[];
  year?: string;
}

export interface QuoteItem {
  text: string;
  author: string;
  emoji?: string;
}

export interface FooterContent {
  signature_name?: string;
  code_link?: string;
  video_link?: string;
  inspired_by_name?: string;
  inspired_by_link?: string;
}

export interface CardContent {
  name_aka: string;
  bio_paragraphs: string[];
  things_i_do: SectionItem[];
  companies: SectionItem[];
  work_with_me: SectionItem[];
  writings: WritingItem[];
  inspirations?: SectionItem[];
  inspiration_intro?: string[];
  projects?: ProjectItem[];
  projects_intro?: string[];
  quote?: QuoteItem | null;
  footer?: FooterContent | null;
}

export interface CardSettings {
  font: string;    // schibsted | inter | geist
  accent: string;  // accent colour chosen in the settings popover
}

export interface ScopeStat {
  solved: number;
  total: number;
}

export interface DeliveryStats {
  total_solved: number;
  total_target: number;
  completion_rate_pct: number;
  easy: ScopeStat;
  medium: ScopeStat;
  hard: ScopeStat;
}

export interface HeatmapCell {
  date: string;
  count: number;
  level: number;
}

export interface ShareStatusResponse {
  is_shared: boolean;
  share_token?: string | null;
  include_styling: boolean;
  expiration: "never" | "1m" | "1h" | "24h" | "7d" | "30d";
  expires_at?: number | null;
  created_at?: number | null;
  share_url?: string | null;
  status: "active" | "expired" | "revoked";
}

export interface ReportCardData {
  username: string;
  full_name: string;
  avatar_url: string;
  content: CardContent;
  settings: CardSettings;
  share: ShareStatusResponse;
  views_count: number;
  current_streak: number;
  max_streak: number;
  active_days_count: number;
  delivery_stats: DeliveryStats;
  heatmap: HeatmapCell[];
}

export const getMyReportCard = async (token?: string): Promise<ReportCardData> => {
  const response = await apiClient.get<ReportCardData>('/report-card/me', authHeaders(token));
  return response.data;
};

export const saveReportCardContent = async (content: CardContent, token?: string): Promise<ReportCardData> => {
  const response = await apiClient.put<ReportCardData>('/report-card/me/content', { content }, authHeaders(token));
  return response.data;
};

export const saveReportCardSettings = async (settings: CardSettings, token?: string): Promise<ReportCardData> => {
  const response = await apiClient.put<ReportCardData>('/report-card/me/settings', { settings }, authHeaders(token));
  return response.data;
};

export const getShareStatus = async (token?: string): Promise<ShareStatusResponse> => {
  const response = await apiClient.get<ShareStatusResponse>('/report-card/share/status', authHeaders(token));
  return response.data;
};

export const createShareLink = async (
  payload: { expiration: string; include_styling: boolean },
  token?: string
): Promise<ShareStatusResponse> => {
  const response = await apiClient.post<ShareStatusResponse>('/report-card/share', payload, authHeaders(token));
  return response.data;
};

export const revokeShareLink = async (token?: string): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.delete<{ success: boolean; message: string }>('/report-card/share', authHeaders(token));
  return response.data;
};

export const getPublicReportCard = async (username: string, shareToken?: string | null): Promise<ReportCardData> => {
  const url = shareToken
    ? `/report-card/public/${encodeURIComponent(username)}?token=${encodeURIComponent(shareToken)}`
    : `/report-card/public/${encodeURIComponent(username)}`;
  const response = await apiClient.get<ReportCardData>(url);
  return response.data;
};

// ------------------------------------------------------------------------------
// Smart Automations — Inngest background-job state (read-only dashboard view)
// ------------------------------------------------------------------------------
export interface AutomationState {
  enabled: boolean;
  overdue_scan_cron: string;
  reminder_grace_days: number;
  booking_reminder_lead_hours: number;
  overdue_invoice_count: number;
  overdue_invoice_amount: number;
  sent_unpaid_count: number;
  upcoming_appointments_7d_count: number;
  email_provider: string; // "console" | "resend"
  web_app_url: string;
  timestamp: string;
}

export const getAutomationState = async (token?: string): Promise<AutomationState> => {
  const response = await apiClient.get<AutomationState>('/automations/state', authHeaders(token));
  return response.data;
};

// ------------------------------------------------------------------------------
// Planner — todo list + Excalidraw sketch board, saved as "files" (boards).
// Real-time: tabs poll getPlannerBoardHead (cheap: revision + todos only) and
// only re-download the scene when the revision moved. savePlannerBoard sends
// the last known revision so a stale whole-scene write is rejected (409) rather
// than clobbering another session. The Excalidraw scene is opaque JSON.
// ------------------------------------------------------------------------------
export interface PlannerTodo {
  id: string;
  text: string;
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlannerBoardSummary {
  id: string;
  name: string;
  revision: number;
  todos_count: number;
  done_count: number;
  created_at: string;
  updated_at: string;
}

export interface PlannerBoardFull {
  id: string;
  name: string;
  revision: number;
  elements: Record<string, unknown>[];
  files: Record<string, Record<string, unknown>>;
  todos: PlannerTodo[];
}

export interface PlannerBoardHead {
  revision: number;
  todos: PlannerTodo[];
}

export const listPlannerBoards = async (token?: string): Promise<PlannerBoardSummary[]> => {
  const response = await apiClient.get<PlannerBoardSummary[]>('/planner/boards', authHeaders(token));
  return response.data;
};

export const createPlannerBoard = async (
  name: string,
  token?: string
): Promise<PlannerBoardSummary> => {
  const response = await apiClient.post<PlannerBoardSummary>('/planner/boards', { name }, authHeaders(token));
  return response.data;
};

// Full scene load + save get a longer timeout: on a cold Neon branch the very
// first round trip can outrun the 15s global default and surface as a
// "timeout of 15000ms exceeded" error mid-edit.
export const getPlannerBoard = async (boardId: string, token?: string): Promise<PlannerBoardFull> => {
  const response = await apiClient.get<PlannerBoardFull>(`/planner/boards/${boardId}`, {
    ...authHeaders(token),
    timeout: 30000,
  });
  return response.data;
};

export const getPlannerBoardHead = async (boardId: string, token?: string): Promise<PlannerBoardHead> => {
  const response = await apiClient.get<PlannerBoardHead>(`/planner/boards/${boardId}/head`, authHeaders(token));
  return response.data;
};

export const savePlannerBoard = async (
  boardId: string,
  scene: { elements: Record<string, unknown>[]; files: Record<string, Record<string, unknown>> },
  rev: number,
  token?: string
): Promise<{ revision: number }> => {
  const response = await apiClient.put<{ revision: number }>(
    `/planner/boards/${boardId}?rev=${rev}`,
    scene,
    { ...authHeaders(token), timeout: 30000 }
  );
  return response.data;
};

export const renamePlannerBoard = async (
  boardId: string,
  name: string,
  token?: string
): Promise<PlannerBoardSummary> => {
  const response = await apiClient.patch<PlannerBoardSummary>(`/planner/boards/${boardId}`, { name }, authHeaders(token));
  return response.data;
};

export const deletePlannerBoard = async (boardId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/planner/boards/${boardId}`, authHeaders(token));
};

export const createPlannerTodo = async (
  boardId: string,
  text: string,
  token?: string
): Promise<PlannerTodo> => {
  const response = await apiClient.post<PlannerTodo>(`/planner/boards/${boardId}/todos`, { text }, authHeaders(token));
  return response.data;
};

export const updatePlannerTodo = async (
  todoId: string,
  payload: { text?: string; is_done?: boolean },
  token?: string
): Promise<PlannerTodo> => {
  const response = await apiClient.patch<PlannerTodo>(`/planner/todos/${todoId}`, payload, authHeaders(token));
  return response.data;
};

export const deletePlannerTodo = async (todoId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/planner/todos/${todoId}`, authHeaders(token));
};

// ------------------------------------------------------------------------------
// Storage & Cloudinary Uploads
// ------------------------------------------------------------------------------
export interface UploadSignatureResponse {
  provider: string;
  upload_url: string;
  upload_params?: Record<string, unknown>;
}

export const getUploadSignature = async (
  payload: { file_key: string; content_type: string; category?: string },
  token?: string
): Promise<UploadSignatureResponse> => {
  const response = await apiClient.post<UploadSignatureResponse>(
    '/storage/upload-signature',
    payload,
    authHeaders(token)
  );
  return response.data;
};

export const uploadFileToCloudinary = async (
  file: File,
  category = "documents",
  token?: string
): Promise<{ url: string; name: string; size: number; type: string }> => {
  try {
    const signatureRes = await getUploadSignature(
      {
        file_key: file.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_'),
        content_type: file.type || 'application/octet-stream',
        category,
      },
      token
    );

    if (signatureRes.upload_url && signatureRes.upload_params) {
      const formData = new FormData();
      formData.append('file', file);
      Object.entries(signatureRes.upload_params).forEach(([k, v]) => {
        formData.append(k, String(v));
      });

      const uploadRes = await fetch(signatureRes.upload_url, {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const json = await uploadRes.json();
        return {
          url: json.secure_url || json.url,
          name: file.name,
          size: file.size,
          type: file.type,
        };
      }
    }
  } catch (e) {
    console.warn("Cloudinary direct upload fallback:", e);
  }

  // Fallback object URL
  const fallbackUrl = URL.createObjectURL(file);
  return {
    url: fallbackUrl,
    name: file.name,
    size: file.size,
    type: file.type,
  };
};



