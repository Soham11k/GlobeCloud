import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Route, RefreshCw, MessageCircle, Terminal } from "lucide-react";
import { markWelcomed } from "@/lib/welcome";
import { useMetrics, useProduct, useSyncStatus } from "@/lib/hooks";

const NODES = [
  { id: "US", label: "US-EAST-1", lat: 38, lon: -97, col: "#2DD4A0", ms: 12 },
  { id: "EU", label: "EU-WEST-1", lat: 52, lon: 13, col: "#2DD4A0", ms: 18 },
  { id: "AP", label: "AP-SOUTH-1", lat: 1, lon: 104, col: "#F0A84A", ms: 34 },
];

function hx(h: string, a: number) {
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function project(lat: number, lon: number, spin: number, cx: number, cy: number, R: number) {
  const φ = (lat * Math.PI) / 180;
  const λ = ((lon + spin) * Math.PI) / 180;
  const x = cx + R * Math.cos(φ) * Math.sin(λ);
  const y = cy - R * Math.sin(φ);
  const z = Math.cos(φ) * Math.cos(λ);
  return { x, y, z };
}

function bezierPt(p1: { x: number; y: number }, ctrl: { x: number; y: number }, p2: { x: number; y: number }, t: number) {
  const u = 1 - t;
  return {
    x: u * u * p1.x + 2 * u * t * ctrl.x + t * t * p2.x,
    y: u * u * p1.y + 2 * u * t * ctrl.y + t * t * p2.y,
  };
}

function GlobeCanvas({ latencies }: { latencies: Record<string, number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef(NODES.map((n) => ({ ...n, ms: latencies[n.label] ?? n.ms })));

  useEffect(() => {
    nodesRef.current = NODES.map((n) => ({ ...n, ms: latencies[n.label] ?? n.ms }));
  }, [latencies]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let cx = 0;
    let cy = 0;
    let R = 0;
    let frame = 0;
    let spin = 0;
    let raf = 0;

    const streams = [[0, 1], [1, 2], [2, 0], [1, 0], [2, 1], [0, 2], [0, 1], [1, 2]].map(([a, b]) => ({
      a,
      b,
      t: Math.random(),
      speed: 0.0022 + Math.random() * 0.0018,
      trail: [] as { x: number; y: number }[],
      col: NODES[a].col,
      size: 1.4 + Math.random() * 1.2,
    }));

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas!.width = W * devicePixelRatio;
      canvas!.height = H * devicePixelRatio;
      canvas!.style.width = `${W}px`;
      canvas!.style.height = `${H}px`;
      ctx!.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      cx = W * 0.72;
      cy = H * 0.5;
      R = Math.min(W, H) * 0.36;
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    function draw() {
      raf = requestAnimationFrame(draw);
      frame++;
      spin += 0.12;
      ctx!.clearRect(0, 0, W, H);

      const nodes = nodesRef.current;
      const projected = nodes.map((n) => ({ ...n, ...project(n.lat, n.lon, spin, cx, cy, R) }));
      const allNodes = projected;

      const LATS = [-60, -30, 0, 30, 60];
      const LONS = Array.from({ length: 18 }, (_, i) => i * 20);

      LONS.forEach((lon) => {
        ctx!.beginPath();
        for (let la = -90; la <= 90; la += 4) {
          const φ = (la * Math.PI) / 180;
          const λ = ((lon + spin) * Math.PI) / 180;
          const x = cx + R * Math.cos(φ) * Math.sin(λ);
          const y = cy - R * Math.sin(φ);
          la === -90 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
        }
        ctx!.strokeStyle = "rgba(91,82,255,0.055)";
        ctx!.lineWidth = 0.4;
        ctx!.stroke();
      });

      LATS.forEach((lat) => {
        ctx!.beginPath();
        for (let lo = 0; lo <= 360; lo += 3) {
          const φ = (lat * Math.PI) / 180;
          const λ = ((lo + spin) * Math.PI) / 180;
          const x = cx + R * Math.cos(φ) * Math.sin(λ);
          const y = cy - R * Math.sin(φ);
          lo === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
        }
        ctx!.strokeStyle = "rgba(91,82,255,0.045)";
        ctx!.lineWidth = 0.4;
        ctx!.stroke();
      });

      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(91,82,255,0.14)";
      ctx!.lineWidth = 0.8;
      ctx!.stroke();
      ctx!.fillStyle = "rgba(8,6,30,0.55)";
      ctx!.fill();

      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.clip();

      LONS.forEach((lon) => {
        ctx!.beginPath();
        for (let la = -85; la <= 85; la += 5) {
          const φ = (la * Math.PI) / 180;
          const λ = ((lon + spin) * Math.PI) / 180;
          const z = Math.cos(φ) * Math.cos(λ);
          if (z < 0) continue;
          const x = cx + R * Math.cos(φ) * Math.sin(λ);
          const y = cy - R * Math.sin(φ);
          la === -85 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
        }
        ctx!.strokeStyle = "rgba(91,82,255,0.09)";
        ctx!.lineWidth = 0.4;
        ctx!.stroke();
      });

      [[0, 1], [1, 2], [2, 0]].forEach(([ai, bi]) => {
        const na = allNodes[ai];
        const nb = allNodes[bi];
        if (na.z < 0 && nb.z < 0) return;
        const ctrl = { x: (na.x + nb.x) / 2, y: Math.min(na.y, nb.y) - R * 0.22 };
        ctx!.beginPath();
        for (let s = 0; s <= 60; s++) {
          const p = bezierPt(na, ctrl, nb, s / 60);
          s === 0 ? ctx!.moveTo(p.x, p.y) : ctx!.lineTo(p.x, p.y);
        }
        ctx!.strokeStyle = "rgba(91,82,255,0.22)";
        ctx!.lineWidth = 0.7;
        ctx!.setLineDash([3, 6]);
        ctx!.stroke();
        ctx!.setLineDash([]);
      });

      streams.forEach((s) => {
        s.t += s.speed;
        if (s.t >= 1) {
          s.t = 0;
          s.trail = [];
          const ai = Math.floor(Math.random() * 3);
          let bi = Math.floor(Math.random() * 3);
          while (bi === ai) bi = (bi + 1) % 3;
          s.a = ai;
          s.b = bi;
          s.col = nodes[ai].col;
        }
        const na = allNodes[s.a];
        const nb = allNodes[s.b];
        const ctrl = { x: (na.x + nb.x) / 2, y: Math.min(na.y, nb.y) - R * 0.22 };
        const p = bezierPt(na, ctrl, nb, s.t);
        s.trail.push({ ...p });
        if (s.trail.length > 18) s.trail.shift();
        s.trail.forEach((pt, ti) => {
          if (ti > 0) {
            ctx!.beginPath();
            ctx!.moveTo(s.trail[ti - 1].x, s.trail[ti - 1].y);
            ctx!.lineTo(pt.x, pt.y);
            ctx!.strokeStyle = hx(s.col, (ti / s.trail.length) * 0.85);
            ctx!.lineWidth = s.size * (ti / s.trail.length);
            ctx!.stroke();
          }
        });
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, s.size + 0.5, 0, Math.PI * 2);
        ctx!.fillStyle = s.col;
        ctx!.fill();
      });

      ctx!.restore();

      allNodes.forEach((n, i) => {
        if (n.z < -0.05) return;
        const alpha = Math.max(0, n.z);
        const pulse = 0.5 + 0.5 * Math.sin(frame * 0.045 + i * 2.09);
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, 22 + pulse * 8, 0, Math.PI * 2);
        ctx!.strokeStyle = hx(n.col, 0.1 * alpha);
        ctx!.lineWidth = 1;
        ctx!.stroke();
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, 13, 0, Math.PI * 2);
        ctx!.strokeStyle = hx(n.col, 0.35 * alpha);
        ctx!.lineWidth = 0.7;
        ctx!.stroke();
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, 11, 0, Math.PI * 2);
        ctx!.fillStyle = hx(n.col, 0.08 * alpha);
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, 5, 0, Math.PI * 2);
        ctx!.fillStyle = hx(n.col, alpha);
        ctx!.fill();
        const lx = n.x;
        const ly = n.y - 28;
        ctx!.font = "500 9.5px 'JetBrains Mono', monospace";
        ctx!.textAlign = "center";
        ctx!.fillStyle = `rgba(255,255,255,${0.28 * alpha})`;
        ctx!.fillText(n.label, lx, ly);
        ctx!.font = "600 12px 'JetBrains Mono', monospace";
        ctx!.fillStyle = hx(n.col, alpha);
        ctx!.fillText(`${Math.round(n.ms)}ms`, lx, ly - 14);
      });

      const scanY = (frame * 0.6) % H;
      ctx!.fillStyle = "rgba(91,82,255,0.012)";
      ctx!.fillRect(0, scanY, W, 2);
      const vx = cx + R * 0.3;
      const vg = ctx!.createRadialGradient(vx, cy, R * 0.1, vx, cy, R * 1.4);
      vg.addColorStop(0, "rgba(3,3,10,0)");
      vg.addColorStop(1, "rgba(3,3,10,0.7)");
      ctx!.fillStyle = vg;
      ctx!.fillRect(0, 0, W, H);
    }

    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} id="gc-c" className="absolute inset-0 h-full w-full" />;
}

