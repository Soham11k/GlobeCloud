import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusDot } from "@/components/layout/StatusBadge";
import { EmptyState } from "@/components/layout/EmptyState";
import { cn } from "@/lib/utils";

export function StatusLED({ status }: { status: "ok" | "warn" | "err" | "off" }) {
  return <StatusDot status={status} />;
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
  const map = { default: "default", ok: "success", warn: "warning", err: "danger" } as const;
  return (
    <Badge variant={map[variant]} className={className}>
      {children}
    </Badge>
  );
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
    <div className={cn("console-panel overflow-hidden", className)}>
      <div className="flex flex-row items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Kpi({ label, value, sub, highlight }: { label: string; value: ReactNode; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn("console-panel p-5", highlight && "border-accent")}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-medium tabular-nums tracking-[-0.03em]">{value}</p>
      {sub && <p className="mt-1 data-mono">{sub}</p>}
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
    return <EmptyState title={empty ?? "No data"} className="py-8" />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {row.map((cell, j) => (
              <TableCell key={j} className={j === 0 ? "font-bold" : ""}>
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
      <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
