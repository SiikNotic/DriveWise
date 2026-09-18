import type { GeoPoint } from "@drivewise/shared";

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 200;
const PADDING = 16;

/**
 * A lightweight, dependency-free route-shape rendering: a normalized SVG
 * polyline through the trip's recorded points, with no basemap/street
 * tiles. This project has no maps API key configured, and the app's own
 * local-first design means every trip's route data (raw trip_points) is
 * already available client-side without a network call — an offline-
 * capable shape plot fits that better than a tile-based map would. Swap
 * this out for a real interactive map (Mapbox/Leaflet/Google Maps) once a
 * provider and API key are chosen; nothing else in the Trips feature
 * depends on how this renders.
 */
export function RouteMap({ points }: { points: GeoPoint[] }) {
  if (points.length < 2) return null;

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Longitude degrees cover less ground distance than latitude degrees as
  // you move away from the equator — scale by cos(avg latitude) so the
  // plotted shape isn't horizontally stretched or squashed.
  const avgLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lngScale = Math.max(Math.cos(avgLatRad), 0.15);

  const spanLat = Math.max(maxLat - minLat, 1e-6);
  const spanLng = Math.max((maxLng - minLng) * lngScale, 1e-6);

  const drawableWidth = VIEWBOX_WIDTH - PADDING * 2;
  const drawableHeight = VIEWBOX_HEIGHT - PADDING * 2;
  const scale = Math.min(drawableWidth / spanLng, drawableHeight / spanLat);

  const plotted = points.map((point) => {
    const x = PADDING + ((point.longitude - minLng) * lngScale) * scale + (drawableWidth - spanLng * scale) / 2;
    // SVG y grows downward; latitude grows northward — flip it.
    const y =
      PADDING + (maxLat - point.latitude) * scale + (drawableHeight - spanLat * scale) / 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const [startX, startY] = plotted[0]!.split(",");
  const [endX, endY] = plotted[plotted.length - 1]!.split(",");

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className="bg-muted/40 w-full rounded-lg"
      role="img"
      aria-label="Recorded route"
    >
      <polyline
        points={plotted.join(" ")}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={startX} cy={startY} r={4} fill="var(--color-positive)" />
      <circle cx={endX} cy={endY} r={4} fill="var(--color-negative)" />
    </svg>
  );
}
