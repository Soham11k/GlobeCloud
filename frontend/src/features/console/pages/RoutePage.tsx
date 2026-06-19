import { useState } from "react";
import { useRouteMutation, useRegions, useLiveMetrics } from "@/lib/hooks";
import { useConsole } from "../ConsoleContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel, DataTable, Chip, Field } from "../components/ui";
import { CodeBlock } from "../components/CodeBlock";
import { GeoVizPanel } from "@/components/globe/GeoVizPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export function RoutePage() {
  const { setRegion, setClient, client, region } = useConsole();
  const { data: regions } = useRegions();
  const { data: liveMetrics } = useLiveMetrics();
  const route = useRouteMutation();
  const [lat, setLat] = useState(String(client.lat));
  const [lon, setLon] = useState(String(client.lon));
  const [preferred, setPreferred] = useState("");

  const probes = route.data?.probes ?? liveMetrics?.router ?? regions?.regions.map((r) => ({ region_id: r.id, healthy: true }));
  const latencies = Object.fromEntries(
    (probes ?? [])
      .filter((p) => "latency_ms" in p && p.latency_ms != null)
      .map((p) => [p.region_id, (p as { latency_ms: number }).latency_ms]),
  );
  const healthy = Object.fromEntries((probes ?? []).map((p) => [p.region_id, p.healthy]));
  const selectedRegion = route.data?.selected_region ?? region;

  const latN = parseFloat(lat);
  const lonN = parseFloat(lon);
  const curlExample = `curl -s -X POST /api/v1/route \\
  -H "Content-Type: application/json" \\
  -d '{"client_lat": ${Number.isFinite(latN) ? latN : 40.71}, "client_lon": ${Number.isFinite(lonN) ? lonN : -74.01}${preferred ? `, "preferred_region": "${preferred}"` : ""}}'`;

  const run = () => {
    if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
      toast.error("Invalid coordinates");
      return;
    }
    route.mutate(
      { lat: latN, lon: lonN, preferred: preferred || undefined },
      {
        onSuccess: (data) => {
          setRegion(data.selected_region);
          setClient({ lat: latN, lon: lonN });
          toast.success(`Routed to ${data.selected_region}`);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Geo routing"
        meta="POST /api/v1/route"
        description="Probes regional Postgres peers and selects the lowest-latency backend."
      />

      <div className="console-panel overflow-hidden">
        <GeoVizPanel
          className="w-full rounded-none border-0"
          height="min(360px, 45vh)"
          variant="hero"
          regions={regions?.regions}
          latencies={latencies}
          healthy={healthy}
          client={client}
          selected={selectedRegion}
          showArc
          interactive
          showMapInset
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Request">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="client_lat">
                <Input type="number" step="0.01" value={lat} onChange={(e) => setLat(e.target.value)} className="font-mono" />
              </Field>
              <Field label="client_lon">
                <Input type="number" step="0.01" value={lon} onChange={(e) => setLon(e.target.value)} className="font-mono" />
              </Field>
            </div>
            <Field label="preferred_region">
              <Select value={preferred || "__auto"} onValueChange={(v) => setPreferred(v === "__auto" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="auto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto">auto (lowest latency)</SelectItem>
                  {(regions?.regions ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={run} disabled={route.isPending}>
                {route.isPending ? "Probing…" : "Run route"}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  navigator.geolocation?.getCurrentPosition((p) => {
                    setLat(p.coords.latitude.toFixed(4));
                    setLon(p.coords.longitude.toFixed(4));
                  })
                }
              >
                Use geolocation
              </Button>
            </div>
          </div>
        </Panel>

        <CodeBlock code={curlExample} language="curl" />
      </div>

      {route.data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Response">
            <p className="mb-3 text-sm">
              {route.data.selected_name}{" "}
              <Chip variant="ok">{route.data.selected_region}</Chip>
              {route.data.is_local && <Chip className="ml-1">local</Chip>}
            </p>
            <CodeBlock code={JSON.stringify(route.data, null, 2)} language="json" />
          </Panel>
          <Panel title="Probes">
            <DataTable
              headers={["region_id", "ms", "probe_mode", "circuit", "peer_url"]}
              rows={route.data.probes.map((p) => [
                p.region_id,
                p.latency_ms ?? "—",
                p.probe_mode ?? "—",
                p.circuit ?? "—",
                p.peer_url ?? (p.is_local ? "local" : "—"),
              ])}
            />
          </Panel>
        </div>
      )}
    </div>
  );
}
