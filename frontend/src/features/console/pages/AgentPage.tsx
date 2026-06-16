import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { useConsole } from "../ConsoleContext";
import { useProduct } from "@/lib/hooks";
import { api, streamAgentAsk, type AgentResponse } from "@/lib/api";
import { Panel, Chip, Field } from "../components/ui";
import { toast } from "sonner";

type Message = {
  role: "user" | "agent";
  content: string;
  meta?: AgentResponse;
  streaming?: boolean;
};

export function AgentPage() {
  const { client } = useConsole();
  const { data: product } = useProduct();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ask = async (question: string) => {
    if (!question.trim() || loading) return;
    setInput("");
    setLoading(true);
    setMessages((m) => [...m, { role: "user", content: question }]);

    try {
      setMessages((m) => [...m, { role: "agent", content: "", streaming: true }]);

      try {
        const { answer, meta } = await streamAgentAsk(
          {
            question,
            client_lat: client.lat,
            client_lon: client.lon,
          },
          (full) => {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last?.streaming) copy[copy.length - 1] = { ...last, content: full };
              return copy;
            });
          }
        );
        setMessages((m) => {
          const copy = m.filter((msg) => !msg.streaming);
          return [...copy, { role: "agent", content: answer, meta }];
        });
      } catch {
        const data = await api<AgentResponse>("/agent/ask", {
          method: "POST",
          body: JSON.stringify({
            question,
            client_lat: client.lat,
            client_lon: client.lon,
          }),
        });
        setMessages((m) => {
          const copy = m.filter((msg) => !msg.streaming);
          return [...copy, { role: "agent", content: data.answer, meta: data }];
        });
      }
    } catch (e) {
      toast.error((e as Error).message);
      setMessages((m) => m.filter((msg) => !msg.streaming));
    } finally {
      setLoading(false);
    }
  };

  const provider = product?.llm_mode === "openai" ? "OpenAI GPT-4o-mini" : "Local heuristic (no OPENAI_API_KEY)";

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
      <div>
        <h1 className="text-lg font-semibold">RAG agent</h1>
        <p className="console-mono mt-1 text-[var(--gc-dim)]">
          POST /agent/ask · provider: {provider} · client {client.lat.toFixed(2)}, {client.lon.toFixed(2)}
        </p>
      </div>

      <Panel title="Session" className="flex-1 flex flex-col min-h-0 !p-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[320px]">
          {!messages.length && (
            <p className="console-mono text-[var(--gc-dim)] text-center py-12">
              Ask about replication, routing, billing, or security — answers cite knowledge docs from your SQLite index.
            </p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === "user" ? "text-right" : ""}>
              <div
                className={`inline-block max-w-[90%] text-left px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-[var(--gc-accent)] text-white"
                    : "console-panel border-[var(--gc-border)]"
                }`}
              >
                {msg.role === "agent" ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.content || (msg.streaming ? "…" : "")}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
                {msg.meta && (
                  <div className="mt-3 pt-2 border-t border-[var(--gc-border)] space-y-2">
                    <div className="flex flex-wrap gap-2 console-mono text-[10px]">
                      {msg.meta.backend_region && <Chip variant="ok">{msg.meta.backend_region}</Chip>}
                      <Chip>{msg.meta.confidence}</Chip>
                      <span className="text-[var(--gc-dim)]">
                        {msg.meta.inference.provider}
                        {msg.meta.inference.model && ` / ${msg.meta.inference.model}`}
                        {" · "}{msg.meta.inference.latency_ms}ms
                      </span>
                    </div>
                    {msg.meta.tool_trace?.map((t, j) => (
                      <details key={j} className="console-mono text-[10px] text-[var(--gc-dim)]">
                        <summary className="cursor-pointer">{t.tool}</summary>
                        <pre className="mt-1 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(t, null, 2)}</pre>
                      </details>
                    ))}
                    {msg.meta.citations?.map((c, j) => (
                      <div key={j} className="console-panel p-2 text-[11px] border-[var(--gc-border)]">
                        <strong>{c.title}</strong>
                        <span className="text-[var(--gc-dim)]"> · {c.region} · score {c.score.toFixed(2)}</span>
                        <p className="mt-1 text-[var(--gc-muted)] line-clamp-3">{c.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-[var(--gc-border)] p-4 space-y-2">
          <div className="flex flex-wrap gap-2 console-mono text-[10px]">
            {["How does replication work?", "What are the rate limits?", "Billing and plans"].map((q) => (
              <button key={q} type="button" className="console-chip hover:border-[var(--gc-accent)]" onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Field label="">
              <input
                className="console-input flex-1"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Question…"
                onKeyDown={(e) => e.key === "Enter" && ask(input)}
                disabled={loading}
              />
            </Field>
            <button type="button" className="console-btn console-btn-primary shrink-0" onClick={() => ask(input)} disabled={loading}>
              {loading ? "…" : "Ask"}
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
