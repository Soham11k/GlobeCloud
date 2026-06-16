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
  version?: string;
  deployment_mode: string;
  local_region?: string;
  regions: number;
  auth_required: boolean;
  llm_mode: string;
  is_simulated?: boolean;
  simulation_note?: string | null;
  catalog_products?: number;
  knowledge_docs?: number;
  features?: string[];
  peers?: string[];
  public_url?: string | null;
};

export type RegionInfo = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  base_latency_ms: number;
  is_local: boolean;
  peer_url?: string | null;
};

export type RegionsResponse = {
  local_region: string;
  deployment_mode: string;
  regions: RegionInfo[];
};

export type CatalogInfo = {
  region: string;
  plans: Product[];
  addons: Product[];
  products_total: number;
  knowledge_docs: number;
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
  error_rate?: number;
  is_local?: boolean;
  peer_url?: string | null;
};

export type MetricsInfo = {
  deployment_mode?: string;
  local_region?: string;
  router: RouterMetric[];
  inference_cache?: {
    hit_rate?: number;
    cache_entries?: number;
    cache_hits?: number;
    cache_misses?: number;
  };
};

export type RouteResult = {
  selected_region: string;
  selected_name: string;
  is_local?: boolean;
  peer_url?: string | null;
  probes: RouterMetric[];
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  description?: string;
  category?: string;
  image_url?: string;
};

export type Order = {
  id: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  quantity: number;
  region: string;
  created_at: string;
};

export type ActivityItem = {
  type: string;
  ts: string;
  summary: string;
  duration_ms?: number;
  selected_region?: string;
};

export type MetricPoint = {
  ts: string;
  region_id?: string;
  metric: string;
  value: number;
  labels?: Record<string, unknown>;
};

export type SyncStatus = {
  running: boolean;
  cycles: number;
  interval_s?: number;
  mode?: string;
  local_region?: string;
  last_entries_applied?: number;
  peer_errors?: number;
  regions?: Record<
    string,
    {
      local?: boolean;
      peer_url?: string | null;
      stats?: {
        products?: number;
        orders?: number;
        replication_log_entries?: number;
        entries?: number;
      };
      sync_lag?: { peer_region: string; behind_by: number; last_applied_seq?: number; local_head_seq?: number }[];
    }
  >;
};

export type KnowledgeDoc = {
  id: string;
  title: string;
  body: string;
  region: string;
  updated_at: string;
};

export type AuditEntry = {
  ts: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  client_ip?: string;
};

export type MetricsSummary = {
  metric: string;
  summary: {
    count: number;
    min?: number;
    max?: number;
    avg?: number;
    p50?: number;
    p95?: number;
  };
};

export type AgentResponse = {
  answer: string;
  confidence: string;
  backend_region?: string;
  citations?: { title: string; region: string; score: number; body: string }[];
  tool_trace?: { tool: string; input?: Record<string, unknown>; output?: unknown }[];
  inference: { provider: string; model?: string; latency_ms: number };
};

export type AgentStreamResult = {
  answer: string;
  meta?: AgentResponse;
};

export async function streamAgentAsk(
  body: {
    question: string;
    client_lat: number;
    client_lon: number;
  },
  onToken?: (full: string) => void
): Promise<AgentStreamResult> {
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
  if (!reader) return { answer: "" };

  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let meta: AgentResponse | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return { answer, meta };
      try {
        const parsed = JSON.parse(data);
        if (parsed.token) {
          answer += parsed.token;
          onToken?.(answer);
        }
        if (parsed.done && parsed.meta) meta = parsed.meta as AgentResponse;
      } catch {
        /* skip */
      }
    }
  }
  return { answer, meta };
}
