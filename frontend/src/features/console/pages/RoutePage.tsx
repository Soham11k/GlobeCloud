import { useState } from "react";
import { useRouteMutation, useRegions, useLiveMetrics } from "@/lib/hooks";
import { useConsole } from "../ConsoleContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel, DataTable, Chip, Field } from "../components/ui";
import { GlobeScenePanel } from "@/components/globe/GlobeScenePanel";
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
      .map((p) => [p.region_id, (p as { latency_ms: number }).latency_ms])
  );
  const healthy = Object.fromEntries((probes ?? []).map((p) => [p.region_id, p.healthy]));
  const selectedRegion = route.data?.selected_region ?? region;

  const run = () => {
    const latN = parseFloat(lat);
    const lonN = parseFloat(lon);
    route.mutate(
      { lat: latN, lon: lonN, preferred: preferred || undefined },
      {
        onSuccess: (data) => {
          setRegion(data.selected_region);
          setClient({ lat: latN, lon: lonN });
          toast.success(`Routed to ${data.selected_region}`);
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Geo routing"
        description="Latency probes and circuit state pick the best regional backend for each request."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Probe map">
          <GlobeScenePanel
            className="w-full"
            height="16rem"
            regions={regions?.regions}
            latencies={latencies}
            healthy={healthy}
            variant="panel"
            client={client}
            selected={selectedRegion}
            showArc
            interactive
          />
        </Panel>

        <div className="space-y-6">
          <Panel title="Route request">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Latitude">
                  <Input type="number" step="0.01" value={lat} onChange={(e) => setLat(e.target.value)} />
                </Field>
                <Field label="Longitude">
                  <Input type="number" step="0.01" value={lon} onChange={(e) => setLon(e.target.value)} />
                </Field>
              </div>
              <Field label="Preferred region">
                <Select value={preferred || "__auto"} onValueChange={(v) => setPreferred(v === "__auto" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auto — lowest latency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto">Auto — lowest latency</SelectItem>
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
                  {route.isPending ? "Probing…" : "Route request"}
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
                  Use my location
                </Button>
              </div>
            </div>
          </Panel>

          {route.data && (
            <Panel title="Selection">
              <p className="text-sm mb-4">
                {route.data.selected_name}{" "}
                <Chip variant="ok">{route.data.selected_region}</Chip>
                {route.data.is_local && <Chip className="ml-1">local</Chip>}
              </p>
              <DataTable
                headers={["Region", "ms", "Probe", "Circuit", "Peer"]}
                rows={route.data.probes.map((p) => [
                  p.region_id,
                  p.latency_ms ?? "—",
                  p.probe_mode ?? "—",
                  p.circuit ?? "—",
                  p.peer_url ?? (p.is_local ? "local" : "—"),
                ])}
              />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
