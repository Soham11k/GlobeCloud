import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GlobeMap } from "@/components/GlobeMap";
import { useRouteMutation } from "@/lib/hooks";
import { markChecklist } from "./Overview";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
} from "recharts";

const PRESETS = [
  { label: "NYC", lat: 40.71, lon: -74.01 },
  { label: "London", lat: 51.51, lon: -0.13 },
  { label: "Mumbai", lat: 19.08, lon: 72.88 },
];

export function RoutingPanel({
  onRouted,
}: {
  onRouted?: (region: string) => void;
}) {
  const [lat, setLat] = useState("40.71");
  const [lon, setLon] = useState("-74.01");
  const [preferred, setPreferred] = useState("");
  const route = useRouteMutation();

  const run = () => {
    route.mutate(
      { lat: parseFloat(lat), lon: parseFloat(lon), preferred: preferred || undefined },
      {
        onSuccess: (data) => {
          markChecklist("routed");
          onRouted?.(data.selected_region);
        },
      }
    );
  };

  const chartData =
    route.data?.probes.map((p) => ({
      name: p.region_id.split("-")[0],
      ms: p.latency_ms ?? 0,
      selected: p.region_id === route.data?.selected_region,
    })) ?? [];

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card className="overflow-hidden p-0">
          <GlobeMap
            selected={route.data?.selected_region}
            probes={route.data?.probes}
            client={{ lat: parseFloat(lat), lon: parseFloat(lon) }}
            className="w-full h-64 lg:h-80"
          />
        </Card>
      </motion.div>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Route from lat/lon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Latitude</label>
              <Input value={lat} onChange={(e) => setLat(e.target.value)} type="number" step="0.01" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Longitude</label>
              <Input value={lon} onChange={(e) => setLon(e.target.value)} type="number" step="0.01" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Preferred region</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={preferred}
                onChange={(e) => setPreferred(e.target.value)}
              >
                <option value="">Auto — lowest latency</option>
                <option value="us-east-1">us-east-1</option>
                <option value="eu-west-1">eu-west-1</option>
                <option value="ap-south-1">ap-south-1</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={run} disabled={route.isPending}>
                <Navigation className="h-4 w-4" />
                {route.isPending ? "Routing…" : "Route request"}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  navigator.geolocation?.getCurrentPosition((p) => {
                    setLat(p.coords.latitude.toFixed(2));
                    setLon(p.coords.longitude.toFixed(2));
                  })
                }
              >
                <MapPin className="h-4 w-4" /> My location
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLat(String(p.lat));
                    setLon(String(p.lon));
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            {route.data ? (
              <>
                <p className="text-sm mb-3">
                  Selected: <strong>{route.data.selected_name}</strong>{" "}
                  <Badge variant="accent">{route.data.selected_region}</Badge>
                </p>
                <div className="space-y-1 text-sm mb-4">
                  {route.data.probes.map((p) => (
                    <div key={p.region_id} className="flex justify-between py-1 border-b border-border/50">
                      <span>{p.region_id}</span>
                      <span className="text-muted-foreground">{p.latency_ms ?? "—"} ms</span>
                    </div>
                  ))}
                </div>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                      <Bar dataKey="ms" radius={[4, 4, 0, 0]}>
                        {chartData.map((e, i) => (
                          <Cell key={i} fill={e.selected ? "#3b82f6" : "#52525b"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Run a route to see region selection.</p>
            )}
            {route.isError && (
              <p className="text-sm text-danger mt-2">{(route.error as Error).message}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
