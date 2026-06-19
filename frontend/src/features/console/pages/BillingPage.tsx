import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useBillingStatus } from "@/lib/hooks";
import { startCheckout, openBillingPortal } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KpiSkeleton } from "@/components/layout/LoadingState";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 49,
    description: "Three regions, replication, and agent for growing teams.",
    features: ["3 regions", "Transactional outbox sync", "Org API keys", "Email support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 149,
    description: "Higher limits, priority routing, and Stripe billing portal.",
    features: ["Everything in Starter", "Priority probes", "Advanced audit", "SLA monitoring"],
    highlighted: true,
  },
];

export function BillingPage() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const { data: status, isLoading } = useBillingStatus();

  useEffect(() => {
    if (params.get("success") === "1") {
      toast.success("Subscription updated");
      qc.invalidateQueries({ queryKey: ["billing-status"] });
      setParams({}, { replace: true });
    }
    if (params.get("canceled") === "1") {
      toast.message("Checkout canceled");
      setParams({}, { replace: true });
    }
  }, [params, setParams, qc]);

  const currentTier = status?.plan_tier ?? "none";
  const isActive = status?.status === "active";

  const checkout = async (plan: string) => {
    try {
      const res = await startCheckout(plan);
      if (res.checkout_url) window.location.assign(res.checkout_url);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const portal = async () => {
    try {
      const res = await openBillingPortal();
      if (res.portal_url) window.location.assign(res.portal_url);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Manage your subscription and payment methods."
        actions={
          <Button variant="outline" onClick={portal} disabled={!isActive}>
            Manage billing
          </Button>
        }
      />

      {isLoading ? (
        <KpiSkeleton count={1} />
      ) : (
        <div className="console-panel p-6">
          <h2 className="text-base font-medium">Current plan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentTier === "none"
              ? "No active subscription"
              : `${currentTier} · ${status?.status ?? "inactive"}`}
            {status?.period_end && (
              <span className="mt-1 block">
                Renews {new Date(status.period_end).toLocaleDateString()}
              </span>
            )}
          </p>
          <div className="mt-4">
            <Badge variant={isActive ? "success" : "default"} className="capitalize">
              {status?.status ?? "inactive"}
            </Badge>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {PLANS.map((plan) => {
          const isCurrent = currentTier === plan.id && isActive;
          return (
            <div
              key={plan.id}
              className={cn(
                "console-panel p-6",
                isCurrent && "border-accent/40",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {isCurrent && <Badge variant="accent">Current</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <p className="pt-3 text-3xl font-semibold tracking-tight">
                ${plan.price}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-accent" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={plan.highlighted ? "default" : "outline"}
                disabled={isCurrent}
                onClick={() => checkout(plan.id)}
              >
                {isCurrent ? "Current plan" : `Upgrade to ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Stripe must be configured on the server for checkout. When unavailable, contact support for manual provisioning.
      </p>
    </div>
  );
}
