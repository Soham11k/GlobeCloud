import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  api,
  type HealthInfo,
  type MetricsInfo,
  type ProductInfo,
  type CatalogInfo,
  type RouteResult,
  type SyncStatus,
  type Product,
  type AgentResponse,
  type Order,
  type ActivityItem,
  type MetricPoint,
  type RegionsResponse,
  type KnowledgeDoc,
  type AuditEntry,
  type MetricsSummary,
} from "./api";
import { pushMetric, sparklineData } from "./metricsBuffer";

export function useProduct() {
  return useQuery({
    queryKey: ["product"],
    queryFn: () => api<ProductInfo>("/product"),
    retry: 1,
  });
}

export function useRegions() {
  return useQuery({
    queryKey: ["regions"],
    queryFn: () => api<RegionsResponse>("/regions"),
    staleTime: 60000,
  });
}

export function useKnowledge(region: string) {
  return useQuery({
    queryKey: ["knowledge", region],
    queryFn: () => api<{ region: string; documents: KnowledgeDoc[]; is_local: boolean }>(
      `/regions/${region}/knowledge`
    ),
    enabled: !!region,
  });
}

export function useAudit(limit = 50) {
  return useQuery({
    queryKey: ["audit", limit],
    queryFn: () => api<{ entries: AuditEntry[] }>(`/audit?limit=${limit}`),
    refetchInterval: 15000,
  });
}

export function useMetricsSummary(metric = "latency_ms", sinceHours = 24) {
  return useQuery({
    queryKey: ["metrics-summary", metric, sinceHours],
    queryFn: () => api<MetricsSummary>(`/metrics/summary?metric=${metric}&since_hours=${sinceHours}`),
    refetchInterval: 30000,
  });
}

export function useCatalog(region = "us-east-1") {
  return useQuery({
    queryKey: ["catalog", region],
    queryFn: () => api<CatalogInfo>(`/catalog?region_id=${region}`),
    retry: 1,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => api<HealthInfo>("/health"),
    refetchInterval: 15000,
  });
}

export function useMetrics() {
  const q = useQuery({
    queryKey: ["metrics"],
    queryFn: () => api<MetricsInfo>("/metrics"),
    refetchInterval: 15000,
  });
  useEffect(() => {
    q.data?.router.forEach((r) => {
      if (r.latency_ms != null) pushMetric(`latency:${r.region_id}`, r.latency_ms);
    });
    if (q.data?.inference_cache?.hit_rate != null) {
      pushMetric("cache_hit", q.data.inference_cache.hit_rate * 100);
    }
  }, [q.data]);
  return q;
}

export function useMetricsHistory(metric = "latency_ms", sinceHours = 24) {
  return useQuery({
    queryKey: ["metrics-history", metric, sinceHours],
    queryFn: () =>
      api<{ points: MetricPoint[] }>(
        `/metrics/history?metric=${metric}&since_hours=${sinceHours}`
      ),
    refetchInterval: 30000,
  });
}

export function useMetricsStream(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/v1/stream/metrics");
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          qc.setQueryData(["metrics-stream"], data);
          data.router?.forEach((r: { region_id: string; latency_ms: number | null }) => {
            if (r.latency_ms != null) pushMetric(`latency:${r.region_id}`, r.latency_ms);
          });
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* SSE unavailable */
    }
    return () => es?.close();
  }, [enabled, qc]);
}

export function useSparkline(key: string) {
  return sparklineData(key);
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ["sync"],
    queryFn: () => api<SyncStatus>("/sync/status"),
    refetchInterval: 5000,
  });
}

export function useActivity() {
  return useQuery({
    queryKey: ["activity"],
    queryFn: () => api<{ items: ActivityItem[] }>("/activity"),
    refetchInterval: 10000,
  });
}

export function useOrders(region: string) {
  return useQuery({
    queryKey: ["orders", region],
    queryFn: () => api<{ orders: Order[] }>(`/regions/${region}/orders?limit=50`),
    enabled: !!region,
    refetchInterval: 15000,
  });
}

export function useGlobalStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["global-status"],
    queryFn: () =>
      api<{
        status: string;
        healthy_regions: number;
        total_regions: number;
        regions: {
          region_id: string;
          peer_url: string;
          healthy: boolean;
          latency_ms?: number;
        }[];
      }>("/global/status"),
    enabled,
    refetchInterval: 15000,
  });
}

export type RouterRegion = {
  region_id: string;
  healthy: boolean;
  latency_ms?: number;
};

export function useProducts(region: string) {
  return useQuery({
    queryKey: ["products", region],
    queryFn: () =>
      api<{ products: Product[]; is_local: boolean }>(`/regions/${region}/products`),
    enabled: !!region,
  });
}

export function useRouteMutation() {
  return useMutation({
    mutationFn: (params: { lat: number; lon: number; preferred?: string }) => {
      const q = new URLSearchParams({
        client_lat: String(params.lat),
        client_lon: String(params.lon),
      });
      if (params.preferred) q.set("preferred_region", params.preferred);
      return api<RouteResult>(`/route?${q}`);
    },
  });
}

export function useOrderMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ region, productId }: { region: string; productId: string }) =>
      api(`/regions/${region}/orders`, {
        method: "POST",
        body: JSON.stringify({ product_id: productId, quantity: 1 }),
      }),
    onSuccess: (_, { region }) => {
      qc.invalidateQueries({ queryKey: ["products", region] });
      qc.invalidateQueries({ queryKey: ["orders", region] });
    },
  });
}

export function useSyncMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ entries_applied?: number }>("/sync/run", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sync"] }),
  });
}

export function useAgentMutation() {
  return useMutation({
    mutationFn: (body: {
      question: string;
      client_lat: number;
      client_lon: number;
    }) =>
      api<AgentResponse>("/agent/ask", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}
