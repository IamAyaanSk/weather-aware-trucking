import { useEffect, useRef } from "react";
import { Marker, Popup, type Map } from "maplibre-gl";
import type { Checkpoint } from "../../api/types";
import { getRiskConfig } from "../../lib/risk";
import { createCheckpointPopupHtml } from "../../lib/checkpoint-popup-html";

interface UseRouteCheckpointsOptions {
  map: Map | null;
  checkpoints?: Checkpoint[];
  routeId?: string | null;
  forecastHour?: number;
  onSelectCheckpoint?: (checkpoint: Checkpoint) => void;
}

interface MarkerRecord {
  marker: Marker;
  element: HTMLElement;
  checkpoint: Checkpoint;
}

export function useRouteCheckpoints({
  map,
  checkpoints,
  routeId,
  forecastHour = 0,
  onSelectCheckpoint,
}: UseRouteCheckpointsOptions) {
  const markerRecordsRef = useRef<MarkerRecord[]>([]);
  const activeMarkerElRef = useRef<HTMLElement | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const onSelectCheckpointRef = useRef(onSelectCheckpoint);

  useEffect(() => {
    onSelectCheckpointRef.current = onSelectCheckpoint;
  });

  // Setup single reusable Popup instance
  useEffect(() => {
    const popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: [0, -16],
      className: "checkpoint-popup",
    });

    popupRef.current = popup;

    return () => {
      popup.remove();
      popupRef.current = null;
    };
  }, []);

  // Synchronize Checkpoint Markers with active route
  useEffect(() => {
    if (!map) return;

    // Helper to clear existing markers and popup
    const clearMarkers = () => {
      markerRecordsRef.current.forEach((rec) => rec.marker.remove());
      markerRecordsRef.current = [];
      if (popupRef.current) {
        popupRef.current.remove();
      }
      if (activeMarkerElRef.current) {
        activeMarkerElRef.current.classList.remove("is-active");
        activeMarkerElRef.current = null;
      }
    };

    clearMarkers();

    if (!checkpoints || checkpoints.length === 0) {
      return;
    }

    const popup = popupRef.current;
    const totalCount = checkpoints.length;

    // Create a prominent DOM Marker for each checkpoint
    checkpoints.forEach((cp) => {
      const risk = getRiskConfig(cp.arrival_weather?.risk_level);
      const isModerate = risk.level === "MODERATE";

      // Outer marker container (MapLibre controls its transform)
      const markerContainer = document.createElement("div");
      markerContainer.className = "spotter-checkpoint-marker";
      markerContainer.setAttribute(
        "title",
        `Checkpoint #${cp.index + 1} (ETA +${cp.arrival_hour_offset}h • ${risk.label}) - Click to view details`,
      );

      // Inner badge container (receives hover & active scale animations without shifting coordinates)
      const badgeWrapper = document.createElement("div");
      badgeWrapper.className = "spotter-checkpoint-badge";

      // Transport Diamond Waypoint Shape (distinct from origin circle & destination pin)
      const diamond = document.createElement("div");
      diamond.className = "spotter-checkpoint-diamond";
      diamond.style.backgroundColor = risk.color;
      diamond.style.boxShadow = `0 3px 10px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0,0,0,0.15), 0 0 10px ${risk.color}90`;

      // Upright text inside the diamond
      const text = document.createElement("span");
      text.className = "spotter-checkpoint-text";
      text.style.color = isModerate ? "#0f172a" : "#ffffff";
      text.textContent = String(cp.index + 1);

      diamond.appendChild(text);
      badgeWrapper.appendChild(diamond);
      markerContainer.appendChild(badgeWrapper);

      // Click to Activate Checkpoint
      markerContainer.addEventListener("click", (e) => {
        e.stopPropagation();

        // Deactivate previous marker
        if (activeMarkerElRef.current && activeMarkerElRef.current !== markerContainer) {
          activeMarkerElRef.current.classList.remove("is-active");
        }

        // Activate clicked marker
        markerContainer.classList.add("is-active");
        activeMarkerElRef.current = markerContainer;

        // Display detail popup card
        if (popup) {
          const html = createCheckpointPopupHtml(cp, totalCount);
          popup.setLngLat([cp.lng, cp.lat]).setHTML(html).addTo(map);

          // Attach close button handler inside popup
          const closeBtn = popup.getElement().querySelector(".checkpoint-popup-close-btn");
          if (closeBtn) {
            closeBtn.addEventListener("click", (ev) => {
              ev.stopPropagation();
              popup.remove();
              markerContainer.classList.remove("is-active");
              activeMarkerElRef.current = null;
            });
          }
        }

        onSelectCheckpointRef.current?.(cp);
      });

      // Anchor center ensures diamond is perfectly centered on route coordinate
      const marker = new Marker({
        element: markerContainer,
        anchor: "center",
      })
        .setLngLat([cp.lng, cp.lat])
        .addTo(map);

      markerRecordsRef.current.push({
        marker,
        element: markerContainer,
        checkpoint: cp,
      });
    });

    // Dismiss active checkpoint popup when clicking anywhere else on the map canvas
    const handleMapClick = (e: { originalEvent?: MouseEvent }) => {
      const popupEl = popup?.getElement();
      if (popupEl && e.originalEvent?.target && popupEl.contains(e.originalEvent.target as Node)) {
        return;
      }

      if (popup) {
        popup.remove();
      }
      if (activeMarkerElRef.current) {
        activeMarkerElRef.current.classList.remove("is-active");
        activeMarkerElRef.current = null;
      }
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
      clearMarkers();
    };
  }, [map, checkpoints, routeId]);

  // Dynamically highlight checkpoints when the forecast slider reaches or matches their arrival hour
  useEffect(() => {
    const records = markerRecordsRef.current;
    if (records.length === 0) return;

    // Find the closest reached checkpoint or matching checkpoint
    let closestReachedIdx = -1;
    for (let i = 0; i < records.length; i++) {
      if (records[i].checkpoint.arrival_hour_offset <= forecastHour) {
        closestReachedIdx = i;
      } else {
        break;
      }
    }

    records.forEach((rec, idx) => {
      const offset = rec.checkpoint.arrival_hour_offset;
      const isExactMatch = offset === forecastHour;
      const isCurrentHead = idx === closestReachedIdx;
      const isReached = offset <= forecastHour;

      // Current forecast checkpoint gets the luminous highlight ring
      const isCurrentForecast = isExactMatch || isCurrentHead;

      if (isCurrentForecast) {
        rec.element.classList.add("is-current-forecast");
        rec.element.classList.remove("is-future");
        rec.element.classList.add("is-reached");
      } else if (isReached) {
        rec.element.classList.remove("is-current-forecast");
        rec.element.classList.remove("is-future");
        rec.element.classList.add("is-reached");
      } else {
        rec.element.classList.remove("is-current-forecast");
        rec.element.classList.remove("is-reached");
        rec.element.classList.add("is-future");
      }
    });
  }, [forecastHour]);
}
