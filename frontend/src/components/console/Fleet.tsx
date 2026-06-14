import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GlobeMap } from "@/components/GlobeMap";
import { useGlobalStatus } from "@/lib/hooks";

export function FleetPanel() {
  const { data, isLoading, isError, error } = useGlobalStatus(true);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden p-0">
        <GlobeMap
          probes={data?.regions.map((r) => ({ region_id: r.region_id, healthy: r.healthy }))}
          className="w-full h-72"
        />
      </Card>
      {isLoading ? (
        <div className="grid sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-danger text-sm">{(error as Error).message}</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4">
          {data?.regions.map((r) => (
            <Card key={r.region_id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  {r.region_id}
                  <Badge variant={r.healthy ? "success" : "danger"}>
                    {r.healthy ? "healthy" : "down"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{r.latency_ms ?? "—"} ms</p>
                <p className="text-xs text-muted-foreground">probe latency</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
