"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { GeoPoint } from "@drivewise/shared";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * The real interactive map — street tiles, pan/zoom, start/end pins along
 * the recorded route. Only rendered by `TripRouteMap` when
 * `NEXT_PUBLIC_MAPBOX_TOKEN` is configured; falls back to nothing here
 * (the caller is responsible for the no-token case) since this file
 * assumes the token exists by the time it's mounted.
 */
export function MapboxRouteMap({ points }: { points: GeoPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || points.length < 2) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const coordinates: [number, number][] = points.map((point) => [point.longitude, point.latitude]);
    const [first, ...rest] = coordinates;
    const bounds = rest.reduce(
      (acc, coord) => acc.extend(coord),
      new mapboxgl.LngLatBounds(first, first),
    );

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      bounds,
      fitBoundsOptions: { padding: 32, maxZoom: 16 },
      attributionControl: false,
    });

    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    const startMarker = new mapboxgl.Marker({ color: "#0f766e" }).setLngLat(first);
    const endMarker = new mapboxgl.Marker({ color: "#b3261e" }).setLngLat(coordinates[coordinates.length - 1]!);

    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates },
        },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#0f766e", "line-width": 4 },
      });

      startMarker.addTo(map);
      endMarker.addTo(map);
    });

    return () => {
      startMarker.remove();
      endMarker.remove();
      map.remove();
    };
  }, [points]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full overflow-hidden rounded-lg"
      role="img"
      aria-label="Recorded route"
    />
  );
}
