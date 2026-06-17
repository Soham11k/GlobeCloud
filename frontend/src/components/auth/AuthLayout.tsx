import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { GlobeMap } from "@/components/GlobeMap";
import { useMetrics, useProduct, useRegions } from "@/lib/hooks";

type Props = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
};

export function AuthLayout({ children, title, subtitle }: Props) {
  const { data: regions } = useRegions();
  const { data: metrics } = useMetrics();
  const { data: product } = useProduct();

  const probes =
    metrics?.router.map((r) => ({
      region_id: r.region_id,
      healthy: r.healthy,
      latency_ms: r.latency_ms,
    })) ?? [];

  const modeLabel =
    product?.deployment_mode === "gateway"
      ? "Live fleet"
      : product?.is_simulated
        ? "Local fleet"
        : product?.deployment_mode ?? "local";

  const mapPanel = (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent,#5b52ff)]">
          Fleet topology
        </p>
        <h2 className="mt-2 text-lg font-medium text-white">Live region probes</h2>
        <p className="mt-1 text-sm text-white/45">
          {modeLabel} · {regions?.regions.length ?? 0} regions
        </p>
      </div>
      <GlobeMap
        regions={regions?.regions}
        probes={probes}
        className="w-full min-h-[200px] lg:min-h-[280px] flex-1 rounded-lg border border-white/10"
      />
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface-0,#03030a)] text-[#e8e6e1] lg:flex-row">
      <div className="order-2 border-b border-white/5 p-4 lg:order-none lg:hidden">{mapPanel}</div>

      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-[480px] lg:shrink-0 lg:px-12 xl:w-[520px]">
        <Link to="/" className="mb-10 inline-flex">
          <Logo className="h-7" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-white/50">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>

      <div className="relative hidden flex-1 flex-col justify-between border-l border-white/5 bg-[var(--surface-1,#0a0a12)] p-8 lg:flex">
        {mapPanel}
        <p className="font-mono text-[10px] text-white/35">Natural Earth coastlines</p>
      </div>
    </div>
  );
}
