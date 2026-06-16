import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatusLED({ status }: { status: "ok" | "warn" | "err" | "off" }) {
  const map = { ok: "console-led-ok", warn: "console-led-warn", err: "console-led-err", off: "console-led-off" };
  return <span className={cn("console-led", map[status])} aria-hidden />;
}

export function Chip({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: "default" | "ok" | "warn" | "err";
  className?: string;
}) {
  const v = { default: "", ok: "console-chip-ok", warn: "console-chip-warn", err: "console-chip-err" };
  return <span className={cn("console-chip", v[variant], className)}>{children}</span>;
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("console-panel", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-[var(--gc-border)] px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--gc-muted)]">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="console-panel px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--gc-dim)] mb-2">{label}</p>
      <p className="console-kpi-val text-[var(--gc-text)]">{value}</p>
      {sub && <p className="console-mono mt-1.5 text-[var(--gc-dim)]">{sub}</p>}
    </div>
  );
}

export function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty?: string;
}) {
  if (!rows.length) {
    return <p className="console-mono text-[var(--gc-dim)] py-6 text-center">{empty ?? "No data"}</p>;
  }
  return (
    <div className="overflow-x-auto -mx-4">
      <table className="console-table w-full">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="console-mono text-[10px] uppercase tracking-wider text-[var(--gc-dim)]">{label}</span>
      {children}
    </label>
  );
}
