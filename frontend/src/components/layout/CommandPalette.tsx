import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export function CommandPalette({
  open,
  onOpenChange,
  onDemo,
  onSync,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDemo: () => void;
  onSync: () => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    fn();
    onOpenChange(false);
    setSearch("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2">
        <Command
          className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
          shouldFilter
        >
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Search panels and actions…"
            className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-72 overflow-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results.
            </Command.Empty>
            <Command.Group heading="Navigate" className="text-xs text-muted-foreground px-2 py-1">
              {[
                ["Overview", "/app"],
                ["Routing", "/app/routing"],
                ["Inventory", "/app/inventory"],
                ["Replication", "/app/replication"],
                ["Copilot", "/app/copilot"],
                ["Fleet", "/app/fleet"],
              ].map(([label, path]) => (
                <Command.Item
                  key={path}
                  onSelect={() => run(() => navigate(path))}
                  className={cn(
                    "flex cursor-pointer items-center rounded-md px-3 py-2 text-sm",
                    "aria-selected:bg-accent/15 aria-selected:text-accent"
                  )}
                >
                  {label}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Actions" className="text-xs text-muted-foreground px-2 py-1 mt-2">
              <Command.Item
                onSelect={() => run(onDemo)}
                className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm aria-selected:bg-accent/15"
              >
                Run demo flow
              </Command.Item>
              <Command.Item
                onSelect={() => run(onSync)}
                className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm aria-selected:bg-accent/15"
              >
                Force sync
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
