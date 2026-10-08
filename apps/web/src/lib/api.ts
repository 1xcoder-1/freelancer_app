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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Response interceptor for unified error formatting and resilience.
// The HTTP status is copied onto the thrown Error so callers can branch on
// 403/404/410 (e.g. revoked / expired share links) instead of parsing text.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Self-heal transient failures: when uvicorn --reload restarts (or Neon
    // cold-starts) the connection drops / hangs, which used to leave tabs
    // stuck at zeros until a manual refresh. Retry safe (GET/HEAD/OPTIONS)
    // requests a couple of times with a short backoff before surfacing the
    // error — mutations are never retried to avoid double writes.
    const config = error?.config;
    const code = error?.code;
    const isTransient =
      code === 'ECONNABORTED' ||
      code === 'ECONNREFUSED' ||
      code === 'ERR_NETWORK' ||
      code === 'ERR_CANCELED' ||
      error?.response?.status === 429;
    const method = String(config?.method ?? 'get').toLowerCase();
    if (
      config &&
      isTransient &&
      ['get', 'head', 'options'].includes(method) &&
      (config.__retryCount ?? 0) < 2
    ) {
      config.__retryCount = (config.__retryCount ?? 0) + 1;
      await sleep(config.__retryCount * 2000);
      return apiClient.request(config);
    }

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
// Duplicate-person conflict (409) — shared by the clients/leads forms.
// The API raises {code:'duplicate_person', match, strict, person} so the UI
// can branch: strict (email) hits offer to open the existing record, weak
// (name/phone) hits can be overridden with allow_duplicate.
// ------------------------------------------------------------------------------
export interface DuplicatePersonConflict {
  kind: 'client' | 'lead';
  match: 'email' | 'name' | 'phone';
  strict: boolean;
  person: { id: string; name: string; email?: string | null; company?: string | null };
}

