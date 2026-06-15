import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <circle cx="60" cy="60" r="44" stroke="currentColor" strokeWidth="2" opacity="0.35" fill="none" />
      <circle cx="60" cy="60" r="28" stroke="currentColor" strokeWidth="2" fill="none" />
      <ellipse cx="60" cy="60" rx="44" ry="14" stroke="currentColor" strokeWidth="1.5" opacity="0.5" fill="none" />
      <circle cx="78" cy="42" r="4" fill="currentColor" />
      <circle cx="38" cy="68" r="3" fill="currentColor" opacity="0.7" />
    </svg>
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
      <LogoMark className="text-accent" size={26} />
      {showWordmark && (
        <span className="font-semibold text-[1.05rem] tracking-tight">
          Globe<span className="text-accent">Cloud</span>
        </span>
      )}
    </Link>
  );
}
