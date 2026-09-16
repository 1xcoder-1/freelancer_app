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

export const checkBackendHealth = async (): Promise<HealthCheckResponse> => {
  const response = await apiClient.get<HealthCheckResponse>('/health');
  return response.data;
};

export const getSystemStatus = async (): Promise<SystemStatusResponse> => {
  const response = await apiClient.get<SystemStatusResponse>('/status');
  return response.data;
};
