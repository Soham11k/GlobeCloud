import type { ReactNode } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "loading" | "success" | "error";

type Props = {
  status: Status;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
};

const icons: Record<Status, ReactNode> = {
  loading: <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden />,
  success: <CheckCircle2 className="h-8 w-8 text-[var(--geo-healthy)]" aria-hidden />,
  error: <XCircle className="h-8 w-8 text-[var(--geo-error)]" aria-hidden />,
};

export function AuthStatusCard({ status, title, description, children, className }: Props) {
  return (
    <div
      className={cn("auth-card flex flex-col items-center px-8 py-10 text-center", className)}
      aria-live="polite"
      aria-busy={status === "loading"}
    >
      <div className="mb-4">{icons[status]}</div>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-6 w-full max-w-xs space-y-3">{children}</div>}
    </div>
  );
}
