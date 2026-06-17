import { Vector3 } from "three";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";

/** Geographic lat/lon (degrees) → unit sphere position. Y-up, standard mapping. */
export function latLonToVector3(lat: number, lon: number, radius = 1): Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/** Arc control point lifted above the sphere between two surface points. */
export function arcControlPoint(a: Vector3, b: Vector3, lift = 0.35): Vector3 {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return mid.normalize().multiplyScalar(a.length() + lift);
}

function walkCoords(coords: number[] | number[][] | number[][][], out: [number, number][], step: number) {
  if (typeof coords[0] === "number") {
    const lon = coords[0] as number;
    const lat = coords[1] as number;
    if (out.length % step === 0) out.push([lon, lat]);
    return;
  }
  for (const part of coords as number[][] | number[][][]) {
    walkCoords(part as number[] | number[][] | number[][][], out, step);
  }
}

let _landCache: [number, number][] | null = null;

/** Subsampled coast points from Natural Earth 110m (lon, lat). */
export function sampleLandLatLon(maxPoints = 480): [number, number][] {
  if (_landCache) return _landCache.slice(0, maxPoints);
  const topo = world as unknown as Topology;
  const countries = feature(topo, topo.objects.countries);
  const raw: [number, number][] = [];
  if ("features" in countries) {
    for (const f of countries.features) {
      const geom = f.geometry;
      if (geom?.type === "Polygon" || geom?.type === "MultiPolygon") {
        walkCoords(geom.coordinates as number[][] | number[][][], raw, 6);
      }
    }
  }
  _landCache = raw;
  return raw.slice(0, maxPoints);
}
