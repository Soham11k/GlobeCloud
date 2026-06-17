import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export function BillingPage() {
  const startCheckout = async (plan: string) => {
    const res = await api<{ checkout_url: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });
    if (res.checkout_url) window.location.href = res.checkout_url;
  };

  const openPortal = async () => {
    const res = await api<{ portal_url: string }>("/billing/portal", { method: "POST" });
    if (res.portal_url) window.location.href = res.portal_url;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => startCheckout("starter")}>Upgrade to Starter</Button>
          <Button variant="outline" onClick={() => startCheckout("pro")}>
            Upgrade to Pro
          </Button>
          <Button variant="secondary" onClick={openPortal}>
            Manage billing
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
