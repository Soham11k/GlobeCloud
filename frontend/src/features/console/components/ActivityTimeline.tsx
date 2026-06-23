import { EmptyState } from "@/components/layout/EmptyState";

type Item = {
  ts: string;
  type: string;
  summary: string;
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ActivityTimeline({ items, empty = "No activity yet" }: { items: Item[]; empty?: string }) {
  if (!items.length) {
    return <EmptyState title={empty} className="py-8" />;
  }

  return (
    <ol className="relative space-y-0">
      {items.map((item, i) => (
        <li key={`${item.ts}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
          {i < items.length - 1 && (
            <span
              className="absolute left-[5px] top-3 h-[calc(100%-4px)] w-px bg-border"
              aria-hidden
            />
          )}
          <span className="relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-mono text-[11px] text-muted-foreground">{relativeTime(item.ts)}</span>
              <span className="text-xs font-medium uppercase tracking-wide text-accent">{item.type}</span>
            </div>
            <p className="mt-1 text-sm text-foreground/90">{item.summary}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
