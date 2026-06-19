export const GEO_HEALTHY = "#2DD4A0";
export const GEO_WARN = "#F0A84A";
export const GEO_ERROR = "#f87171";
export const GEO_ACCENT = "#5B52FF";
export const SPACE_BG = "#03030A";

export const ARC_PAIRS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 0],
];

export function markerColor(_regionId: string, latency?: number, healthy = true): string {
  if (!healthy) return GEO_ERROR;
  if (latency != null && latency > 80) return GEO_WARN;
  return GEO_HEALTHY;
}

export type GlobeVariant = "hero" | "panel" | "ambient";

export function variantCamera(variant: GlobeVariant): { position: [number, number, number]; fov: number } {
  switch (variant) {
    case "panel":
      return { position: [0, 0, 2.8], fov: 45 };
    case "ambient":
      return { position: [0.3, 0.2, 3.5], fov: 52 };
    default:
      // Closer + offset left so the globe reads large beside the hero copy
      return { position: [-0.55, 0.12, 2.15], fov: 42 };
  }
}

export function variantLookAt(variant: GlobeVariant): [number, number, number] {
  return variant === "hero" ? [0.35, 0, 0] : [0, 0, 0];
}

export function variantGlobeScale(variant: GlobeVariant): number {
  return variant === "hero" ? 1.18 : 1;
}

export function variantAnimateCamera(variant: GlobeVariant): boolean {
  return variant === "hero";
}

export function variantGlobeRotate(variant: GlobeVariant, reducedMotion: boolean): boolean {
  if (reducedMotion) return false;
  return variant !== "panel";
}