export function getDuplicateConflict(err: unknown): DuplicatePersonConflict | null {
  const detail = (err as { response?: { data?: { detail?: any } } })?.response?.data?.detail;
  if (detail && typeof detail === 'object' && detail.code === 'duplicate_person' && detail.person?.id) {
    return detail as DuplicatePersonConflict;
  }
  return null;
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
  // Revenue tracking (computed server-side from this client's invoices):
  // total_billed = non-draft invoices, total_paid = the settled subset.
  total_billed?: number;
  total_paid?: number;
  days_since_touch?: number | null;
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

export const createClient = async (payload: Partial<Client> & { allow_duplicate?: boolean }, token?: string): Promise<Client> => {
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
// Clients productivity (C1 earnings, C5 files, C6 relationship strip)
// ------------------------------------------------------------------------------
export interface ClientEarnings {
  client_id: string;
  name: string;
  currency: string;
  lifetime_revenue: number;
  total_invoiced: number;
  total_paid: number;
  outstanding: number;
  avg_deal_size: number;
  days_to_payment: number | null;
  lifetime_hours: number;
  invoice_count: number;
}

export interface TopIncomeSource {
  client_id: string;
  name: string;
  total_paid: number;
  invoice_count: number;
}

export const getClientEarnings = async (clientId: string, token?: string): Promise<ClientEarnings> => {
  const response = await apiClient.get<ClientEarnings>(`/clients/${clientId}/earnings`, authHeaders(token));
  return response.data;
};

export const getTopIncomeSources = async (token?: string, limit = 8): Promise<TopIncomeSource[]> => {
  const response = await apiClient.get<TopIncomeSource[]>('/clients/earnings/top', { ...authHeaders(token), params: { limit } });
  return response.data;
};

export interface ClientRelationship {
  client_id: string;
  currency?: string;
  // Card 1: Projects
  total_projects: number;
  open_projects: number;
  completed_projects: number;
  // Card 2: Financials (Amount / Revenue)
  total_revenue: number;
  paid_amount: number;
  pending_amount: number;
  // Card 3: Contracts
  total_contracts: number;
  signed_contracts: number;
  pending_contracts: number;
  unsigned_contracts: number;
  unsigned_contract_value: number;
  // Card 4: Invoices
  total_invoices: number;
  paid_invoices: number;
  pending_invoices: number;
  overdue_invoices: number;
  overdue_value: number;
  // Compatibility
  unbilled_hours?: number;
  unbilled_value?: number;
  days_since_touch?: number | null;
}

export const getClientRelationship = async (clientId: string, token?: string): Promise<ClientRelationship> => {
  const response = await apiClient.get<ClientRelationship>(`/clients/${clientId}/relationship`, authHeaders(token));
  return response.data;
};

// ------------------------------------------------------------------------------
// Project Documents / Files (Drag & Drop Vault)
// ------------------------------------------------------------------------------
export interface ProjectFile {
  id: string;
  project_id: string;
  file_key: string;
  file_name: string;
  content_type?: string | null;
  size_bytes: number;
  category: string;
  created_at: string;
}

export const listProjectFiles = async (projectId: string, token?: string): Promise<ProjectFile[]> => {
  const response = await apiClient.get<ProjectFile[]>(`/projects/${projectId}/files`, authHeaders(token));
  return response.data;
};

export const registerProjectFile = async (
  projectId: string,
  payload: { file_key: string; file_name: string; content_type?: string; size_bytes?: number; category?: string },
  token?: string
): Promise<ProjectFile> => {
  const response = await apiClient.post<ProjectFile>(`/projects/${projectId}/files`, payload, authHeaders(token));
  return response.data;
};

export const deleteProjectFile = async (projectId: string, fileId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/projects/${projectId}/files/${fileId}`, authHeaders(token));
};

export const getStorageDownloadUrl = async (fileKey: string, token?: string): Promise<{ file_key: string; url: string }> => {
  const response = await apiClient.get<{ file_key: string; url: string }>('/storage/download-url', { ...authHeaders(token), params: { file_key: fileKey } });
  return response.data;
};

// ------------------------------------------------------------------------------
// Interactions (F2) — shared touch log for leads + clients
// ------------------------------------------------------------------------------
export type InteractionKind = 'call' | 'email' | 'meeting' | 'message' | 'note';

export interface Interaction {
  id: string;
  workspace_id: string;
  person_type: 'lead' | 'client';
  person_id: string;
  kind: InteractionKind;
  direction: 'inbound' | 'outbound';
  summary?: string | null;
  occurred_at: string;
  next_action_at?: string | null;
  created_at: string;
}

export const createInteraction = async (
  payload: { person_type: 'lead' | 'client'; person_id: string; kind?: InteractionKind; direction?: 'inbound' | 'outbound'; summary?: string; occurred_at?: string; next_action_at?: string },
  token?: string
): Promise<Interaction> => {
  const response = await apiClient.post<Interaction>('/interactions', payload, authHeaders(token));
  return response.data;
};

export const listInteractions = async (
  personType: 'lead' | 'client',
  personId: string,
  token?: string,
  limit = 50
): Promise<Interaction[]> => {
  const response = await apiClient.get<Interaction[]>('/interactions', { ...authHeaders(token), params: { person_type: personType, person_id: personId, limit } });
  return response.data;
};

export interface InteractionSummary {
  touch_count: number;
  last_touch_at: string | null;
  days_since_last_touch: number | null;
  next_action_at: string | null;
}

export const getInteractionSummary = async (
  personType: 'lead' | 'client',
  personId: string,
  token?: string
): Promise<InteractionSummary> => {
  const response = await apiClient.get<InteractionSummary>('/interactions/summary', { ...authHeaders(token), params: { person_type: personType, person_id: personId } });
  return response.data;
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
  priority: 'low' | 'medium' | 'high' | 'urgent';
  last_contact_at?: string | null;
  next_follow_up_at?: string | null;
  notes?: string | null;
  // L3 loss reason + L5 first-touch baseline (surfaced by the close endpoint).
  reason_lost?: string | null;
  reason_lost_note?: string | null;
  first_contact_at?: string | null;
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
  // L1 the merged, value-ranked "next up" queue; L3 loss analytics; L5 speed;
  // L6 which acquisition channel actually produces revenue.
  next_up: Array<{
    id: string; name: string; company?: string | null; stage: string;
    type: 'follow_up' | 'stale' | 'proposal_reply'; why: string; value: number;
    estimated_value?: number; priority?: string; days_since_contact?: number; expires_at?: string | null;
  }>;
  lost_by_reason: Record<string, number>;
  median_lost_deal_size: number;
  response_speed: {
    median_hours_to_first_reply: number | null;
    median_days_to_close: number | null;
    measured_leads: number;
  };
  source_revenue: Array<{ source: string; won_value: number; won_count: number }>;
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

export const createLead = async (payload: Partial<Lead> & { allow_duplicate?: boolean }, token?: string): Promise<Lead> => {
  const response = await apiClient.post<Lead>('/leads', payload, authHeaders(token));
  return response.data;
};

export const updateLead = async (leadId: string, payload: Partial<Lead>, token?: string): Promise<Lead> => {
  const response = await apiClient.patch<Lead>(`/leads/${leadId}`, payload, authHeaders(token));
  return response.data;
};

// SE8: terminal stages (won/lost) go through the dedicated close endpoint so a
// stray stage edit can't silently spawn a client or skew win-rate stats. `lost`
// requires a structured reason server-side.
export const closeLead = async (
  leadId: string,
  payload: { outcome: "won" | "lost"; reason?: string; note?: string },
  token?: string,
): Promise<Lead> => {
  const response = await apiClient.post<Lead>(`/leads/${leadId}/close`, payload, authHeaders(token));
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
// re-converting returns the existing client and fills its empty fields,
// never a duplicate). mergeIntoClientId targets a specific roster row after
// convert-preview flagged a same-name/phone candidate as "the same person".
export const convertLeadToClient = async (leadId: string, token?: string, mergeIntoClientId?: string): Promise<Client> => {
  const response = await apiClient.post<Client>(
    `/leads/${leadId}/convert-to-client`,
    mergeIntoClientId ? { merge_into_client_id: mergeIntoClientId } : {},
    authHeaders(token)
  );
  return response.data;
};

// Pre-flight for the convert dialog: what will happen before the user commits.
export interface LeadConvertPreview {
  match: 'email' | 'weak' | 'none';
  client_id?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  same_person: boolean;
}

export const getLeadConvertPreview = async (leadId: string, token?: string): Promise<LeadConvertPreview> => {
  const response = await apiClient.get<LeadConvertPreview>(`/leads/${leadId}/convert-preview`, authHeaders(token));
  return response.data;
};

// F3 — the winning-a-deal cascade: one action builds the client + project and
// (opt-in) contract/invoice, returning every created id to deep-link.
export interface StartOutcome {
  lead_id: string;
  client_id: string;
  reused_client: boolean;
  project_id?: string | null;
  contract_id?: string | null;
  invoice_id?: string | null;
}

export const startWork = async (
  leadId: string,
  payload: {
    project_title?: string;
    create_contract?: boolean;
    contract_title?: string;
    contract_content?: string;
    create_invoice?: boolean;
    invoice_amount?: number;
  },
  token?: string
): Promise<StartOutcome> => {
  const response = await apiClient.post<StartOutcome>(`/leads/${leadId}/start-work`, payload, authHeaders(token));
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
  // P4 real due date + P5 actual-vs-estimated (summed from linked TimeEntry rows).
  due_date?: string | null;
  actual_hours: number;
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
  // P6 deliverable sign-off: submitted (freelancer) vs approved (client).
  due_date?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  created_at: string;
}

// P2 derived deadline verdict (never stored; computed live against the clock).
export interface Deadline {
  verdict: "completed" | "overdue" | "at_risk" | "on_track";
  days_left: number;
  due_date: string;
  progress_pct: number;
}

// P3 priced, auditable scope change (client decides in the portal).
export interface ChangeRequest {
  id: string;
  project_id: string;
  workspace_id: string;
  title: string;
  detail?: string | null;
  price: number;
  impact_days: number;
  status: string;
  requested_by?: string | null;
  decided_at?: string | null;
  decision_note?: string | null;
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
  // P1 unbilled time surfaced on the project that earned it.
  unbilled_hours: number;
  unbilled_value: number;
  // P1/P2 real schedule columns + derived verdict.
  start_date?: string | null;
  due_date?: string | null;
  deadline?: Deadline | null;
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
  due_date?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  created_at: string;
}

export interface PublicChangeRequest {
  id: string;
  title: string;
  detail?: string | null;
  price: number;
  impact_days: number;
  status: string;
  requested_by?: string | null;
  decided_at?: string | null;
  decision_note?: string | null;
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
  // P3 priced scope changes + SE4 recipient-verification state.
  change_requests: PublicChangeRequest[];
  recipient_verified: boolean;
  created_at: string;
}

export const getProjects = async (token?: string): Promise<Project[]> => {
  const response = await apiClient.get<Project[]>('/projects', authHeaders(token));
  return response.data;
};

export const getProject = async (projectId: string, token?: string): Promise<Project> => {
  const response = await apiClient.get<Project>(`/projects/${projectId}`, authHeaders(token));
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

export const approvePublicMilestone = async (
  token: string,
  milestoneId: string,
  email: string
): Promise<PublicProjectPortal> => {
  // SE4: the recipient email must match the one captured on first portal open.
  const response = await apiClient.post<PublicProjectPortal>(
    `/projects/portal/${token}/milestones/${milestoneId}/approve`,
    { email }
  );
  return response.data;
};

export const verifyPortalRecipient = async (
  token: string,
  email: string
): Promise<PublicProjectPortal> => {
  const response = await apiClient.post<PublicProjectPortal>(`/projects/portal/${token}/verify`, { email });
  return response.data;
};

export const decidePortalChangeRequest = async (
  token: string,
  crId: string,
  payload: { decision: "approved" | "rejected"; email: string; note?: string }
): Promise<PublicProjectPortal> => {
  const response = await apiClient.post<PublicProjectPortal>(
    `/projects/portal/${token}/change-requests/${crId}/decide`,
    payload
  );
  return response.data;
};

// P1: the unbilled hours this project earned, with each entry so the UI can
// offer "bill these hours". Declared before deleteProject (ordering irrelevant,
// just grouped with the project reads).
export interface ProjectUnbilledTime {
  project_id: string;
  hours: number;
  value: number;
  entries: {
    id: string;
    description?: string | null;
    start_time: string;
    duration_seconds: number;
    hours: number;
    hourly_rate: number;
    task_id?: string | null;
  }[];
}

export const getProjectUnbilledTime = async (
  projectId: string,
  token?: string
): Promise<ProjectUnbilledTime> => {
  const response = await apiClient.get<ProjectUnbilledTime>(
    `/projects/${projectId}/unbilled-time`,
    authHeaders(token)
  );
  return response.data;
};

// P3: change requests (scope-creep guard), freelancer side CRUD.
export const listChangeRequests = async (projectId: string, token?: string): Promise<ChangeRequest[]> => {
  const response = await apiClient.get<ChangeRequest[]>(`/projects/${projectId}/change-requests`, authHeaders(token));
  return response.data;
};

export const createChangeRequest = async (
  projectId: string,
  payload: { title: string; detail?: string; price?: number; impact_days?: number; requested_by?: string },
  token?: string
): Promise<ChangeRequest> => {
  const response = await apiClient.post<ChangeRequest>(`/projects/${projectId}/change-requests`, payload, authHeaders(token));
  return response.data;
};

export const updateChangeRequest = async (
  projectId: string,
  crId: string,
  payload: Partial<Pick<ChangeRequest, 'title' | 'detail' | 'price' | 'impact_days' | 'status'>>,
  token?: string
): Promise<ChangeRequest> => {
  const response = await apiClient.patch<ChangeRequest>(`/projects/${projectId}/change-requests/${crId}`, payload, authHeaders(token));
  return response.data;
};

// P6: freelancer submits a deliverable so the client's sign-off clock starts.
export const submitMilestone = async (
  projectId: string,
  milestoneId: string,
  note?: string,
  token?: string
): Promise<Milestone> => {
  const response = await apiClient.post<Milestone>(
    `/projects/${projectId}/milestones/${milestoneId}/submit`,
    { note },
    authHeaders(token)
  );
  return response.data;
};

export const deleteProject = async (projectId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/projects/${projectId}`, authHeaders(token));
};

// SE10: revoke a leaked client-portal link by minting a fresh share token.
export const rotateProjectShareToken = async (projectId: string, token?: string): Promise<Project> => {
  const response = await apiClient.post<Project>(`/projects/${projectId}/rotate-share-token`, {}, authHeaders(token));
  return response.data;
};

export const updateProject = async (
  projectId: string,
  payload: Partial<Pick<Project, 'title' | 'client_id' | 'description' | 'status' | 'budget' | 'hourly_rate' | 'start_date' | 'due_date'>>,
  token?: string
): Promise<Project> => {
  const response = await apiClient.patch<Project>(`/projects/${projectId}`, payload, authHeaders(token));
  return response.data;
};

export const createTask = async (
  projectId: string,
  payload: { title: string; description?: string; priority?: string; estimated_hours?: number; due_date?: string | null },
  token?: string
): Promise<Task> => {
  const response = await apiClient.post<Task>(`/projects/${projectId}/tasks`, payload, authHeaders(token));
  return response.data;
};

export const createMilestone = async (
  projectId: string,
  payload: { title: string; description?: string; amount?: number; deliverable_note?: string; due_date?: string | null },
  token?: string
): Promise<Milestone> => {
  const response = await apiClient.post<Milestone>(`/projects/${projectId}/milestones`, payload, authHeaders(token));
  return response.data;
};

export const updateTask = async (
  projectId: string,
  taskId: string,
  payload: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'estimated_hours' | 'due_date'>>,
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
  project_id?: string | null;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date?: string;
  total_amount: number;
  // Public payment link handle (V1): the /pay/[token] page and the "Payment
  // Link" button use this instead of the internal id.
  token?: string;
  notes?: string;
  paid_at?: string | null;
  items: InvoiceItem[];
  // Tracked-time entry ids imported as line items; the server stamps them
  // invoiced so the same hours can never be billed twice.
  time_entry_ids?: string[];
  created_at: string;
}

export const getInvoices = async (token?: string, projectId?: string): Promise<Invoice[]> => {
  const params = projectId ? { params: { project_id: projectId } } : {};
  const response = await apiClient.get<Invoice[]>('/invoices', { ...authHeaders(token), ...params });
  return response.data;
};

export const getInvoice = async (invoiceId: string, token?: string): Promise<Invoice> => {
  const response = await apiClient.get<Invoice>(`/invoices/${invoiceId}`, authHeaders(token));
  return response.data;
};

// ---- Public payment page (V1) ------------------------------------------------
// Token-addressed, no auth header, no internal invoice id ever exposed.
export interface PublicInvoice {
  invoice_number: string;
  status: string;
  client_name?: string | null;
  currency: string;
  issue_date: string;
  due_date?: string | null;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  notes?: string | null;
  items: InvoiceItem[];
}

export interface InvoicePayment {
  id: string;
  amount: number;
  method: string;
  reference?: string | null;
  note?: string | null;
  paid_at: string;
}

export const getPublicInvoice = async (token: string): Promise<PublicInvoice> => {
  const response = await apiClient.get<PublicInvoice>(`/invoices/public/${token}`);
  return response.data;
};

export const recordPublicInvoicePayment = async (
  token: string,
  payload: { amount: number; method?: string; reference?: string; note?: string }
): Promise<InvoicePayment> => {
  const response = await apiClient.post<InvoicePayment>(`/invoices/public/${token}/pay`, payload);
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
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'fully_executed' | 'declined' | 'expired' | 'superseded';
  token: string;
  recipient_name?: string;
  recipient_email?: string;
  sender_signature?: string;
  sender_signed_at?: string;
  viewed_at?: string;
  viewed_user_agent?: string;
  // N1: the audit IP that used to be collected but never surfaced.
  viewed_ip?: string;
  client_signature?: string;
  client_signed_at?: string;
  client_ip?: string;
  client_user_agent?: string;
  file_url?: string;
  // N2 expiry / N5 versioning / N6 full execution.
  expires_at?: string | null;
  expire_days?: number;
  version?: number;
  supersedes_id?: string | null;
  fully_executed_at?: string | null;
  created_at: string;
  // Server-derived (list endpoint) so cards show live age/expiry without date maths.
  days_awaiting?: number | null;
  days_left?: number | null;
}

export interface ContractEvent {
  id: string;
  contract_id: string;
  event: string;
  occurred_at: string;
  actor_ip?: string | null;
  actor_user_agent?: string | null;
  note?: string | null;
}

export interface ContractTemplate {
  id: string;
  workspace_id: string;
  title: string;
  content: string;
  category: string;
  is_default: boolean;
  created_at: string;
}

export interface ClauseSnippet {
  key: string;
  title: string;
  body: string;
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
  // N2/N5: the sign page needs the expiry + supersede flags to explain a dead link.
  expires_at?: string | null;
  superseded?: boolean;
  fully_executed_at?: string | null;
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
  // N2: validity window (days) for the public sign link.
  expire_days?: number;
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

export const getContract = async (contractId: string, token?: string): Promise<Contract> => {
  const response = await apiClient.get<Contract>(`/contracts/${contractId}`, authHeaders(token));
  return response.data;
};

export const createContract = async (payload: ContractCreatePayload, token?: string): Promise<Contract> => {
  const response = await apiClient.post<Contract>('/contracts', payload, authHeaders(token));
  return response.data;
};

export const deleteContract = async (contractId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/contracts/${contractId}`, authHeaders(token));
};

// N1 audit timeline
export const listContractEvents = async (contractId: string, token?: string): Promise<ContractEvent[]> => {
  const response = await apiClient.get<ContractEvent[]>(`/contracts/${contractId}/events`, authHeaders(token));
  return response.data;
};

// N6 freelancer counter-sign
export const signSenderContract = async (contractId: string, senderSignature: string, token?: string): Promise<Contract> => {
  const response = await apiClient.post<Contract>(`/contracts/${contractId}/sign-sender`, { sender_signature: senderSignature }, authHeaders(token));
  return response.data;
};

// N5 re-send as a new version (marks the old one superseded)
export const resendContract = async (contractId: string, payload: ContractCreatePayload, token?: string): Promise<Contract> => {
  const response = await apiClient.post<Contract>(`/contracts/${contractId}/resend`, payload, authHeaders(token));
  return response.data;
};

// SE10: revoke a leaked public sign link by minting a fresh token (old URL dies).
export const rotateContractToken = async (contractId: string, token?: string): Promise<Contract> => {
  const response = await apiClient.post<Contract>(`/contracts/${contractId}/rotate-token`, {}, authHeaders(token));
  return response.data;
};

// N4 templates + clause snippets
export const listContractTemplates = async (token?: string): Promise<ContractTemplate[]> => {
  const response = await apiClient.get<ContractTemplate[]>('/contracts/templates', authHeaders(token));
  return response.data;
};

export const createContractTemplate = async (payload: { title: string; content: string; category?: string }, token?: string): Promise<ContractTemplate> => {
  const response = await apiClient.post<ContractTemplate>('/contracts/templates', payload, authHeaders(token));
  return response.data;
};

export const saveContractAsTemplate = async (contractId: string, payload: { title: string; content: string; category?: string }, token?: string): Promise<ContractTemplate> => {
  const response = await apiClient.post<ContractTemplate>(`/contracts/${contractId}/save-as-template`, payload, authHeaders(token));
  return response.data;
};

export const deleteContractTemplate = async (templateId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/contracts/templates/${templateId}`, authHeaders(token));
};

export const getClauseSnippets = async (token?: string): Promise<ClauseSnippet[]> => {
  const response = await apiClient.get<ClauseSnippet[]>('/contracts/clauses', authHeaders(token));
  return response.data;
};

export const getPublicContract = async (token: string): Promise<PublicContract> => {
  const response = await apiClient.get<PublicContract>(`/contracts/public/${token}`);
  return response.data;
};

export const signPublicContract = async (token: string, payload: ContractSignPayload): Promise<PublicContract> => {
  const response = await apiClient.post<PublicContract>(`/contracts/public/${token}/sign`, payload);
  return response.data;
};

export const declinePublicContract = async (token: string, reason?: string): Promise<PublicContract> => {
  const response = await apiClient.post<PublicContract>(`/contracts/public/${token}/decline`, { reason });
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
  // L4 valid-through date; the daily scan flips past-expiry 'sent' rows to
  // 'expired' and accepting an expired one is blocked server-side (410).
  expires_at?: string | null;
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
  statusVal: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired',
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
  weekday_mask: string;
  start_minute: number;
  end_minute: number;
  timezone: string;
  min_lead_hours: number;
  max_advance_days: number;
  buffer_minutes: number;
  intake_form_id?: string | null;
  no_show_limit: number;
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
  status: string;
  token?: string;
  reschedule_count: number;
  no_show: boolean;
  invoice_id?: string | null;
  invoice_token?: string | null;
  client_id?: string | null;
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
  timezone: string;
  weekday_mask: string;
  start_minute: number;
  end_minute: number;
  min_lead_hours: number;
  max_advance_days: number;
  buffer_minutes: number;
  requires_payment: boolean;
  intake_form_id?: string | null;
  intake_token?: string | null;
}

export interface BookingSlots {
  consultation_token: string;
  timezone: string;
  slots: string[];
}

export interface PublicAppointment {
  consultation_title?: string;
  consultation_token?: string | null;
  client_name: string;
  appointment_time: string;
  status: string;
  payment_status: string;
  meeting_link?: string;
  reschedule_count: number;
  max_reschedules: number;
  invoice_token?: string | null;
}

export interface BookingAgenda {
  next_call?: BookingAppointment | null;
  hours_to_next?: number | null;
  today_calls: BookingAppointment[];
  week_booked: number;
  week_available: number;
  no_show_count: number;
  prepayment_required: boolean;
}

export interface BookingConsultationPayload {
  title: string;
  description?: string;
  duration_minutes: number;
  price: number;
  meeting_provider: string;
  is_active: boolean;
  weekday_mask?: string;
  start_minute?: number;
  end_minute?: number;
  timezone?: string;
  min_lead_hours?: number;
  max_advance_days?: number;
  buffer_minutes?: number;
  intake_form_id?: string | null;
  no_show_limit?: number;
}

export const getBookings = async (token?: string): Promise<BookingConsultation[]> => {
  const response = await apiClient.get<BookingConsultation[]>('/booking', authHeaders(token));
  return response.data;
};

export const createBooking = async (payload: BookingConsultationPayload, token?: string): Promise<BookingConsultation> => {
  const response = await apiClient.post<BookingConsultation>('/booking', payload, authHeaders(token));
  return response.data;
};

export const updateBooking = async (id: string, payload: BookingConsultationPayload, token?: string): Promise<BookingConsultation> => {
  const response = await apiClient.put<BookingConsultation>(`/booking/${id}`, payload, authHeaders(token));
  return response.data;
};

export const deleteBooking = async (bookingId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/booking/${bookingId}`, authHeaders(token));
};

export const getBookingAppointments = async (status?: string, token?: string): Promise<BookingAppointment[]> => {
  const response = await apiClient.get<BookingAppointment[]>('/booking/appointments', {
    ...authHeaders(token),
    params: status ? { status } : undefined,
  });
  return response.data;
};

export const getBookingAgenda = async (token?: string): Promise<BookingAgenda> => {
  const response = await apiClient.get<BookingAgenda>('/booking/agenda', authHeaders(token));
  return response.data;
};

export const setAppointmentStatus = async (
  appointmentId: string,
  status: "confirmed" | "cancelled" | "no_show" | "completed",
  token?: string
): Promise<BookingAppointment> => {
  const response = await apiClient.post<BookingAppointment>(`/booking/appointments/${appointmentId}/status`, { status }, authHeaders(token));
  return response.data;
};

export const listBlockedDays = async (consultationId: string, token?: string): Promise<string[]> => {
  const response = await apiClient.get<{ blocked_days: string[] }>(`/booking/${consultationId}/blocked-days`, authHeaders(token));
  return response.data.blocked_days;
};

export const addBlockedDay = async (consultationId: string, date: string, token?: string): Promise<void> => {
  await apiClient.post(`/booking/${consultationId}/blocked-days`, null, { ...authHeaders(token), params: { date } });
};

export const removeBlockedDay = async (consultationId: string, date: string, token?: string): Promise<void> => {
  await apiClient.delete(`/booking/${consultationId}/blocked-days`, { ...authHeaders(token), params: { date } });
};

export const getPublicBooking = async (token: string): Promise<PublicBookingConsultation> => {
  const response = await apiClient.get<PublicBookingConsultation>(`/booking/public/${token}`);
  return response.data;
};

export const getPublicBookingSlots = async (token: string, days = 14): Promise<BookingSlots> => {
  const response = await apiClient.get<BookingSlots>(`/booking/public/${token}/slots`, { params: { days } });
  return response.data;
};

export const schedulePublicBooking = async (
  token: string,
  payload: { client_name: string; client_email: string; appointment_time: string; notes?: string }
): Promise<BookingAppointment> => {
  const response = await apiClient.post<BookingAppointment>(`/booking/public/${token}/schedule`, payload);
  return response.data;
};

export const getPublicAppointment = async (apptToken: string): Promise<PublicAppointment> => {
  const response = await apiClient.get<PublicAppointment>(`/booking/public/appointments/${apptToken}`);
  return response.data;
};

export const reschedulePublicAppointment = async (
  apptToken: string,
  appointment_time: string
): Promise<PublicAppointment> => {
  const response = await apiClient.post<PublicAppointment>(`/booking/public/appointments/${apptToken}/reschedule`, { appointment_time });
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
  board_id: string;
  text: string;
  is_done: boolean;
  due_date?: string | null;
  priority?: string;
  project_id?: string | null;
  recurrence?: string | null;
  date?: string | null;
  start_minute?: number | null;
  duration_minutes?: number | null;
  created_at: string;
  updated_at: string;
}

// Payload for creating/planning a todo (PL1/PL2/PL3). Every field except text
// is optional so a bare to-do still works; the editor fills them in inline.
export interface PlannerTodoPayload {
  text?: string;
  is_done?: boolean;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  project_id?: string | null;
  recurrence?: 'daily' | 'weekly' | null;
  date?: string | null;
  start_minute?: number | null;
  duration_minutes?: number | null;
}

export interface PlannerBoardSummary {
  id: string;
  name: string;
  revision: number;
  todos_count: number;
  done_count: number;
  overdue_count: number;
  due_today_count: number;
  planned_today_count: number;
  is_public: boolean;
  has_share: boolean;
  share_expires_at?: string | null;
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
  today?: string | null;
}

export interface PlannerShare {
  is_public: boolean;
  share_token?: string | null;
  share_url?: string | null;
  expires_at?: string | null;
}

export interface PlannerSnapshotSummary {
  captured_on: string;
  revision: number;
  created_at: string;
}

export interface PlannerSnapshot {
  captured_on: string;
  revision: number;
  elements: Record<string, unknown>[];
  files: Record<string, Record<string, unknown>>;
}

export interface PublicPlannerBoard {
  name: string;
  elements: Record<string, unknown>[];
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
  payload: PlannerTodoPayload,
  token?: string
): Promise<PlannerTodo> => {
  const response = await apiClient.post<PlannerTodo>(`/planner/boards/${boardId}/todos`, payload, authHeaders(token));
  return response.data;
};

export const updatePlannerTodo = async (
  todoId: string,
  payload: PlannerTodoPayload,
  token?: string
): Promise<PlannerTodo> => {
  const response = await apiClient.patch<PlannerTodo>(`/planner/todos/${todoId}`, payload, authHeaders(token));
  return response.data;
};

export const deletePlannerTodo = async (todoId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/planner/todos/${todoId}`, authHeaders(token));
};

