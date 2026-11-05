import { useEffect, useRef } from "react";
import type { Map, MapMouseEvent } from "maplibre-gl";
import { reverseGeocodePhoton } from "../../api/photon";
import type { LocationCoordinate } from "../../api/types";

interface UseMapPickerOptions {
  map: Map | null;
  pickingTarget: "origin" | "destination" | null;
  onPickLocation?: (target: "origin" | "destination", location: LocationCoordinate) => void;
  onUserMapInteraction?: () => void;
}

export function useMapPicker({
  map,
  pickingTarget,
  onPickLocation,
  onUserMapInteraction,
}: UseMapPickerOptions) {
  const onPickLocationRef = useRef(onPickLocation);
  const onUserMapInteractionRef = useRef(onUserMapInteraction);

  useEffect(() => {
    onPickLocationRef.current = onPickLocation;
    onUserMapInteractionRef.current = onUserMapInteraction;
  });

  useEffect(() => {
    if (!map || !pickingTarget) return;

    const canvas = map.getCanvas();
    canvas.style.cursor = "crosshair";

    const handleClick = (e: MapMouseEvent) => {
      onUserMapInteractionRef.current?.();

      const lng = Number(e.lngLat.lng.toFixed(5));
      const lat = Number(e.lngLat.lat.toFixed(5));

      // Immediate acknowledgement without showing raw lat/long coordinates
      onPickLocationRef.current?.(pickingTarget, {
        name: "Locating address...",
        lat,
        lng,
      });

      void reverseGeocodePhoton(lng, lat).then((geo) => {
        onPickLocationRef.current?.(pickingTarget, {
          name: geo.fullName || "Pinned location",
          lat,
          lng,
        });
      });
    };

    map.on("click", handleClick);

    return () => {
      canvas.style.cursor = "";
      map.off("click", handleClick);
    };
  }, [map, pickingTarget]);
}
