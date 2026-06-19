import { useMemo, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import type { RegionInfo } from "@/lib/api";
import { REGION_LABELS } from "@/lib/utils";

const projection = geoNaturalEarth1().scale(160).translate([500, 250]);
const pathGen = geoPath(projection);
const graticule = geoGraticule10();

const landFeature = feature(
  world as unknown as Topology,
  (world as unknown as Topology).objects.countries
);

type MapRegion = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  latency?: number;
};

const FALLBACK_REGIONS: MapRegion[] = [
  { id: "us-east-1", lat: 37.43, lon: -78.66, label: "US East" },
  { id: "eu-west-1", lat: 53.35, lon: -6.26, label: "EU West" },
  { id: "ap-south-1", lat: 19.08, lon: 72.88, label: "AP South" },
];

type Probe = { region_id: string; healthy: boolean; latency_ms?: number | null; standby?: boolean };

type Props = {
  selected?: string;
  probes?: Probe[];
  client?: { lat: number; lon: number };
  showArc?: boolean;
  className?: string;
  regions?: RegionInfo[];
  interactive?: boolean;
};

function project(lat: number, lon: number) {
  const p = projection([lon, lat]);
  return p ? { x: p[0], y: p[1] } : { x: 500, y: 250 };
}

function arcPath(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  const my = Math.min(y1, y2) - 60 - Math.abs(x2 - x1) * 0.08;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

function toMapRegions(regions?: RegionInfo[], probes?: Probe[]): MapRegion[] {
  const probeMap = Object.fromEntries((probes ?? []).map((p) => [p.region_id, p]));
  if (!regions?.length) {
    return FALLBACK_REGIONS.map((r) => ({
      ...r,
      latency: probeMap[r.id]?.latency_ms ?? undefined,
    }));
  }
  return regions.map((r) => ({
    id: r.id,
    lat: r.latitude,
    lon: r.longitude,
    label: REGION_LABELS[r.id] ?? r.name ?? r.id,
    latency: probeMap[r.id]?.latency_ms ?? undefined,
  }));
}

export function GlobeMap({
  selected,
  probes = [],
  client,
  showArc,
  className,
  regions,
  interactive = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [cursorClient, setCursorClient] = useState<{ lat: number; lon: number } | null>(null);

  const mapRegions = useMemo(() => toMapRegions(regions, probes), [regions, probes]);
  const probeMap = Object.fromEntries(probes.map((p) => [p.region_id, p]));
  const effectiveClient = interactive && cursorClient ? cursorClient : client;
  const clientPt = effectiveClient ? project(effectiveClient.lat, effectiveClient.lon) : null;
  const selectedRegion = mapRegions.find((r) => r.id === selected);
  const selectedPt = selectedRegion ? project(selectedRegion.lat, selectedRegion.lon) : null;
  const hoveredRegion = mapRegions.find((r) => r.id === hovered);

  const landPaths = useMemo(() => {
    if (!landFeature) return null;
    if ("features" in landFeature) {
      return landFeature.features.map((f, i) => (
        <path
          key={i}
          d={pathGen(f) ?? ""}
          fill="#1e293b"
          opacity={0.75}
          stroke="#5b52ff"
          strokeWidth={0.35}
          strokeOpacity={0.25}
          filter="url(#coastGlow)"
        />
      ));
    }
    return (
      <path
        d={pathGen(landFeature) ?? ""}
        fill="#1e293b"
        opacity={0.75}
        stroke="#5b52ff"
        strokeWidth={0.35}
        filter="url(#coastGlow)"
      />
    );
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!interactive || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 1000;
      const y = ((e.clientY - rect.top) / rect.height) * 500;
      const inv = projection.invert?.([x, y]);
      if (inv) setCursorClient({ lat: inv[1], lon: inv[0] });
    },
    [interactive]
  );

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1000 500"
      className={className}
      aria-label="World map"
      onMouseMove={interactive ? onMouseMove : undefined}
      onMouseLeave={interactive ? () => setCursorClient(null) : undefined}
    >
      <defs>
        <linearGradient id="oceanGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#03030a" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <radialGradient id="oceanVignette" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="#03030a" stopOpacity={0.65} />
        </radialGradient>
        <filter id="coastGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="probeGlow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="1000" height="500" fill="url(#oceanGrad)" rx="8" />
      <rect width="1000" height="500" fill="url(#oceanVignette)" rx="8" pointerEvents="none" />

      <path
        d={pathGen(graticule) ?? ""}
        fill="none"
        stroke="#5b52ff"
        strokeWidth={0.25}
        opacity={0.12}
        pointerEvents="none"
      />

      <g>{landPaths}</g>

      {showArc && clientPt && selectedPt && (
        <motion.path
          d={arcPath(clientPt.x, clientPt.y, selectedPt.x, selectedPt.y)}
          fill="none"
          stroke="#5b52ff"
          strokeWidth="2"
          strokeDasharray="6 4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.9 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      )}

      {mapRegions.map((r) => {
        const pt = project(r.lat, r.lon);
        const probe = probeMap[r.id];
        const standby = probe?.standby;
        const healthy = probe?.healthy !== false && !standby;
        const isSelected = selected === r.id;
        const isHovered = hovered === r.id;
        return (
          <g
            key={r.id}
            onMouseEnter={() => setHovered(r.id)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer" }}
          >
            {healthy && (
              <motion.circle
                cx={pt.x}
                cy={pt.y}
                r={14}
                fill="none"
                stroke="#5b52ff"
                strokeWidth="1"
                initial={{ opacity: 0.5, r: 8 }}
                animate={{ opacity: 0, r: 22 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              />
            )}
            {isSelected && (
              <motion.circle
                cx={pt.x}
                cy={pt.y}
                r={20}
                fill="none"
                stroke="#5b52ff"
                strokeWidth="2"
                initial={{ opacity: 0.8, r: 12 }}
                animate={{ opacity: 0, r: 28 }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={isSelected || isHovered ? 9 : 7}
              fill={standby ? "#64748b" : healthy ? (isSelected ? "#5b52ff" : "#2dd4a0") : "#ef4444"}
              stroke="#fff"
              strokeWidth="1.5"
              filter={isSelected || isHovered ? "url(#probeGlow)" : undefined}
            />
            <text x={pt.x} y={pt.y + 20} textAnchor="middle" fill="#94a3b8" fontSize="10">
              {r.label}
            </text>
          </g>
        );
      })}

      {clientPt && (
        <g>
          <circle cx={clientPt.x} cy={clientPt.y} r={5} fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
          <text x={clientPt.x} y={clientPt.y - 10} textAnchor="middle" fill="#fbbf24" fontSize="9">
            {interactive ? "You" : "Client"}
          </text>
        </g>
      )}

      {hoveredRegion && (() => {
        const pt = project(hoveredRegion.lat, hoveredRegion.lon);
        const probe = probeMap[hoveredRegion.id];
        const latency = probe?.latency_ms ?? hoveredRegion.latency;
        return (
          <g pointerEvents="none">
            <rect
              x={pt.x - 52}
              y={pt.y - 48}
              width={104}
              height={36}
              rx={4}
              fill="#0c0c12"
              stroke="#5b52ff"
              strokeOpacity={0.4}
            />
            <text x={pt.x} y={pt.y - 32} textAnchor="middle" fill="#e8e6e1" fontSize="10" fontWeight="600">
              {hoveredRegion.label}
            </text>
            <text x={pt.x} y={pt.y - 18} textAnchor="middle" fill="#94a3b8" fontSize="9">
              {probe?.healthy !== false ? "healthy" : "down"}
              {latency != null ? ` · ${Math.round(latency)}ms` : ""}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
