import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TeamPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Team</h1>
      <Card>
        <CardHeader>
          <CardTitle>Organization members</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Invite teammates and assign roles (owner, admin, member, viewer). Org invites are sent via
          email when Resend is configured.
        </CardContent>
      </Card>
    </div>
  );
}
