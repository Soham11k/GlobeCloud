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
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        "shadow-[var(--shadow-elevated)]",
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
        </div>
        <div className="flex-1 rounded-md bg-background/80 px-3 py-1 text-[11px] text-muted-foreground font-mono truncate">
          {url}
        </div>
      </div>
      <div className="relative bg-background">{children}</div>
    </div>
  );
}
