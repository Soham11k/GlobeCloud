import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProducts, useOrderMutation } from "@/lib/hooks";
import { markChecklist } from "./Overview";
import { toast } from "sonner";

const REGIONS = ["us-east-1", "eu-west-1", "ap-south-1"];

export function InventoryPanel({
  region,
  onRegionChange,
}: {
  region: string;
  onRegionChange: (r: string) => void;
}) {
  const { data, isLoading, isError, error } = useProducts(region);
  const order = useOrderMutation();

  const placeOrder = (productId: string) => {
    order.mutate(
      { region, productId },
      {
        onSuccess: () => {
          markChecklist("ordered");
          toast.success("Order placed");
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <div className="space-y-4">
      <Tabs value={region} onValueChange={onRegionChange}>
        <TabsList>
          {REGIONS.map((r) => (
            <TabsTrigger key={r} value={r}>
              {r}
            </TabsTrigger>
          ))}
        </TabsList>
        {REGIONS.map((r) => (
          <TabsContent key={r} value={r}>
            {isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
            ) : isError ? (
              <p className="text-danger text-sm">{(error as Error).message}</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data?.products.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{p.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold">${p.price.toFixed(2)}</span>
                          <Badge variant={p.stock > 10 ? "success" : "warning"}>
                            {p.stock} in stock
                          </Badge>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full transition-all"
                            style={{ width: `${Math.min(100, (p.stock / 50) * 100)}%` }}
                          />
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          disabled={order.isPending || p.stock < 1}
                          onClick={() => placeOrder(p.id)}
                        >
                          <ShoppingCart className="h-4 w-4" /> Order 1
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
