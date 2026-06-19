import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/layout/LoadingState";
import { Panel, DataTable } from "../components/ui";
import { useOrgMembers } from "@/lib/hooks";
import { useAuth } from "@/lib/useAuth";
import { inviteMember, updateMemberRole, removeMember } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ROLES = ["owner", "admin", "member", "viewer"] as const;
const INVITE_ROLES = ["admin", "member", "viewer"] as const;

export function TeamPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useOrgMembers();
  const canManage = user?.org_role === "owner" || user?.org_role === "admin";

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [inviting, setInviting] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const res = await inviteMember(email.trim(), inviteRole);
      toast.success(res.message);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["org-members"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (memberId: string, role: string) => {
    try {
      await updateMemberRole(memberId, role);
      qc.invalidateQueries({ queryKey: ["org-members"] });
      toast.success("Role updated");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const confirmRemove = async () => {
    if (!removeId) return;
    try {
      await removeMember(removeId);
      qc.invalidateQueries({ queryKey: ["org-members"] });
      toast.success("Member removed");
      setRemoveId(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Invite teammates and manage roles for your organization."
      />

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite member</CardTitle>
            <CardDescription>
              Invites are emailed when Resend is configured; otherwise share the signup link manually.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={sendInvite} className="flex flex-wrap gap-3">
              <Input
                type="email"
                required
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="max-w-xs"
              />
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={inviting}>
                {inviting ? "Sending…" : "Send invite"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Panel title="Members">
        {isLoading ? (
          <LoadingState rows={4} />
        ) : (
          <DataTable
            headers={["Name", "Email", "Role", ""]}
            empty="No members found"
            rows={(data?.members ?? []).map((m) => [
              m.name || "—",
              m.email,
              canManage && m.user_id !== user?.id ? (
                <Select
                  key="role"
                  value={m.role}
                  onValueChange={(v) => changeRole(m.id, v)}
                  disabled={m.role === "owner" && user?.org_role !== "owner"}
                >
                  <SelectTrigger className="h-8 w-[110px] text-xs capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem
                        key={r}
                        value={r}
                        disabled={r === "owner" && user?.org_role !== "owner"}
                        className="capitalize"
                      >
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span key="role" className="capitalize">{m.role}</span>
              ),
              canManage && m.user_id !== user?.id && m.role !== "owner" ? (
                <Button key="rm" variant="ghost" size="sm" onClick={() => setRemoveId(m.id)}>
                  Remove
                </Button>
              ) : (
                "—"
              ),
            ])}
          />
        )}
      </Panel>

      {(data?.invites?.length ?? 0) > 0 && (
        <Panel title="Pending invites">
          <DataTable
            headers={["Email", "Role", "Expires"]}
            rows={(data?.invites ?? []).map((inv) => [
              inv.email,
              <span key="r" className="capitalize">{inv.role}</span>,
              inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "—",
            ])}
          />
        </Panel>
      )}

      <Dialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove team member?</DialogTitle>
            <DialogDescription>
              They will lose access to organization resources immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoveId(null)}>Cancel</Button>
            <Button onClick={confirmRemove}>Remove</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
