export const GEO_HEALTHY = "#ffffff";
export const GEO_WARN = "#888888";
export const GEO_ERROR = "#d71921";
export const GEO_ACCENT = "#d71921";
export const SPACE_BG = "#000000";

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
      return { position: [-0.55, 0.12, 2.15], fov: 42 };
  }
}

export function variantLookAt(variant: GlobeVariant): [number, number, number] {
  return variant === "hero" ? [0.35, 0, 0] : [0, 0, 0];
}

export function variantGlobeScale(variant: GlobeVariant): number {
  return variant === "hero" ? 1.18 : 1;
}

export function variantAnimateCamera(): boolean {
  return false;
}

export function variantGlobeRotate(variant: GlobeVariant, reducedMotion: boolean): boolean {
  if (reducedMotion) return false;
  return variant !== "panel";
}
