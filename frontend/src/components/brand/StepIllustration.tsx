export function StepIllustration({ step }: { step: "route" | "replicate" | "ask" }) {
  if (step === "route") {
    return (
      <svg viewBox="0 0 120 80" className="w-full h-20" aria-hidden>
        <circle cx="24" cy="40" r="6" fill="#5b52ff" opacity="0.9" />
        <circle cx="96" cy="28" r="5" fill="#5b52ff" opacity="0.5" />
        <circle cx="88" cy="58" r="5" fill="#5b52ff" opacity="0.35" />
        <path d="M30 38 Q60 20 90 30" stroke="#5b52ff" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
      </svg>
    );
  }
  if (step === "replicate") {
    return (
      <svg viewBox="0 0 120 80" className="w-full h-20" aria-hidden>
        <rect x="16" y="24" width="28" height="32" rx="3" stroke="#5b52ff" strokeWidth="1.5" fill="none" />
        <rect x="48" y="24" width="28" height="32" rx="3" stroke="#5b52ff" strokeWidth="1.5" fill="none" opacity="0.6" />
        <rect x="80" y="24" width="28" height="32" rx="3" stroke="#5b52ff" strokeWidth="1.5" fill="none" opacity="0.35" />
        <path d="M44 40h4M76 40h4" stroke="#5b52ff" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 80" className="w-full h-20" aria-hidden>
      <rect x="20" y="16" width="80" height="48" rx="6" stroke="#5b52ff" strokeWidth="1.5" fill="none" />
      <path d="M28 32h64M28 42h48M28 52h56" stroke="#5b52ff" strokeWidth="1" opacity="0.4" />
      <rect x="28" y="28" width="12" height="3" rx="1" fill="#5b52ff" opacity="0.7" />
    </svg>
  );
}
