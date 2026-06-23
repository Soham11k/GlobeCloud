import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { useConsole } from "../ConsoleContext";
import { useProduct } from "@/lib/hooks";
import { api, streamAgentAsk, type AgentResponse } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel, Chip } from "../components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Message = {
  role: "user" | "agent";
  content: string;
  meta?: AgentResponse;
  streaming?: boolean;
};

const SUGGESTIONS = [
  "How does replication work?",
  "What are the rate limits?",
  "Explain billing and plans",
];

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
          { question, client_lat: client.lat, client_lon: client.lon },
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

  const provider =
    product?.llm_mode === "openai" ? "OpenAI GPT-4o-mini" : "Local heuristic";

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col gap-6">
      <PageHeader
        title="Agent"
        description={`${provider} · grounded on pgvector knowledge · client ${client.lat.toFixed(2)}, ${client.lon.toFixed(2)}`}
      />

      <Panel title="Conversation" className="flex flex-1 flex-col min-h-0 !p-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[280px]">
          {!messages.length && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground max-w-md">
                Ask about replication, routing, billing, or security. Answers cite your knowledge base with confidence scores.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((q) => (
                  <Badge
                    key={q}
                    variant="accent"
                    className="cursor-pointer hover:bg-foreground"
                    onClick={() => ask(q)}
                  >
                    {q}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                  msg.role === "user"
                    ? "bg-accent text-accent-foreground rounded-br-md"
                    : "bg-[var(--surface-2)] rounded-bl-md border border-foreground"
                )}
              >
                {msg.role === "agent" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{msg.content || (msg.streaming ? "▍" : "")}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
                {msg.meta && (
                  <div className="mt-3 space-y-2 border-t border-foreground pt-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {msg.meta.backend_region && <Chip variant="ok">{msg.meta.backend_region}</Chip>}
                      <Chip>{msg.meta.confidence}</Chip>
                      <span className="text-muted-foreground">
                        {msg.meta.inference.provider}
                        {msg.meta.inference.model && ` · ${msg.meta.inference.model}`}
                        {" · "}{msg.meta.inference.latency_ms}ms
                      </span>
                    </div>
                    {msg.meta.citations?.map((c, j) => (
                      <div key={j} className="console-panel mt-2 p-3 font-mono text-xs">
                        <p className="font-medium">{c.title}</p>
                        <p className="text-muted-foreground">
                          {c.region} · score {c.score.toFixed(2)}
                        </p>
                        <p className="mt-1 text-muted-foreground line-clamp-2">{c.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-foreground bg-[var(--surface-0)] p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              onKeyDown={(e) => e.key === "Enter" && ask(input)}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={() => ask(input)} disabled={loading}>
              {loading ? "Thinking…" : "Send"}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
