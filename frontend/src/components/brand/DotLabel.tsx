import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  dot?: boolean;
};

/** Nothing-style micro label: spaced caps + optional red dot */
export function DotLabel({ children, className, dot = true }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground",
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--nothing-red)]" aria-hidden />}
      {children}
    </span>
  );
}
