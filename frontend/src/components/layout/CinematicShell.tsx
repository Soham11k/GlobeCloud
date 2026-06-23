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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border-2 focus:border-foreground focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
      >
        Skip to main content
      </a>
      {vignette && <div className="pointer-events-none fixed inset-0 z-0 cinematic-vignette" aria-hidden />}
      <div id="main-content" className="relative z-10 pb-16 sm:pb-0">
        {children}
      </div>
      {showPingRail && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-foreground bg-background px-4 py-1.5 sm:hidden">
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
