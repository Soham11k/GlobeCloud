import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, streamAgentAsk, type AgentResponse } from "@/lib/api";
import { markChecklist } from "./Overview";
import { toast } from "sonner";

type Message = {
  role: "user" | "agent";
  content: string;
  meta?: AgentResponse;
  streaming?: boolean;
};

const PROMPTS = [
  "How does cross-region replication work?",
  "Which region has the lowest latency?",
];

export function CopilotPanel({
  clientLat,
  clientLon,
}: {
  clientLat: number;
  clientLon: number;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      content: "Ask about replication, routing, or inventory. Answers include source citations when available.",
    },
  ]);
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
      let streamed = "";
      setMessages((m) => [...m, { role: "agent", content: "", streaming: true }]);

      try {
        for await (const token of streamAgentAsk({
          question,
          client_lat: clientLat,
          client_lon: clientLon,
        })) {
          streamed += token;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "agent", content: streamed, streaming: true };
            return copy;
          });
        }
        markChecklist("asked");
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { ...copy[copy.length - 1], streaming: false };
          return copy;
        });
      } catch {
        const data = await api<AgentResponse>("/agent/ask", {
          method: "POST",
          body: JSON.stringify({
            question,
            client_lat: clientLat,
            client_lon: clientLon,
          }),
        });
        markChecklist("asked");
        setMessages((m) => {
          const copy = m.filter((msg) => !msg.streaming);
          return [
            ...copy,
            { role: "agent", content: data.answer, meta: data },
          ];
        });
      }
    } catch (e) {
      toast.error((e as Error).message);
      setMessages((m) => m.filter((msg) => !msg.streaming));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-[calc(100vh-12rem)] max-h-[640px]">
      <CardContent className="flex flex-col flex-1 p-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted"
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
                  <div className="mt-2 flex flex-wrap gap-1 items-center text-xs opacity-80">
                    {msg.meta.backend_region && (
                      <Badge variant="accent">{msg.meta.backend_region}</Badge>
                    )}
                    <Badge>{msg.meta.confidence}</Badge>
                    <span>
                      {msg.meta.inference.provider} · {msg.meta.inference.latency_ms}ms
                    </span>
                  </div>
                )}
                {msg.meta?.citations?.map((c, j) => (
                  <div key={j} className="mt-2 p-2 rounded bg-background/50 text-xs border border-border">
                    <strong>{c.title}</strong> · {c.region}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-border p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => ask(p)}
                className="text-xs text-accent underline hover:no-underline"
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              onKeyDown={(e) => e.key === "Enter" && ask(input)}
              disabled={loading}
            />
            <Button onClick={() => ask(input)} disabled={loading}>
              {loading ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
