import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/layout/LoadingState";
import { Panel, DataTable } from "../components/ui";
import { useApiKeys } from "@/lib/hooks";
import { useAuth } from "@/lib/useAuth";
import { createApiKey, revokeApiKey } from "@/lib/settings";
import { getApiKey, setApiKey } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ApiKeysPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useApiKeys();
  const canManage = user?.org_role === "owner" || user?.org_role === "admin";

  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState("default");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [devKey, setDevKey] = useState(getApiKey());

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await createApiKey(label || "default");
      setCreateOpen(false);
      setRevealedKey(res.key);
      setLabel("default");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key created");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeId) return;
    try {
      await revokeApiKey(revokeId);
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key revoked");
      setRevokeId(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="API keys"
        description="Organization-scoped keys for programmatic access. Rotate regularly."
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>Create API key</Button>
          ) : undefined
        }
      />

      <Panel title="Organization keys">
        {isLoading ? (
          <LoadingState rows={3} />
        ) : (
          <DataTable
            headers={["Label", "Created", "Last used", ""]}
            empty={canManage ? "No API keys yet — create one to get started" : "No API keys"}
            rows={(data?.keys ?? []).map((k) => [
              k.label,
              k.created_at ? new Date(k.created_at).toLocaleDateString() : "—",
              k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never",
              canManage ? (
                <Button
                  key="revoke"
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger"
                  onClick={() => setRevokeId(k.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                "—"
              ),
            ])}
          />
        )}
      </Panel>

      <div className="glass-panel p-6">
        <h2 className="text-base font-medium">Developer host key</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional X-API-Key for local or host-level auth. OpenAI runs server-side via OPENAI_API_KEY.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input
            type="password"
            value={devKey}
            onChange={(e) => setDevKey(e.target.value)}
            placeholder="Leave blank for open local dev"
            className="max-w-md"
          />
          <Button
            variant="outline"
            onClick={() => {
              setApiKey(devKey.trim());
              qc.invalidateQueries();
              toast.success("Host API key saved");
            }}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDevKey("");
              setApiKey("");
              qc.invalidateQueries();
              toast.success("Host API key cleared");
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>Give this key a label so you can identify it later.</DialogDescription>
          </DialogHeader>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. production CI"
          />
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "Create key"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revealedKey} onOpenChange={() => setRevealedKey(null)}>
        <DialogContent className="glass-panel border-accent/30">
          <DialogHeader>
            <DialogTitle>Save your API key</DialogTitle>
            <DialogDescription className="text-warning">
              This is the only time the full key will be shown. Store it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
            <Input readOnly value={revealedKey ?? ""} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => revealedKey && copyKey(revealedKey)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API key?</DialogTitle>
            <DialogDescription>
              Applications using this key will lose access immediately. This is logged in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRevokeId(null)}>Cancel</Button>
            <Button variant="default" onClick={handleRevoke}>Revoke</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
