import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartTheme } from "./ChartContainer";

export function MetricSparkline({
  data,
  color = "var(--color-accent)",
}: {
  data: { i: number; v: number }[];
  color?: string;
}) {
  if (!data.length) return <div className="h-8 text-xs text-muted-foreground">No data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={data}>
        <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
        <Tooltip
          contentStyle={chartTheme.tooltip}
          labelFormatter={() => ""}
          formatter={(v) => [`${Number(v).toFixed(1)}`, ""]}
        />
        <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LatencyAreaChart({
  data,
}: {
  data: { ts: string; value: number; region_id?: string }[];
}) {
  const merged = data.map((p, i) => ({
    label: new Date(p.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    ms: p.value,
    i,
  }));

  if (!merged.length) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Collecting samples…</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={merged}>
        <YAxis tick={chartTheme.axis} width={36} unit="ms" />
        <Tooltip contentStyle={chartTheme.tooltip} />
        <Area type="monotone" dataKey="ms" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.2} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LatencyBarChart({
  data,
  highlight,
}: {
  data: { name: string; ms: number; healthy: boolean }[];
  highlight?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis dataKey="name" tick={chartTheme.axis} interval={0} angle={-20} textAnchor="end" height={50} />
        <Tooltip contentStyle={chartTheme.tooltip} formatter={(v) => [`${v} ms`, "Latency"]} />
        <Bar dataKey="ms" radius={[4, 4, 0, 0]}>
          {data.map((e, i) => (
            <Cell
              key={i}
              fill={
                highlight && e.name.toLowerCase().includes(highlight.toLowerCase())
                  ? "var(--color-accent)"
                  : e.healthy
                    ? "var(--color-chart-1)"
                    : "var(--color-danger)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
