import { cn } from "@/lib/utils";

type Tier = "starter" | "pro" | "enterprise" | "addon" | "default";

const tierColor: Record<Tier, string> = {
  starter: "var(--tier-starter)",
  pro: "var(--tier-pro)",
  enterprise: "var(--tier-enterprise)",
  addon: "var(--tier-addon)",
  default: "var(--color-accent)",
};

export function tierFromProduct(id: string, category?: string): Tier {
  if (category === "addons") return "addon";
  if (id.includes("enterprise")) return "enterprise";
  if (id.includes("pro")) return "pro";
  if (id.includes("starter")) return "starter";
  return "default";
}

export function PlanIcon({
  tier = "default",
  className,
}: {
  tier?: Tier;
  className?: string;
}) {
  const color = tierColor[tier];
  return (
    <div
      className={cn("flex h-12 w-12 items-center justify-center  border border-foreground", className)}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        {tier === "enterprise" ? (
          <>
            <rect x="4" y="8" width="24" height="16" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
            <path d="M8 14h16M8 18h10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          </>
        ) : tier === "addon" ? (
          <>
            <circle cx="16" cy="16" r="10" stroke={color} strokeWidth="1.5" fill="none" />
            <path d="M16 10v12M10 16h12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="16" cy="16" r="9" stroke={color} strokeWidth="1.5" fill="none" />
            <ellipse cx="16" cy="16" rx="9" ry="3" stroke={color} strokeWidth="1" opacity="0.6" fill="none" />
            <circle cx="20" cy="13" r="1.5" fill={color} />
          </>
        )}
      </svg>
    </div>
  );
}
