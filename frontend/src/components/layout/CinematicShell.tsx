import type { ReactNode } from "react";
import { LivePingRail } from "@/components/layout/LivePingRail";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  vignette?: boolean;
  showPingRail?: boolean;
};

export function CinematicShell({ children, className, vignette = false, showPingRail = true }: Props) {
  return (
    <div className={cn("cinematic-shell", className)}>
      {vignette && <div className="pointer-events-none fixed inset-0 z-0 cinematic-vignette" aria-hidden />}
      <div className="relative z-10">{children}</div>
      {showPingRail && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/85 px-4 py-1.5 backdrop-blur-md sm:hidden">
          <LivePingRail compact />
        </div>
      )}
    </div>
  );
}

/** @deprecated Use CinematicShell */
export function ProductShell({ children, className }: Props) {
  return <CinematicShell className={className}>{children}</CinematicShell>;
}
