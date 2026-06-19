import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  code: string;
  language?: string;
  className?: string;
};

export function CodeBlock({ code, language = "bash", className }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("console-panel overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {language}
        </span>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copy}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-foreground/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}
