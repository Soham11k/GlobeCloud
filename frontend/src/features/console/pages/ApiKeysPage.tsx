import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">API keys</h1>
      <Card>
        <CardHeader>
          <CardTitle>Organization API keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            API keys are scoped to your organization. Rotate keys regularly; revoked keys are logged
            in the audit trail.
          </p>
          <Button>Create API key</Button>
        </CardContent>
      </Card>
    </div>
  );
}
