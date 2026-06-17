import { useState } from "react";
import { useRouteMutation, useRegions } from "@/lib/hooks";
import { useConsole } from "../ConsoleContext";
import { Panel, DataTable, Chip, Field } from "../components/ui";
import { GlobeMap } from "@/components/GlobeMap";
import { toast } from "sonner";

export function RoutePage() {
  const { setRegion, setClient, client } = useConsole();
  const { data: regions } = useRegions();
  const route = useRouteMutation();
  const [lat, setLat] = useState(String(client.lat));
  const [lon, setLon] = useState(String(client.lon));
  const [preferred, setPreferred] = useState("");

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
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Geo routing</h1>
        <p className="console-mono mt-1 text-[var(--gc-dim)]">GET /api/v1/route — latency probes + circuit state</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Probe map">
          <GlobeMap
            selected={route.data?.selected_region}
            probes={route.data?.probes ?? regions?.regions.map((r) => ({ region_id: r.id, healthy: true }))}
            regions={regions?.regions}
            client={{ lat: parseFloat(lat) || 0, lon: parseFloat(lon) || 0 }}
            showArc={!!route.data}
            className="w-full h-64"
          />
        </Panel>

        <div className="space-y-4">
          <Panel title="Request">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="client_lat">
                  <input className="console-input" type="number" step="0.01" value={lat} onChange={(e) => setLat(e.target.value)} />
                </Field>
                <Field label="client_lon">
                  <input className="console-input" type="number" step="0.01" value={lon} onChange={(e) => setLon(e.target.value)} />
                </Field>
              </div>
              <Field label="preferred_region">
                <select className="console-input" value={preferred} onChange={(e) => setPreferred(e.target.value)}>
                  <option value="">auto — lowest latency</option>
                  {(regions?.regions ?? []).map((r) => (
                    <option key={r.id} value={r.id}>{r.id}</option>
                  ))}
                </select>
              </Field>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="console-btn console-btn-primary" onClick={run} disabled={route.isPending}>
                  {route.isPending ? "Probing…" : "Route"}
                </button>
                <button
                  type="button"
                  className="console-btn"
                  onClick={() =>
                    navigator.geolocation?.getCurrentPosition((p) => {
                      setLat(p.coords.latitude.toFixed(4));
                      setLon(p.coords.longitude.toFixed(4));
                    })
                  }
                >
                  Use my location
                </button>
              </div>
            </div>
          </Panel>

          {route.data && (
            <Panel title="Selection">
              <p className="console-mono text-sm mb-3">
                {route.data.selected_name}{" "}
                <Chip variant="ok">{route.data.selected_region}</Chip>
                {route.data.is_local && <Chip className="ml-1">local</Chip>}
              </p>
              <DataTable
                headers={["region", "ms", "circuit", "error", "peer"]}
                rows={route.data.probes.map((p) => [
                  p.region_id,
                  p.latency_ms ?? "—",
                  p.circuit ?? "—",
                  p.error_rate != null ? `${(p.error_rate * 100).toFixed(0)}%` : "—",
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
