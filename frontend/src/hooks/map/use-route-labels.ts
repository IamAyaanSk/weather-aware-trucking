import { useEffect, useRef } from "react";
import { Marker, type Map } from "maplibre-gl";
import { decodePolyline } from "../../lib/polyline";
import type { RouteItem } from "../../api/types";

interface UseRouteLabelsOptions {
  map: Map | null;
  routes?: RouteItem[];
  selectedRouteId?: string | null;
  onSelectRoute?: (routeId: string) => void;
}

interface MarkerRecord {
  marker: Marker;
  element: HTMLElement;
  route: RouteItem;
}

export function formatRouteLabelDuration(totalHours: number): string {
  if (totalHours <= 0) return "0 min";

  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);

  if (hours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${minutes} min`;
}

function haversineDistanceMeters(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number],
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const meanLat = (((lat1 + lat2) / 2) * Math.PI) / 180;
  const x = dLng * Math.cos(meanLat);
  const y = dLat;
  return Math.sqrt(x * x + y * y) * 6371000;
}

function getPolylineCumulativeDistances(coords: [number, number][]): number[] {
  const dists = [0];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistanceMeters(coords[i - 1], coords[i]);
    dists.push(total);
  }
  return dists;
}

function getCoordAtFraction(
  coords: [number, number][],
  cumulativeDists: number[],
  fraction: number,
): [number, number] {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];

  const totalDist = cumulativeDists[cumulativeDists.length - 1];
  const targetDist = totalDist * fraction;

  for (let i = 1; i < cumulativeDists.length; i++) {
    if (cumulativeDists[i] >= targetDist) {
      const prevDist = cumulativeDists[i - 1];
      const nextDist = cumulativeDists[i];
      const segLen = nextDist - prevDist;
      const t = segLen > 0 ? (targetDist - prevDist) / segLen : 0;
      const [lng1, lat1] = coords[i - 1];
      const [lng2, lat2] = coords[i];
      return [lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t];
    }
  }
  return coords[coords.length - 1];
}

function findOptimalRouteLabelPoint(
  coords: [number, number][],
  baseFraction: number,
  existingPoints: [number, number][],
): [number, number] {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];

  const cumDists = getPolylineCumulativeDistances(coords);
  const totalDist = cumDists[cumDists.length - 1];
  if (totalDist === 0) return coords[0];

  if (existingPoints.length === 0) {
    return getCoordAtFraction(coords, cumDists, baseFraction);
  }

  const candidateFractions = [
    baseFraction,
    baseFraction - 0.05,
    baseFraction + 0.05,
    baseFraction - 0.1,
    baseFraction + 0.1,
    baseFraction - 0.15,
    baseFraction + 0.15,
  ].filter((f) => f >= 0.25 && f <= 0.75);

  let bestPoint = getCoordAtFraction(coords, cumDists, baseFraction);
  let maxMinDist = -1;

  for (const fraction of candidateFractions) {
    const pt = getCoordAtFraction(coords, cumDists, fraction);
    let minDist = Infinity;
    for (const ep of existingPoints) {
      const d = haversineDistanceMeters(pt, ep);
      if (d < minDist) {
        minDist = d;
      }
    }

    if (minDist > 60000) {
      return pt;
    }

    if (minDist > maxMinDist) {
      maxMinDist = minDist;
      bestPoint = pt;
    }
  }

  return bestPoint;
}

export function useRouteLabels({
  map,
  routes,
  selectedRouteId,
  onSelectRoute,
}: UseRouteLabelsOptions) {
  const markerRecordsRef = useRef<MarkerRecord[]>([]);
  const onSelectRouteRef = useRef(onSelectRoute);
  const selectedRouteIdRef = useRef(selectedRouteId);

  useEffect(() => {
    onSelectRouteRef.current = onSelectRoute;
    selectedRouteIdRef.current = selectedRouteId;
  });

  // Re-build route labels when routes or map changes
  useEffect(() => {
    if (!map) return;

    const clearMarkers = () => {
      markerRecordsRef.current.forEach((rec) => rec.marker.remove());
      markerRecordsRef.current = [];
    };

    clearMarkers();

    if (!routes || routes.length === 0) {
      return;
    }

    const placedCoords: [number, number][] = [];
    const totalRoutes = routes.length;

    routes.forEach((route, index) => {
      const coords = decodePolyline(route.overview_polyline);
      if (coords.length === 0) return;

      // Base fractions along corridor
      let baseFraction = 0.48;
      if (totalRoutes === 2) {
        baseFraction = index === 0 ? 0.42 : 0.54;
      } else if (totalRoutes >= 3) {
        baseFraction = index === 0 ? 0.4 : index === 1 ? 0.5 : 0.6;
      }

      const labelPoint = findOptimalRouteLabelPoint(coords, baseFraction, placedCoords);
      placedCoords.push(labelPoint);

      // Rank Text determination:
      // "Recommended" if is_recommended, otherwise "1st best", "2nd best", "3rd best"
      let rankText = "";
      if (route.is_recommended) {
        rankText = "Recommended";
      } else if (index === 0) {
        rankText = "1st best";
      } else if (index === 1) {
        rankText = "2nd best";
      } else if (index === 2) {
        rankText = "3rd best";
      } else {
        rankText = `${index + 1}th best`;
      }

      const durationText = formatRouteLabelDuration(route.total_duration_hours);
      const isSelected = route.id === selectedRouteIdRef.current;

      const markerEl = document.createElement("div");
      markerEl.className = `spotter-route-label-marker ${
        isSelected ? "is-selected" : "is-unselected"
      } ${route.is_recommended ? "is-recommended" : ""}`;
      markerEl.setAttribute("title", `${rankText} (${durationText}) - Click to select route`);

      const pillEl = document.createElement("div");
      pillEl.className = "spotter-route-label-pill";

      const titleSpan = document.createElement("span");
      titleSpan.className = "spotter-route-label-title";
      titleSpan.textContent = rankText;

      const dotSpan = document.createElement("span");
      dotSpan.className = "spotter-route-label-dot";
      dotSpan.textContent = "·";

      const durationSpan = document.createElement("span");
      durationSpan.className = "spotter-route-label-duration";
      durationSpan.textContent = durationText;

      pillEl.appendChild(titleSpan);
      pillEl.appendChild(dotSpan);
      pillEl.appendChild(durationSpan);
      markerEl.appendChild(pillEl);

      markerEl.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRouteRef.current?.(route.id);
      });

      const marker = new Marker({
        element: markerEl,
        anchor: "center",
      })
        .setLngLat(labelPoint)
        .addTo(map);

      markerRecordsRef.current.push({
        marker,
        element: markerEl,
        route,
      });
    });

    return () => {
      clearMarkers();
    };
  }, [map, routes]);

  // Synchronize selection state without re-creating DOM markers
  useEffect(() => {
    markerRecordsRef.current.forEach(({ element, route }) => {
      const isSelected = route.id === selectedRouteId;
      element.classList.toggle("is-selected", isSelected);
      element.classList.toggle("is-unselected", !isSelected);
    });
  }, [selectedRouteId]);
}
