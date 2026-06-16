import { useState } from "react";
import { useConsole } from "../ConsoleContext";
import { useProducts, useOrders, useOrderMutation } from "@/lib/hooks";
import { Panel, DataTable, Chip, Field } from "../components/ui";
import { tierFromProduct, PlanIcon } from "@/components/brand/PlanIcon";
import { toast } from "sonner";

export function CatalogPage() {
  const { region, setRegion, regionIds } = useConsole();
  const [view, setView] = useState<"products" | "orders">("products");
  const { data: products, isLoading } = useProducts(region);
  const { data: orders } = useOrders(region);
  const orderMut = useOrderMutation();

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Catalog</h1>
          <p className="console-mono mt-1 text-[var(--gc-dim)]">
            GET /regions/{region}/products · SQLite inventory
            {products?.is_local != null && (
              <Chip className="ml-2">{products.is_local ? "local write" : "remote read"}</Chip>
            )}
          </p>
        </div>
        <Field label="region">
          <select className="console-input w-auto min-w-[160px]" value={region} onChange={(e) => setRegion(e.target.value)}>
            {regionIds.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex gap-2">
        <button type="button" className={`console-btn ${view === "products" ? "console-btn-primary" : ""}`} onClick={() => setView("products")}>
          Products
        </button>
        <button type="button" className={`console-btn ${view === "orders" ? "console-btn-primary" : ""}`} onClick={() => setView("orders")}>
          Orders
        </button>
      </div>

      {view === "orders" ? (
        <Panel title={`Orders · ${region}`}>
          <DataTable
            headers={["id", "product", "sku", "qty", "created"]}
            empty="No orders in this region"
            rows={(orders?.orders ?? []).map((o) => [
              o.id.slice(0, 8),
              o.product_name ?? o.product_id,
              o.sku ?? "—",
              o.quantity,
              new Date(o.created_at).toLocaleString(),
            ])}
          />
        </Panel>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {isLoading ? (
            <p className="console-mono text-[var(--gc-dim)] col-span-full">Loading catalog…</p>
          ) : (
            products?.products.map((p) => {
              const tier = tierFromProduct(p.id, p.category);
              return (
                <div key={p.id} className="console-panel p-4 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <PlanIcon tier={tier} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="console-mono text-[10px] text-[var(--gc-dim)]">{p.sku}</p>
                    </div>
                    {p.category && <Chip>{p.category}</Chip>}
                  </div>
                  {p.description && (
                    <p className="text-xs text-[var(--gc-muted)] leading-relaxed line-clamp-3">{p.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-auto">
                    <span className="console-kpi-val text-base">${p.price.toFixed(2)}</span>
                    <Chip variant={p.stock > 10 ? "ok" : "warn"}>{p.stock} stock</Chip>
                  </div>
                  <button
                    type="button"
                    className="console-btn w-full"
                    disabled={orderMut.isPending || p.stock < 1}
                    onClick={() => placeOrder(p.id, p.name)}
                  >
                    Place order
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
