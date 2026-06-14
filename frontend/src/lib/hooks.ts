import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type HealthInfo,
  type MetricsInfo,
  type ProductInfo,
  type RouteResult,
  type SyncStatus,
  type Product,
  type AgentResponse,
} from "./api";

export function useProduct() {
  return useQuery({
    queryKey: ["product"],
    queryFn: () => api<ProductInfo>("/product"),
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
  return useQuery({
    queryKey: ["metrics"],
    queryFn: () => api<MetricsInfo>("/metrics"),
    refetchInterval: 15000,
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ["sync"],
    queryFn: () => api<SyncStatus>("/sync/status"),
    refetchInterval: 5000,
  });
}

export function useGlobalStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["global-status"],
    queryFn: () => api<{ regions: RouterRegion[] }>("/global/status"),
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
    onSuccess: (_, { region }) => qc.invalidateQueries({ queryKey: ["products", region] }),
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
