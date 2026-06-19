import { cn } from "@/lib/utils";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
};

export function SectionHeader({ eyebrow, title, description, className }: Props) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow && (
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
      )}
      <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h2>
      {description && <p className="mt-3 text-muted-foreground leading-relaxed">{description}</p>}
    </div>
  );
}
