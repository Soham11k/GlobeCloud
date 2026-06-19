import { useState } from "react";
import { useConsole } from "../ConsoleContext";
import { useKnowledge } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/layout/LoadingState";
import { Panel, Field, Chip } from "../components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function DocsPage() {
  const { region, setRegion, regionIds } = useConsole();
  const { data, isLoading } = useKnowledge(region);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const docs = data?.documents ?? [];
  const active = docs.find((d) => d.id === selectedId) ?? docs[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge base"
        description={`pgvector RAG index · ${region}`}
        actions={
          <Field label="Region">
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="min-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {regionIds.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        }
      />

      {isLoading ? (
        <LoadingState rows={4} />
      ) : !docs.length ? (
        <p className="text-sm text-muted-foreground">No knowledge docs in {region}.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <nav className="glass-panel space-y-1 p-2">
            {docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setSelectedId(doc.id)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                  active?.id === doc.id ? "bg-accent/15 text-accent glow-ring" : "hover:bg-muted/50 text-muted-foreground"
                )}
              >
                {doc.title}
              </button>
            ))}
          </nav>
          {active && (
            <Panel title={active.title}>
              <div className="mb-4 flex flex-wrap gap-2">
                <Chip>{active.region}</Chip>
                {data?.is_local != null && (
                  <Chip variant={data.is_local ? "ok" : "default"}>
                    {data.is_local ? "local" : "replicated"}
                  </Chip>
                )}
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(active.updated_at).toLocaleString()}
                </span>
              </div>
              <article className="prose prose-sm dark:prose-invert max-w-none leading-relaxed whitespace-pre-wrap">
                {active.body}
              </article>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