// PL5 — read-only share link. enable/disable/rotate are authenticated; the
// anonymous viewer hits getPublicPlannerBoard (no token header).
export const enablePlannerShare = async (
  boardId: string,
  expiresAt: string | null,
  token?: string
): Promise<PlannerShare> => {
  const response = await apiClient.post<PlannerShare>(`/planner/boards/${boardId}/share`, { expires_at: expiresAt }, authHeaders(token));
  return response.data;
};

export const rotatePlannerShareToken = async (boardId: string, token?: string): Promise<PlannerShare> => {
  const response = await apiClient.post<PlannerShare>(`/planner/boards/${boardId}/rotate-share-token`, {}, authHeaders(token));
  return response.data;
};

export const disablePlannerShare = async (boardId: string, token?: string): Promise<PlannerShare> => {
  const response = await apiClient.delete<PlannerShare>(`/planner/boards/${boardId}/share`, authHeaders(token));
  return response.data;
};

export const getPublicPlannerBoard = async (shareToken: string): Promise<PublicPlannerBoard> => {
  const response = await apiClient.get<PublicPlannerBoard>(`/planner/public/${shareToken}`);
  return response.data;
};

// PL4 — daily snapshots + time travel.
export const listPlannerSnapshots = async (
  boardId: string,
  token?: string
): Promise<PlannerSnapshotSummary[]> => {
  const response = await apiClient.get<PlannerSnapshotSummary[]>(`/planner/boards/${boardId}/snapshots`, authHeaders(token));
  return response.data;
};

export const getPlannerSnapshot = async (
  boardId: string,
  capturedOn: string,
  token?: string
): Promise<PlannerSnapshot> => {
  const response = await apiClient.get<PlannerSnapshot>(`/planner/boards/${boardId}/snapshots/${capturedOn}`, authHeaders(token));
  return response.data;
};

export const restorePlannerSnapshot = async (
  boardId: string,
  capturedOn: string,
  token?: string
): Promise<{ revision: number }> => {
  const response = await apiClient.post<{ revision: number }>(`/planner/boards/${boardId}/snapshots/${capturedOn}/restore`, {}, authHeaders(token));
  return response.data;
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



