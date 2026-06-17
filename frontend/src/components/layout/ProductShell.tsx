import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Shared dark marketing/auth shell */
export function ProductShell({ children, className = "" }: Props) {
  return (
    <div
      className={`min-h-screen bg-[var(--surface-0,#03030a)] text-[#e8e6e1] antialiased ${className}`}
    >
      {children}
    </div>
  );
}
