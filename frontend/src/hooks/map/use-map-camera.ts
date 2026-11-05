import { useEffect, useRef } from "react";
import { LngLatBounds, type Map } from "maplibre-gl";
import type { LocationCoordinate } from "../../api/types";

interface UseMapCameraOptions {
  map: Map | null;
  origin: LocationCoordinate | null;
  destination: LocationCoordinate | null;
  shouldSkipAnimationRef: React.RefObject<boolean>;
}

export function useMapCamera({
  map,
  origin,
  destination,
  shouldSkipAnimationRef,
}: UseMapCameraOptions) {
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!map) return;

    // Skip camera movements on initial empty state
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (!origin && !destination) {
        return;
      }
    }

    // Skip if user just clicked on map or dragged a marker
    if (shouldSkipAnimationRef.current) {
      shouldSkipAnimationRef.current = false;
      return;
    }

    if (origin && destination) {
      const bounds = new LngLatBounds();
      bounds.extend([origin.lng, origin.lat]);
      bounds.extend([destination.lng, destination.lat]);

      map.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 420, right: 80 },
        maxZoom: 13,
        duration: 1000,
      });
    } else if (origin) {
      const targetZoom = Math.max(map.getZoom(), 11);
      map.flyTo({
        center: [origin.lng, origin.lat],
        zoom: targetZoom,
        padding: { left: 380, top: 0, right: 0, bottom: 0 },
        duration: 800,
      });
    } else if (destination) {
      const targetZoom = Math.max(map.getZoom(), 11);
      map.flyTo({
        center: [destination.lng, destination.lat],
        zoom: targetZoom,
        padding: { left: 380, top: 0, right: 0, bottom: 0 },
        duration: 800,
      });
    }
  }, [map, origin, destination, shouldSkipAnimationRef]);
}
