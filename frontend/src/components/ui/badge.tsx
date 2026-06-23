import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "bg-muted text-muted-foreground border-transparent",
  success: "bg-muted text-foreground border-transparent",
  warning: "bg-muted text-muted-foreground border-transparent",
  danger: "bg-[var(--accent-muted)] text-accent border-transparent",
  accent: "bg-accent text-accent-foreground border-transparent",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[11px] tracking-wide",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
