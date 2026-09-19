import dynamic from "next/dynamic";
import type { GeoPoint } from "@drivewise/shared";

import { RouteMap } from "@/components/trips/route-map";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// mapbox-gl reads `window`/`document` at import time, so it can only ever
// render client-side — and there's no reason to ship it to the client at
// all when no token is configured, hence the dynamic import rather than a
// static one at the top of this file.
const MapboxRouteMap = dynamic(
  () => import("@/components/trips/mapbox-route-map").then((mod) => mod.MapboxRouteMap),
  { ssr: false },
);

/**
 * Picks the real Mapbox map when `NEXT_PUBLIC_MAPBOX_TOKEN` is configured,
 * falling back to the dependency-free SVG route shape otherwise — see
 * that component's own doc comment for why the fallback exists at all.
 */
export function TripRouteMap({ points }: { points: GeoPoint[] }) {
  if (MAPBOX_TOKEN) return <MapboxRouteMap points={points} />;
  return <RouteMap points={points} />;
}
