export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
}

export interface Client {
  id: string;
  workspaceId: string;
  name: string;
  companyName?: string;
  email: string;
  phone?: string;
  status: 'lead' | 'active' | 'archived';
  createdAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  clientId: string;
  name: string;
  description?: string;
  status: 'draft' | 'in_progress' | 'completed' | 'on_hold';
  budget?: number;
  startDate?: string;
  dueDate?: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
}

export interface Invoice {
  id: string;
  workspaceId: string;
  clientId: string;
  number: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: string;
  createdAt: string;
}
