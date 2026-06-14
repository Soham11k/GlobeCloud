import { motion } from "framer-motion";

const REGIONS = [
  { id: "us-east-1", x: 280, y: 220, label: "US East" },
  { id: "eu-west-1", x: 480, y: 180, label: "EU West" },
  { id: "ap-south-1", x: 720, y: 320, label: "AP South" },
];

type Props = {
  selected?: string;
  probes?: { region_id: string; healthy: boolean }[];
  client?: { lat: number; lon: number };
  className?: string;
};

function latLonToMap(lat: number, lon: number) {
  return {
    x: Math.max(20, Math.min(980, ((lon + 180) / 360) * 1000)),
    y: Math.max(20, Math.min(480, ((90 - lat) / 180) * 500)),
  };
}

export function GlobeMap({ selected, probes = [], client, className }: Props) {
  const probeMap = Object.fromEntries(probes.map((p) => [p.region_id, p]));
  const clientPt = client ? latLonToMap(client.lat, client.lon) : null;

  return (
    <svg viewBox="0 0 1000 500" className={className} aria-label="World map">
      <defs>
        <linearGradient id="ocean" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="1000" height="500" fill="url(#ocean)" rx="8" />
      {[...Array(9)].map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 62.5} x2="1000" y2={i * 62.5} stroke="#334155" strokeWidth="0.5" opacity="0.4" />
      ))}
      {[...Array(17)].map((_, i) => (
        <line key={`v${i}`} x1={i * 62.5} y1="0" x2={i * 62.5} y2="500" stroke="#334155" strokeWidth="0.5" opacity="0.4" />
      ))}
      {REGIONS.map((r) => {
        const healthy = probeMap[r.id]?.healthy !== false;
        const isSelected = selected === r.id;
        return (
          <g key={r.id}>
            {isSelected && (
              <motion.circle
                cx={r.x}
                cy={r.y}
                r={24}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                initial={{ opacity: 0.8, r: 16 }}
                animate={{ opacity: 0, r: 32 }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <circle
              cx={r.x}
              cy={r.y}
              r={isSelected ? 10 : 8}
              fill={healthy ? (isSelected ? "#3b82f6" : "#22c55e") : "#ef4444"}
              stroke="#fff"
              strokeWidth="1.5"
            />
            <text x={r.x} y={r.y + 22} textAnchor="middle" fill="#94a3b8" fontSize="11">
              {r.label}
            </text>
          </g>
        );
      })}
      {clientPt && (
        <g>
          <circle cx={clientPt.x} cy={clientPt.y} r={6} fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
          <text x={clientPt.x} y={clientPt.y - 12} textAnchor="middle" fill="#fbbf24" fontSize="10">
            Client
          </text>
        </g>
      )}
    </svg>
  );
}
