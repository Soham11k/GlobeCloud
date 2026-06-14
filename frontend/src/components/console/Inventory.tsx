import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProducts, useOrderMutation, useOrders } from "@/lib/hooks";
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
  const { data: ordersData } = useOrders(region);
  const order = useOrderMutation();
  const [view, setView] = useState<"cards" | "orders">("cards");

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
      <div className="flex gap-2">
        <Button variant={view === "cards" ? "default" : "secondary"} size="sm" onClick={() => setView("cards")}>
          Products
        </Button>
        <Button variant={view === "orders" ? "default" : "secondary"} size="sm" onClick={() => setView("orders")}>
          Order history
        </Button>
      </div>

      <Tabs value={region} onValueChange={onRegionChange}>
        <TabsList>
          {REGIONS.map((r) => (
            <TabsTrigger key={r} value={r}>{r}</TabsTrigger>
          ))}
        </TabsList>
        {REGIONS.map((r) => (
          <TabsContent key={r} value={r}>
            {view === "orders" ? (
              <Card>
                <CardHeader><CardTitle>Recent orders — {r}</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(ordersData?.orders ?? []).map((o) => (
                        <TableRow key={o.id}>
                          <TableCell>{o.product_name ?? o.product_id}</TableCell>
                          <TableCell className="text-muted-foreground">{o.sku ?? "—"}</TableCell>
                          <TableCell>{o.quantity}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(o.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!ordersData?.orders?.length && (
                        <TableRow><TableCell colSpan={4} className="text-muted-foreground">No orders yet</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
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
                    whileHover={{ y: -4 }}
                  >
                    <Card>
                      {p.image_url ? (
                        <div className="h-24 bg-muted bg-cover bg-center rounded-t-lg" style={{ backgroundImage: `url(${p.image_url})` }} />
                      ) : null}
                      <CardHeader>
                        <div className="flex justify-between items-start gap-2">
                          <CardTitle className="text-base">{p.name}</CardTitle>
                          {p.category && <Badge>{p.category}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold">${p.price.toFixed(2)}</span>
                          <Badge variant={p.stock > 10 ? "success" : "warning"}>{p.stock} in stock</Badge>
                        </div>
                        <motion.div
                          className="h-1.5 rounded-full bg-muted overflow-hidden"
                          initial={false}
                          animate={{ opacity: 1 }}
                        >
                          <motion.div
                            className="h-full bg-accent rounded-full"
                            animate={{ width: `${Math.min(100, (p.stock / 50) * 100)}%` }}
                            transition={{ type: "spring", stiffness: 120 }}
                          />
                        </motion.div>
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
