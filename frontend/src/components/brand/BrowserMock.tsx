import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function BrowserMock({
  children,
  url = "app.globecloud.dev",
  className,
}: {
  children: ReactNode;
  url?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden border border-border bg-background", className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span className="data-mono truncate">{url}</span>
      </div>
      <div className="relative bg-background">{children}</div>
    </div>
  );
}
