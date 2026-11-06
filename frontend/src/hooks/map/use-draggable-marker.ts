import { useEffect, useRef } from "react";
import { Marker, type Map } from "maplibre-gl";
import { reverseGeocodePhoton } from "../../api/photon";
import type { LocationCoordinate } from "../../api/types";

interface UseDraggableMarkerOptions {
  map: Map | null;
  location: LocationCoordinate | null;
  onChange?: (location: LocationCoordinate) => void;
  createMarkerElement: () => HTMLElement;
  onDragStateChange?: (isDragging: boolean) => void;
  draggable?: boolean;
}

export function useDraggableMarker({
  map,
  location,
  onChange,
  createMarkerElement,
  onDragStateChange,
  draggable = true,
}: UseDraggableMarkerOptions) {
  const markerRef = useRef<Marker | null>(null);
  const isDraggingRef = useRef(false);

  const onChangeRef = useRef(onChange);
  const onDragStateChangeRef = useRef(onDragStateChange);

  useEffect(() => {
    onChangeRef.current = onChange;
    onDragStateChangeRef.current = onDragStateChange;
  });

  useEffect(() => {
    if (!map) return;

    if (!location) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    // If currently dragging, don't re-position marker from outside state
    if (isDraggingRef.current) {
      return;
    }

    if (!markerRef.current) {
      const el = createMarkerElement();
      el.classList.toggle("is-draggable", draggable);
      const isOrigin = el.classList.contains("origin-marker");
      const label = isOrigin ? "Origin" : "Destination";
      el.setAttribute("title", draggable ? `${label} (Drag to adjust)` : label);

      const marker = new Marker({
        element: el,
        draggable,
        anchor: "bottom",
      })
        .setLngLat([location.lng, location.lat])
        .addTo(map);

      marker.on("dragstart", () => {
        isDraggingRef.current = true;
        onDragStateChangeRef.current?.(true);
        el.classList.add("is-dragging");
      });

      marker.on("dragend", () => {
        el.classList.remove("is-dragging");
        onDragStateChangeRef.current?.(false);

        const { lng, lat } = marker.getLngLat();
        const roundedLng = Number(lng.toFixed(5));
        const roundedLat = Number(lat.toFixed(5));

        // Immediate acknowledgement without showing lat/long numbers
        onChangeRef.current?.({
          name: "Locating address...",
          lat: roundedLat,
          lng: roundedLng,
        });

        void reverseGeocodePhoton(roundedLng, roundedLat).then((geo) => {
          isDraggingRef.current = false;
          onChangeRef.current?.({
            name: geo.fullName || "Pinned location",
            lat: roundedLat,
            lng: roundedLng,
          });
        });
      });

      markerRef.current = marker;
    } else {
      markerRef.current.setDraggable(draggable);
      const el = markerRef.current.getElement();
      el.classList.toggle("is-draggable", draggable);
      const isOrigin = el.classList.contains("origin-marker");
      const label = isOrigin ? "Origin" : "Destination";
      el.setAttribute("title", draggable ? `${label} (Drag to adjust)` : label);

      const cur = markerRef.current.getLngLat();
      if (
        Math.abs(cur.lng - location.lng) > 0.00001 ||
        Math.abs(cur.lat - location.lat) > 0.00001
      ) {
        markerRef.current.setLngLat([location.lng, location.lat]);
      }
    }

    return () => {
      // Do not remove on simple position update; cleanup on map change or unmount
    };
  }, [map, location, createMarkerElement, draggable]);

  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [map]);
}
