import { motion } from "framer-motion";
import { geoNaturalEarth1 } from "d3-geo";

const REGIONS = [
  { id: "us-east-1", lat: 37.43, lon: -78.66, label: "US East" },
  { id: "eu-west-1", lat: 53.35, lon: -6.26, label: "EU West" },
  { id: "ap-south-1", lat: 19.08, lon: 72.88, label: "AP South" },
];

const projection = geoNaturalEarth1().scale(160).translate([500, 250]);
const landPath =
  "M 120,180 Q 200,120 280,200 T 480,180 Q 560,140 640,200 T 820,280 Q 700,360 520,340 T 280,320 Q 180,280 120,180 Z";

type Props = {
  selected?: string;
  probes?: { region_id: string; healthy: boolean }[];
  client?: { lat: number; lon: number };
  showArc?: boolean;
  className?: string;
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

export function GlobeMap({ selected, probes = [], client, showArc, className }: Props) {
  const probeMap = Object.fromEntries(probes.map((p) => [p.region_id, p]));
  const clientPt = client ? project(client.lat, client.lon) : null;
  const selectedRegion = REGIONS.find((r) => r.id === selected);
  const selectedPt = selectedRegion ? project(selectedRegion.lat, selectedRegion.lon) : null;

  return (
    <svg viewBox="0 0 1000 500" className={className} aria-label="World map">
      <defs>
        <linearGradient id="oceanGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="1000" height="500" fill="url(#oceanGrad)" rx="8" />
      <path d={landPath} fill="#334155" opacity="0.55" stroke="#475569" strokeWidth="1" />

      {showArc && clientPt && selectedPt && (
        <motion.path
          d={arcPath(clientPt.x, clientPt.y, selectedPt.x, selectedPt.y)}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeDasharray="6 4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.9 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      )}

      {REGIONS.map((r) => {
        const pt = project(r.lat, r.lon);
        const healthy = probeMap[r.id]?.healthy !== false;
        const isSelected = selected === r.id;
        return (
          <g key={r.id}>
            {isSelected && (
              <motion.circle
                cx={pt.x}
                cy={pt.y}
                r={20}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                initial={{ opacity: 0.8, r: 12 }}
                animate={{ opacity: 0, r: 28 }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <circle
              cx={pt.x}
              cy={pt.y}
              r={isSelected ? 9 : 7}
              fill={healthy ? (isSelected ? "#3b82f6" : "#22c55e") : "#ef4444"}
              stroke="#fff"
              strokeWidth="1.5"
              filter={isSelected ? "url(#glow)" : undefined}
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
            Client
          </text>
        </g>
      )}
    </svg>
  );
}
