import { useState } from "react";
import { useConsole } from "../ConsoleContext";
import { useProducts, useOrders, useOrderMutation } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/layout/LoadingState";
import { EmptyState } from "@/components/layout/EmptyState";
import { Panel, DataTable, Chip, Field } from "../components/ui";
import { tierFromProduct, PlanIcon } from "@/components/brand/PlanIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export function CatalogPage() {
  const { region, setRegion, regionIds } = useConsole();
  const [view, setView] = useState<"products" | "orders">("products");
  const [search, setSearch] = useState("");
  const { data: products, isLoading, isError, refetch } = useProducts(region);
  const { data: orders, isLoading: ordersLoading } = useOrders(region);
  const orderMut = useOrderMutation();

  const filtered =
    products?.products.filter(
      (p) =>
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
    ) ?? [];

  const placeOrder = (productId: string, name: string) => {
    orderMut.mutate(
      { region, productId },
      {
        onSuccess: () => toast.success(`Order placed: ${name}`),
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalog"
        description={`Regional product inventory · ${region}`}
        actions={
          <Field label="Region">
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {regionIds.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as "products" | "orders")}>
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "orders" ? (
        <Panel title={`Orders · ${region}`}>
          {ordersLoading ? (
            <LoadingState rows={3} />
          ) : (
          <DataTable
            headers={["ID", "Product", "SKU", "Qty", "Created"]}
            empty="No orders in this region"
            rows={(orders?.orders ?? []).map((o) => [
              <span key="id" className="font-mono text-xs">{o.id.slice(0, 8)}</span>,
              o.product_name ?? o.product_id,
              o.sku ?? "—",
              o.quantity,
              new Date(o.created_at).toLocaleString(),
            ])}
          />
          )}
        </Panel>
      ) : (
        <>
          <Input
            placeholder="Search products or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {isLoading ? (
            <LoadingState rows={4} />
          ) : isError ? (
            <EmptyState
              title="Catalog unavailable"
              description="Could not load products for this region."
              action={
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              }
            />
          ) : !filtered.length ? (
            <EmptyState
              title={search ? "No matching products" : "No products in catalog"}
              description={search ? "Try a different search term or clear the filter." : "Seed catalog.json or enable demo data."}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => {
                const tier = tierFromProduct(p.id, p.category);
                return (
                  <div
                    key={p.id}
                    className="console-panel flex flex-col gap-4 p-5"
                  >
                    <div className="flex gap-3">
                      <PlanIcon tier={tier} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{p.name}</p>
                        <p className="data-mono">{p.sku}</p>
                      </div>
                      {p.category && <Chip>{p.category}</Chip>}
                    </div>
                    {p.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{p.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-xl font-semibold">${p.price.toFixed(2)}</span>
                      <Chip variant={p.stock > 10 ? "ok" : "warn"}>{p.stock} in stock</Chip>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={orderMut.isPending || p.stock < 1}
                      onClick={() => placeOrder(p.id, p.name)}
                    >
                      Place order
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
