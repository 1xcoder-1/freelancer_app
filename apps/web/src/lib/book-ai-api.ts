import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Own axios instance so this feature stays isolated from the shared apiClient
// (which has retry/error-formatting interceptors we don't need here).
const bookAiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000,
});

const authHeaders = (token?: string) =>
  token ? { headers: { Authorization: `Bearer ${token}` } } : {};

/**
 * A reference to a record the assistant used to answer. Non-interactive for
 * now — `type`/`id` are known so a future tap can deep-link to the source.
 */
export interface BookAICitation {
  label: string;
  type: string;
  id: string;
}

/**
 * `intent` is the routed question category (e.g. billing_total, effective_rate,
 * unbilled, fallback). Kept as `string` because the backend set may grow while
 * the endpoints are being built concurrently.
 */
export interface BookAIAskResponse {
  answer: string;
  intent: string;
  citations: BookAICitation[];
}

export interface BookAIStatusResponse {
  available: boolean;
  capabilities: string[];
}

export const askBookAI = async (
  question: string,
  token?: string
): Promise<BookAIAskResponse> => {
  const response = await bookAiClient.post<BookAIAskResponse>(
    "/book-ai/ask",
    { question },
    authHeaders(token)
  );
  return {
    answer: response.data.answer ?? "",
    intent: response.data.intent ?? "fallback",
    // Defend against a missing/null citations array from the in-flight backend.
    citations: Array.isArray(response.data.citations) ? response.data.citations : [],
  };
};

export const getBookAIStatus = async (
  token?: string
): Promise<BookAIStatusResponse> => {
  const response = await bookAiClient.get<BookAIStatusResponse>(
    "/book-ai/status",
    authHeaders(token)
  );
  return {
    available: Boolean(response.data.available),
    capabilities: Array.isArray(response.data.capabilities)
      ? response.data.capabilities
      : [],
  };
};
