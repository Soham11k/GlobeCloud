import { useConsole } from "../ConsoleContext";
import { useKnowledge } from "@/lib/hooks";
import { Panel, Field, Chip } from "../components/ui";

export function DocsPage() {
  const { region, setRegion, regionIds } = useConsole();
  const { data, isLoading } = useKnowledge(region);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Knowledge base</h1>
          <p className="console-mono mt-1 text-[var(--gc-dim)]">
            GET /regions/{region}/knowledge · TF-IDF index for RAG
            {data?.is_local != null && <Chip className="ml-2">{data.is_local ? "local" : "replicated"}</Chip>}
          </p>
        </div>
        <Field label="region">
          <select className="console-input w-auto min-w-[160px]" value={region} onChange={(e) => setRegion(e.target.value)}>
            {regionIds.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>
      </div>

      {isLoading ? (
        <p className="console-mono text-[var(--gc-dim)]">Loading documents…</p>
      ) : (
        <div className="space-y-3">
          {(data?.documents ?? []).map((doc) => (
            <Panel key={doc.id} title={doc.title}>
              <p className="console-mono text-[10px] text-[var(--gc-dim)] mb-3">
                {doc.region} · updated {new Date(doc.updated_at).toLocaleString()}
              </p>
              <p className="text-sm text-[var(--gc-muted)] leading-relaxed whitespace-pre-wrap">{doc.body}</p>
            </Panel>
          ))}
          {!data?.documents?.length && (
            <p className="console-mono text-[var(--gc-dim)]">No knowledge docs in {region}. Check seed/catalog.json.</p>
          )}
        </div>
      )}
    </div>
  );
}