export function CinematicWelcomePage() {
  const { data: metrics } = useMetrics();
  const { data: product } = useProduct();
  const { data: sync } = useSyncStatus();

  const latencies: Record<string, number> = {};
  metrics?.router.forEach((r) => {
    if (r.latency_ms != null) latencies[r.region_id] = r.latency_ms;
  });

  const avgMs = metrics?.router.length
    ? Math.round(
        metrics.router.filter((r) => r.latency_ms != null).reduce((s, r) => s + (r.latency_ms ?? 0), 0) /
          Math.max(1, metrics.router.filter((r) => r.latency_ms != null).length)
      )
    : null;

  const enter = () => markWelcomed();

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <div
        className="min-h-screen flex items-center justify-center p-4 md:p-8"
        style={{ background: "#000", fontFamily: "'Space Grotesk', sans-serif" }}
      >
        <div
          className="w-full max-w-5xl overflow-hidden rounded-[18px] text-[#F0EDE6] relative"
          style={{ background: "#03030A" }}
        >
          <nav className="relative z-20 flex items-center justify-between border-b border-white/[0.04] px-8 py-[18px]">
            <div className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-white">
              <div className="relative flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-[#5B52FF]">
                <div className="h-[7px] w-[7px] animate-pulse rounded-full bg-[#5B52FF]" />
              </div>
              GLOBECLOUD
            </div>
            <div className="hidden sm:flex items-center gap-7">
              <a href="/api/docs" target="_blank" rel="noopener" className="text-xs text-white/30 no-underline tracking-wide hover:text-white/60">Docs</a>
              <Link to="/" onClick={enter} className="text-xs text-white/30 no-underline tracking-wide hover:text-white/60">Pricing</Link>
              <Link to="/status" className="text-xs text-white/30 no-underline tracking-wide hover:text-white/60">Status</Link>
              <Link
                to="/app"
                onClick={enter}
                className="rounded-full border border-[#5B52FF]/45 bg-[#5B52FF]/10 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-[#8B85FF] no-underline"
              >
                Sign in
              </Link>
            </div>
          </nav>

          <div className="relative flex h-[480px] items-center overflow-hidden">
            <GlobeCanvas latencies={latencies} />
            <div className="relative z-10 max-w-[480px] px-[52px]">
              <div className="mb-[22px] inline-flex items-center gap-2 rounded-full border border-[#5B52FF]/25 bg-[#5B52FF]/[0.06] px-3 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#5B52FF]">
                <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-[#5B52FF]" />
                {product?.regions ?? 3}-region infrastructure · {product?.deployment_mode ?? "local"}
              </div>
              <h1 className="mb-3.5 text-[56px] font-light leading-[1.04] tracking-[-0.035em] text-white">
                Your data,
                <br />
                <em className="font-bold not-italic">everywhere</em>
                <br />
                <span className="text-[#5B52FF]">at once.</span>
              </h1>
              <p className="mb-8 max-w-[340px] text-sm leading-[1.75] text-white/35">
                Replication across US, EU, and AP. Reads land on the nearest replica. Ask your docs in plain language.
              </p>
              <div className="flex items-center gap-3">
                <Link
                  to="/app"
                  onClick={enter}
                  className="inline-flex items-center gap-2 rounded-[9px] bg-[#5B52FF] px-6 py-3 text-[13px] font-semibold text-white no-underline"
                >
                  <Terminal className="h-4 w-4" /> Enter console
                </Link>
                <a
                  href="/api/docs"
                  target="_blank"
                  rel="noopener"
                  className="rounded-[9px] border border-white/10 bg-transparent px-6 py-3 text-[13px] text-white/40 no-underline"
                >
                  Read the docs
                </a>
              </div>
            </div>
          </div>

          <div className="flex border-t border-white/[0.05]">
            <div className="flex flex-1 flex-col gap-0.5 border-r border-white/[0.05] px-8 py-[18px]">
              <div className="font-mono text-[28px] font-medium tracking-[-0.03em] text-[#2DD4A0]">
                {avgMs ?? "—"}<span className="text-[13px] font-normal opacity-30">ms</span>
              </div>
              <div className="text-[11px] tracking-wide text-white/25">avg read latency</div>
            </div>
            <div className="flex flex-1 flex-col gap-0.5 border-r border-white/[0.05] px-8 py-[18px]">
              <div className="font-mono text-[28px] font-medium tracking-[-0.03em] text-white">
                {sync?.interval_s ?? "—"}<span className="text-[13px] font-normal opacity-30">s</span>
              </div>
              <div className="text-[11px] tracking-wide text-white/25">sync interval</div>
            </div>
            <div className="flex flex-1 flex-col gap-0.5 px-8 py-[18px]">
              <div className="font-mono text-[28px] font-medium tracking-[-0.03em] text-white">
                {product?.knowledge_docs ?? "—"}<span className="text-[13px] font-normal opacity-30"> docs</span>
              </div>
              <div className="text-[11px] tracking-wide text-white/25">knowledge base</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 border-t border-white/[0.05]">
            {[
              { icon: Route, name: "Route", desc: "Latency-aware region selection. Reads hit the closest healthy node.", mono: "→ geo_routing: true" },
              { icon: RefreshCw, name: "Replicate", desc: "Append-only logs sync across regions. Full audit trail.", mono: "→ multi_region: true" },
              { icon: MessageCircle, name: "Ask", desc: "Grounded RAG copilot answers from your docs with citations.", mono: `→ rag_agent: ${product?.llm_mode ?? "openai"}` },
            ].map(({ icon: Icon, name, desc, mono }, i) => (
              <div key={name} className={`px-8 py-6 ${i < 2 ? "md:border-r border-white/[0.05]" : ""} border-b md:border-b-0 border-white/[0.05]`}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-[#5B52FF]/30 text-[#7B75FF]">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/55">{name}</div>
                </div>
                <p className="text-xs leading-[1.65] text-white/30">{desc}</p>
                <p className="mt-2.5 font-mono text-[10px] tracking-[0.06em] text-[#5B52FF]">{mono}</p>
              </div>
            ))}
          </div>

          <p className="border-t border-white/[0.05] py-4 text-center text-[11px] text-white/25">
            <Link to="/" onClick={enter} className="text-[#8B85FF] hover:underline">
              Continue to marketing site →
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
