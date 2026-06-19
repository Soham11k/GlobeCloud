import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const dotColors = {
  ok: "bg-success",
  warn: "bg-warning",
  err: "bg-danger",
  off: "bg-muted-foreground/40",
};

const badgeVariants = {
  ok: "success" as const,
  warn: "warning" as const,
  err: "danger" as const,
  off: "default" as const,
};

export function StatusDot({ status }: { status: "ok" | "warn" | "err" | "off" }) {
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full shrink-0", dotColors[status])}
      aria-hidden
    />
  );
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: "ok" | "warn" | "err" | "off";
  label?: string;
  className?: string;
}) {
  return (
    <Badge variant={badgeVariants[status]} className={cn("gap-1.5", className)}>
      <StatusDot status={status} />
      {label}
    </Badge>
  );
}
