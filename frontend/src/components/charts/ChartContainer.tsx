import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function ChartContainer({
  title,
  description,
  children,
  className,
  height = "h-52",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  height?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className={cn("w-full", height)}>{children}</div>
    </div>
  );
}

export const chartTheme = {
  axis: { fill: "var(--color-muted-foreground)", fontSize: 10 },
  grid: { stroke: "var(--color-border)", strokeDasharray: "3 3" },
  tooltip: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
  },
};
