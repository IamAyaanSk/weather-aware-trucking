import { useRef, useCallback } from "react";
import { useMaplibre } from "../hooks/map/use-maplibre";
import { useDraggableMarker } from "../hooks/map/use-draggable-marker";
import { useMapPicker } from "../hooks/map/use-map-picker";
import { useMapCamera } from "../hooks/map/use-map-camera";
import { useRouteLines } from "../hooks/map/use-route-lines";
import { useRouteCheckpoints } from "../hooks/map/use-route-checkpoints";
import { createOriginMarkerElement, createDestinationMarkerElement } from "../lib/map-markers";
import type { Checkpoint, LocationCoordinate, RouteItem } from "../api/types";
import { cn } from "cn";

interface RouteMapProps {
  className?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
  origin?: LocationCoordinate | null;
  destination?: LocationCoordinate | null;
  onOriginChange?: (location: LocationCoordinate) => void;
  onDestinationChange?: (location: LocationCoordinate) => void;
  pickingTarget?: "origin" | "destination" | null;
  onPickLocation?: (target: "origin" | "destination", location: LocationCoordinate) => void;
  onCancelPick?: () => void;
  isPlanning?: boolean;
  routes?: RouteItem[];
  selectedRouteId?: string | null;
  onSelectRoute?: (routeId: string) => void;
  onSelectCheckpoint?: (checkpoint: Checkpoint) => void;
  isEditing?: boolean;
}

export function RouteMap({
  className,
  initialCenter,
  initialZoom,
  origin = null,
  destination = null,
  onOriginChange,
  onDestinationChange,
  pickingTarget = null,
  onPickLocation,
  onCancelPick,
  isPlanning = false,
  routes,
  selectedRouteId,
  onSelectRoute,
  onSelectCheckpoint,
  isEditing = true,
}: RouteMapProps): React.JSX.Element {
  const { containerRef, map } = useMaplibre({ initialCenter, initialZoom });
  const skipCameraAnimationRef = useRef(false);

  const markMapInteraction = useCallback(() => {
    skipCameraAnimationRef.current = true;
  }, []);

  // Origin Marker - Draggable only during the editing phase
  useDraggableMarker({
    map,
    location: origin,
    onChange: onOriginChange,
    createMarkerElement: createOriginMarkerElement,
    onDragStateChange: markMapInteraction,
    draggable: isEditing && !isPlanning,
  });

  // Destination Marker - Draggable only during the editing phase
  useDraggableMarker({
    map,
    location: destination,
    onChange: onDestinationChange,
    createMarkerElement: createDestinationMarkerElement,
    onDragStateChange: markMapInteraction,
    draggable: isEditing && !isPlanning,
  });

  // Map Click Picker Mode
  useMapPicker({
    map,
    pickingTarget: isPlanning ? null : pickingTarget,
    onPickLocation,
    onUserMapInteraction: markMapInteraction,
  });

  // Route Lines Layer
  useRouteLines({
    map,
    routes,
    selectedRouteId,
    onSelectRoute,
  });

  // Active Route Checkpoints Layer with interactive risk-colored circles and hover card
  const activeRoute = routes?.find((r) => r.id === selectedRouteId) ?? routes?.[0] ?? null;

  useRouteCheckpoints({
    map,
    checkpoints: activeRoute?.checkpoints,
    routeId: activeRoute?.id,
    onSelectCheckpoint,
  });

  // Camera Framing & Bounds (only active when no routes drawn, as useRouteLines handles route bounds)
  useMapCamera({
    map,
    origin,
    destination,
    shouldSkipAnimationRef: skipCameraAnimationRef,
  });

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-background", className)}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {/* Map Picking Active Banner */}
      {pickingTarget && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 bg-card/95 border border-border px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md">
          <span className="size-2 rounded-full bg-primary" />
          <span className="text-xs font-medium text-foreground">
            Click on the map to set{" "}
            <span className="text-primary font-semibold capitalize">{pickingTarget}</span>
          </span>
          <button
            type="button"
            onClick={onCancelPick}
            className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1 cursor-pointer font-medium"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
