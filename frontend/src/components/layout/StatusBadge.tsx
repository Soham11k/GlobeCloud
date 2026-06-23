import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const labels = {
  ok: "online",
  warn: "slow",
  err: "offline",
  off: "—",
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
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        status === "err" && "bg-accent",
        status === "warn" && "bg-muted-foreground",
        status === "ok" && "bg-foreground",
        status === "off" && "bg-border",
      )}
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
      {label ?? labels[status]}
    </Badge>
  );
}
