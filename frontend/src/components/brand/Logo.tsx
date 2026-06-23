import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function LogoMark({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("inline-block shrink-0 rounded-full bg-[var(--nothing-red)]", className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

export function Logo({
  className,
  to = "/",
  showWordmark = true,
}: {
  className?: string;
  to?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2.5 text-foreground", className)}>
      <LogoMark size={10} />
      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-[-0.04em]">
          GlobeCloud
        </span>
      )}
    </Link>
  );
}
