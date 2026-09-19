import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Response interceptor for unified error formatting and resilience
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const customMessage =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      'An unexpected network error occurred. Please try again.';
    return Promise.reject(new Error(customMessage));
  }
);

// Helper to attach authorization header
const authHeaders = (token?: string) => (token ? { headers: { Authorization: `Bearer ${token}` } } : {});

// ------------------------------------------------------------------------------
// Health & Status
// ------------------------------------------------------------------------------
export interface HealthCheckResponse {
  status: string;
  service: string;
  timestamp: string;
  version: string;
}

export const checkBackendHealth = async (): Promise<HealthCheckResponse> => {
  const response = await apiClient.get<HealthCheckResponse>('/health');
  return response.data;
};

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
  created_at: string;
}

export const getClients = async (token?: string): Promise<Client[]> => {
  const response = await apiClient.get<Client[]>('/clients', authHeaders(token));
  return response.data;
};

export const createClient = async (payload: Partial<Client>, token?: string): Promise<Client> => {
  const response = await apiClient.post<Client>('/clients', payload, authHeaders(token));
  return response.data;
};

export const deleteClient = async (clientId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/clients/${clientId}`, authHeaders(token));
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

export const createMilestone = async (
  projectId: string,
  payload: { title: string; amount?: number; description?: string; deliverable_note?: string },
  token?: string
): Promise<Milestone> => {
  const response = await apiClient.post<Milestone>(`/projects/${projectId}/milestones`, payload, authHeaders(token));
  return response.data;
};

export const createTask = async (projectId: string, payload: Partial<Task>, token?: string): Promise<Task> => {
  const response = await apiClient.post<Task>(`/projects/${projectId}/tasks`, payload, authHeaders(token));
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
  items: InvoiceItem[];
  created_at: string;
}

export const getInvoices = async (token?: string): Promise<Invoice[]> => {
  const response = await apiClient.get<Invoice[]>('/invoices', authHeaders(token));
  return response.data;
};

export const createInvoice = async (payload: Partial<Invoice>, token?: string): Promise<Invoice> => {
  const response = await apiClient.post<Invoice>('/invoices', payload, authHeaders(token));
  return response.data;
};

export const updateInvoiceStatus = async (invoiceId: string, statusVal: string, token?: string) => {
  const response = await apiClient.patch(`/invoices/${invoiceId}/status?status_val=${statusVal}`, {}, authHeaders(token));
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

export const deleteExpense = async (expenseId: string, token?: string): Promise<void> => {
  await apiClient.delete(`/expenses/${expenseId}`, authHeaders(token));
};

// ------------------------------------------------------------------------------
// Cloudinary / Cloudflare Storage
// ------------------------------------------------------------------------------
export interface UploadSignatureResponse {
  provider: string;
  upload_url: string;
  api_key?: string;
  timestamp?: number;
  signature?: string;
  folder?: string;
  public_id?: string;
  file_key: string;
  is_mock?: boolean;
}

export const getUploadSignature = async (
  file_key: string,
  content_type: string = 'image/jpeg',
  category: string = 'receipts',
  token?: string
): Promise<UploadSignatureResponse> => {
  const response = await apiClient.post<UploadSignatureResponse>(
    '/storage/upload-signature',
    { file_key, content_type, category },
    authHeaders(token)
  );
  return response.data;
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

export const createIntakeForm = async (payload: Partial<IntakeForm>, token?: string): Promise<IntakeForm> => {
  const response = await apiClient.post<IntakeForm>('/intake', payload, authHeaders(token));
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

export const getFormSubmissions = async (formId: string, token?: string): Promise<IntakeSubmission[]> => {
  const response = await apiClient.get<IntakeSubmission[]>(`/intake/${formId}/submissions`, authHeaders(token));
  return response.data;
};

export const getIntakeSubmissions = getFormSubmissions;

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

export const schedulePublicAppointment = async (
  token: string,
  payload: { client_name: string; client_email: string; appointment_time: string; notes?: string }
): Promise<BookingAppointment> => {
  const response = await apiClient.post<BookingAppointment>(`/booking/public/${token}/schedule`, payload);
  return response.data;
};

export const schedulePublicBooking = schedulePublicAppointment;

// ------------------------------------------------------------------------------
// Developer Portfolio & Public Profile (LeetCode / MasterJi UI Style)
// ------------------------------------------------------------------------------
export interface SkillItem {
  name: string;
  count: number;
}

export interface SkillsCategory {
  advanced: SkillItem[];
  intermediate: SkillItem[];
  fundamental: SkillItem[];
}

export interface LanguageStat {
  language: string;
  solved_count: number;
  projects_count: number;
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

export interface BadgeItem {
  id: string;
  name: string;
  icon_type: string;
  category: string;
  date: string;
  description: string;
}

export interface HeatmapCell {
  date: string;
  count: number;
  level: number;
}

export interface FeaturedCaseStudy {
  id: string;
  title: string;
  author: string;
  category: string;
  progress_solved: number;
  progress_total: number;
  tags: string[];
  link?: string;
  description: string;
}

export interface RecentSubmission {
  id: string;
  title: string;
  client: string;
  status: string;
  time_ago: string;
  tags: string[];
  amount: number;
}

export interface TestimonialItem {
  id: string;
  client_name: string;
  client_avatar: string;
  company: string;
  rating: number;
  comment: string;
  project_title: string;
}

export interface DiscussionItem {
  id: string;
  title: string;
  upvotes: number;
  views: number;
  replies: number;
  time_ago: string;
}

export interface PortfolioProfile {
  username: string;
  full_name: string;
  avatar_url: string;
  headline: string;
  bio: string;
  rank: string;
  rank_percentile: string;
  following: number;
  followers: number;
  location: string;
  organization: string;
  website_url: string;
  github_url: string;
  twitter_url: string;
  linkedin_url: string;
  discord_handle: string;
  tags: string[];
  hourly_rate: number;
  views_count: number;
  solutions_count: number;
  discuss_count: number;
  reputation_score: number;
  active_days_count: number;
  current_streak: number;
  max_streak: number;
  languages: LanguageStat[];
  skills: SkillsCategory;
  delivery_stats: DeliveryStats;
  badges: BadgeItem[];
  heatmap: HeatmapCell[];
  featured_case_studies: FeaturedCaseStudy[];
  recent_submissions: RecentSubmission[];
  testimonials: TestimonialItem[];
  discussions: DiscussionItem[];
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

export const getShareStatus = async (token?: string): Promise<ShareStatusResponse> => {
  const response = await apiClient.get<ShareStatusResponse>('/portfolio/share/status', authHeaders(token));
  return response.data;
};

export const createShareLink = async (
  payload: { expiration: string; include_styling: boolean },
  token?: string
): Promise<ShareStatusResponse> => {
  const response = await apiClient.post<ShareStatusResponse>('/portfolio/share', payload, authHeaders(token));
  return response.data;
};

export const revokeShareLink = async (token?: string): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.delete<{ success: boolean; message: string }>('/portfolio/share', authHeaders(token));
  return response.data;
};

export const getPublicPortfolio = async (username: string, shareToken?: string | null): Promise<PortfolioProfile> => {
  const url = shareToken ? `/portfolio/${username}?token=${encodeURIComponent(shareToken)}` : `/portfolio/${username}`;
  const response = await apiClient.get<PortfolioProfile>(url);
  return response.data;
};

export const getMyPortfolio = async (token?: string): Promise<PortfolioProfile> => {
  const response = await apiClient.get<PortfolioProfile>('/portfolio/me/profile', authHeaders(token));
  return response.data;
};

export const updateMyPortfolio = async (payload: Partial<PortfolioProfile>, token?: string): Promise<PortfolioProfile> => {
  const response = await apiClient.put<PortfolioProfile>('/portfolio/me/profile', payload, authHeaders(token));
  return response.data;
};

export { cn } from './utils';


