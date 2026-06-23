export function StepIllustration({ step }: { step: "route" | "replicate" | "ask" }) {
  const stroke = "currentColor";
  const accent = "var(--nothing-red)";
  if (step === "route") {
    return (
      <svg viewBox="0 0 160 72" className="h-16 w-full text-foreground/80" aria-hidden>
        <circle cx="28" cy="36" r="8" fill="none" stroke={accent} strokeWidth="1.5" />
        <circle cx="132" cy="22" r="6" fill="none" stroke={stroke} strokeWidth="1.5" opacity="0.7" />
        <circle cx="120" cy="52" r="6" fill="none" stroke={stroke} strokeWidth="1.5" opacity="0.5" />
        <path d="M36 34 Q80 8 126 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeDasharray="4 5" />
      </svg>
    );
  }
  if (step === "replicate") {
    return (
      <svg viewBox="0 0 160 72" className="h-16 w-full text-foreground/80" aria-hidden>
        <rect x="12" y="20" width="36" height="32" fill="none" stroke={stroke} strokeWidth="1.5" />
        <rect x="62" y="20" width="36" height="32" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.9" />
        <rect x="112" y="20" width="36" height="32" fill="none" stroke={stroke} strokeWidth="1.5" opacity="0.45" />
        <path d="M48 36h14M98 36h14" stroke={stroke} strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 72" className="h-16 w-full text-foreground/80" aria-hidden>
      <rect x="24" y="14" width="112" height="44" fill="none" stroke={stroke} strokeWidth="1.5" />
      <line x1="36" y1="30" x2="124" y2="30" stroke={stroke} strokeWidth="1" opacity="0.5" />
      <line x1="36" y1="40" x2="96" y2="40" stroke={stroke} strokeWidth="1" opacity="0.35" />
      <rect x="36" y="24" width="28" height="4" fill={accent} opacity="0.85" />
    </svg>
  );
}
