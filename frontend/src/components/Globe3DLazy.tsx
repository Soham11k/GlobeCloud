import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const Globe3DInner = lazy(() =>
  import("./Globe3D").then((m) => ({ default: m.Globe3D }))
);

export function Globe3DLazy({ className }: { className?: string }) {
  return (
    <Suspense fallback={<Skeleton className={className || "h-64 w-full"} />}>
      <Globe3DInner className={className} />
    </Suspense>
  );
}
