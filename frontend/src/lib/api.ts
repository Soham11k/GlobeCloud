const API_BASE = "/api/v1";

import { API_KEY_STORAGE } from "./utils";

export function getApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || "";
}

export function setApiKey(key: string) {
  if (key) localStorage.setItem(API_KEY_STORAGE, key);
  else localStorage.removeItem(API_KEY_STORAGE);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  retried = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const key = getApiKey();
  if (key) headers["X-API-Key"] = key;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const message =
      typeof detail.detail === "string" ? detail.detail : `Request failed (${response.status})`;

    if (response.status === 401 && key) {
      setApiKey("");
      if (!retried) return api(path, options, true);
      throw new ApiError(`${message} — API key cleared.`, 401);
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export type ProductInfo = {
  name: string;
  tagline: string;
  deployment_mode: string;
  local_region?: string;
  regions: number;
  auth_required: boolean;
  llm_mode: string;
};

export type HealthInfo = {
  status: string;
  deployment_mode: string;
  region?: string;
  llm_mode: string;
  healthy_regions?: number;
  replication_running?: boolean;
};

export type RouterMetric = {
  region_id: string;
  healthy: boolean;
  latency_ms: number | null;
  circuit?: string;
};

export type MetricsInfo = {
  router: RouterMetric[];
  inference_cache?: { hit_rate?: number };
};

export type RouteResult = {
  selected_region: string;
  selected_name: string;
  probes: RouterMetric[];
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
};

export type SyncStatus = {
  running: boolean;
  cycles: number;
  regions?: Record<
    string,
    { stats?: { entries?: number }; sync_lag?: { peer_region: string; behind_by: number }[] }
  >;
};

export type AgentResponse = {
  answer: string;
  confidence: string;
  backend_region?: string;
  citations?: { title: string; region: string; score: number; body: string }[];
  inference: { provider: string; latency_ms: number };
};

export async function* streamAgentAsk(body: {
  question: string;
  client_lat: number;
  client_lon: number;
}): AsyncGenerator<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = getApiKey();
  if (key) headers["X-API-Key"] = key;

  const response = await fetch(`${API_BASE}/agent/ask/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new ApiError(
      typeof detail.detail === "string" ? detail.detail : "Stream failed",
      response.status
    );
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.token) yield parsed.token;
        } catch {
          /* skip */
        }
      }
    }
  }
}
