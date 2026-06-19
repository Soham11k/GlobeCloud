import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
};

export function FormField({ id, label, error, hint, children, className }: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-[var(--geo-error)]" role="alert">
          {error}
        </p>
      )}
      {!error && hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
